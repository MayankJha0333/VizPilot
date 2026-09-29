import "server-only";
import { ProviderError, type ChatMessage, type CompletionRequest, type ProviderAdapter, type ProviderId } from "@/lib/ai/types";

/**
 * Provider adapters.
 *
 * Every provider except Gemini speaks the OpenAI chat format, so they share one
 * implementation with a different base URL. Each adapter is self-healing:
 *
 *  - Model retired / renamed (404 "model not found", "no longer available")
 *    → fetch the provider's live model list, pick the best match from a
 *      preference list, remember it, and retry once.
 *  - A parameter the model rejects (temperature, max_tokens, response_format)
 *    → drop / rename that parameter and retry once.
 *  - "Thinking" models that spend the whole token budget reasoning and return
 *    an empty answer → retry once with a bigger budget and thinking disabled.
 *
 * Anything else is thrown as a ProviderError so the orchestrator in client.ts
 * can fall back to the next provider.
 */

const DEFAULT_TIMEOUT = 22_000;
/** Reasoning models need room to think before answering, even for tiny prompts. */
const MIN_TOKENS = 256;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, provider: ProviderId): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new ProviderError(provider, "timeout", `${provider} timed out after ${timeoutMs}ms`);
    throw new ProviderError(provider, "network", `${provider}: ${(err as Error).message}`);
  } finally {
    clearTimeout(t);
  }
}

const MODEL_GONE = /(model[^.]{0,60}(not[ _]found|does not exist|no longer|not available|unavailable|decommission|deprecated|not supported|invalid|unknown))|(no longer available)|(model_not_found)|(is unavailable for free)|(no endpoints found)/i;

export function classify(provider: ProviderId, status: number, body: string): ProviderError {
  const snippet = body.replace(/\s+/g, " ").slice(0, 200);
  if (status === 401 || status === 403) return new ProviderError(provider, "auth", `${provider} rejected the API key (${status}): ${snippet}`, status);
  if (status === 402) return new ProviderError(provider, "quota", `${provider} is out of credits (402): ${snippet}`, status);
  if (status === 429) {
    // Some providers use 429 for a spent monthly quota rather than a burst limit.
    const spent = /(quota|credits?|billing|insufficient|exceeded your current)/i.test(body) && !/rate limit/i.test(body);
    return new ProviderError(provider, spent ? "quota" : "rate_limit", `${provider} ${spent ? "quota exhausted" : "rate limited"} (429): ${snippet}`, status);
  }
  if ((status === 400 || status === 404 || status === 410 || status === 422) && MODEL_GONE.test(body)) {
    return new ProviderError(provider, "model_unavailable", `${provider} model unavailable (${status}): ${snippet}`, status);
  }
  if (status === 400 || status === 404 || status === 422) return new ProviderError(provider, "config", `${provider} request rejected (${status}): ${snippet}`, status);
  if (status >= 500) return new ProviderError(provider, "server", `${provider} server error (${status}): ${snippet}`, status);
  return new ProviderError(provider, "bad_response", `${provider} responded ${status}: ${snippet}`, status);
}

// ---------------------------------------------------------------------------
// Model discovery
// ---------------------------------------------------------------------------

/** Words that mark models we never want for chat (audio, images, embeddings, moderation…). */
const NOT_CHAT = /(whisper|tts|audio|speech|transcri|embed|guard|moderation|rerank|vision-only|image|imagen|veo|dall|clip|ocr|realtime|live|search-preview|computer-use|robotics|native-audio|aqa|learnlm|gemma-3n)/i;

/**
 * Pick the best model from a live list using an ordered list of patterns.
 * Earlier patterns win; within a pattern, the "newest-looking" id wins.
 */
export function pickModel(ids: string[], prefs: RegExp[], avoid?: RegExp): string | undefined {
  const usable = ids.filter((id) => !NOT_CHAT.test(id) && !(avoid && avoid.test(id)));
  for (const re of prefs) {
    const hits = usable.filter((id) => re.test(id));
    if (hits.length) return hits.sort(compareVersionsDesc)[0];
  }
  return undefined;
}

/** "gemini-3.8-flash" > "gemini-2.5-flash"; stable ids beat preview/exp ones. */
function compareVersionsDesc(a: string, b: string): number {
  const unstable = (s: string) => (/(preview|exp|beta|alpha|\d{4}-\d{2}-\d{2}|\d{2}-\d{2})/i.test(s) ? 1 : 0);
  const u = unstable(a) - unstable(b);
  if (u !== 0) return u;
  const va = (a.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  const vb = (b.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (vb[i] ?? 0) - (va[i] ?? 0);
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

async function getJSON(url: string, headers: Record<string, string>, provider: ProviderId): Promise<unknown> {
  const res = await fetchWithTimeout(url, { headers }, 10_000, provider);
  if (!res.ok) throw classify(provider, res.status, await res.text().catch(() => ""));
  return res.json();
}

/** Extract model ids from the shapes different providers return. */
function idsFrom(data: unknown): string[] {
  const d = data as { data?: { id?: string }[]; models?: { name?: string; id?: string; supportedGenerationMethods?: string[] }[] } | { id?: string }[];
  if (Array.isArray(d)) return d.map((m) => m.id).filter((x): x is string => Boolean(x));
  if (d?.data) return d.data.map((m) => m.id).filter((x): x is string => Boolean(x));
  if (d?.models)
    return d.models
      .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent"))
      .map((m) => (m.name ?? m.id ?? "").replace(/^models\//, ""))
      .filter(Boolean);
  return [];
}

// ---------------------------------------------------------------------------
// OpenAI-compatible adapter
// ---------------------------------------------------------------------------

interface OpenAILike {
  id: ProviderId;
  label: string;
  url: string;
  /** Endpoint that lists models (OpenAI format or a plain array). */
  modelsUrl?: string;
  key: string | undefined;
  model: string;
  /** Set when the model came from env – we still heal if it's retired, but log it. */
  pinned?: boolean;
  prefs: RegExp[];
  avoid?: RegExp;
  priority: number;
  /** Some gateways reject response_format – skip it. */
  supportsJsonMode?: boolean;
  /** Use max_completion_tokens instead of max_tokens (OpenAI-family gateways). */
  completionTokensParam?: boolean;
  /** Extra body fields, e.g. disabling "thinking" on GLM. */
  extraBody?: Record<string, unknown>;
  extraHeaders?: Record<string, string>;
}

type OAIMessage = { content?: string | { type?: string; text?: string }[] | null; reasoning_content?: string; reasoning?: string };

function openAICompatible(o: OpenAILike): ProviderAdapter {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${o.key}`, ...(o.extraHeaders ?? {}) };
  const dropped = new Set<string>(); // params this model rejected
  let discovered = false;

  const adapter: ProviderAdapter = {
    id: o.id,
    label: o.label,
    model: o.model,
    configured: Boolean(o.key),
    priority: o.priority,

    async discoverModel() {
      if (!o.modelsUrl) return undefined;
      const ids = idsFrom(await getJSON(o.modelsUrl, headers, o.id));
      const next = pickModel(ids.filter((id) => id !== adapter.model), o.prefs, o.avoid);
      if (next) {
        console.info(`[ai] ${o.id}: "${adapter.model}" is unavailable – switching to "${next}"`);
        adapter.model = next;
        dropped.clear();
      }
      return next;
    },

    async complete(req: CompletionRequest) {
      const send = async (maxTokens: number, noThinking: boolean) => {
        const body: Record<string, unknown> = { model: adapter.model, messages: req.messages, ...(o.extraBody ?? {}) };
        if (!dropped.has("temperature")) body.temperature = req.temperature ?? 0.2;
        const tokensKey = o.completionTokensParam || dropped.has("max_tokens") ? "max_completion_tokens" : "max_tokens";
        if (!dropped.has(tokensKey)) body[tokensKey] = maxTokens;
        if (req.json && o.supportsJsonMode && !dropped.has("response_format")) body.response_format = { type: "json_object" };
        if (noThinking) {
          if (!dropped.has("thinking")) body.thinking = { type: "disabled" };
          if (!dropped.has("reasoning_effort")) body.reasoning_effort = "low";
        }
        const res = await fetchWithTimeout(o.url, { method: "POST", headers, body: JSON.stringify(body) }, req.timeoutMs ?? DEFAULT_TIMEOUT, o.id);
        return { res, errBody: res.ok ? "" : await res.text().catch(() => "") };
      };

      let tokens = Math.max(MIN_TOKENS, req.maxTokens ?? 1200);
      let noThinking = false;
      // Up to 5 tries: heal a retired model, a rejected param, or an empty "thinking-only" answer.
      for (let attempt = 0; attempt < 5; attempt++) {
        const { res, errBody } = await send(tokens, noThinking);
        if (!res.ok) {
          const pe = classify(o.id, res.status, errBody);
          if (pe.kind === "model_unavailable" && !discovered) {
            discovered = true;
            const next = await adapter.discoverModel?.().catch((e) => {
              console.warn(`[ai] ${o.id}: model discovery failed – ${(e as Error).message}`);
              return undefined;
            });
            if (next) continue;
          }
          if (res.status === 400) {
            const param = ["temperature", "max_tokens", "max_completion_tokens", "response_format", "thinking", "reasoning_effort"].find(
              (p) => new RegExp(`\\b${p}\\b`, "i").test(errBody) && !dropped.has(p)
            );
            if (param) {
              dropped.add(param);
              continue;
            }
          }
          throw pe;
        }
        const data = (await res.json().catch(() => null)) as { choices?: { message?: OAIMessage; finish_reason?: string }[]; model?: string } | null;
        const msg = data?.choices?.[0]?.message;
        const text = typeof msg?.content === "string" ? msg.content : Array.isArray(msg?.content) ? msg.content.map((p) => p.text ?? "").join("") : "";
        if (text.trim()) return { text, model: data?.model ?? adapter.model };
        // Empty answer – usually a reasoning model that spent the budget thinking.
        if (tokens < 4096) {
          noThinking = true;
          tokens = Math.min(4096, tokens * 4);
          continue;
        }
        break;
      }
      throw new ProviderError(o.id, "bad_response", `${o.id} returned an empty completion`);
    },
  };
  return adapter;
}

// ---------------------------------------------------------------------------
// Gemini adapter
// ---------------------------------------------------------------------------

const GEMINI_PREFS = [/^gemini-flash-latest$/, /^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash(?!-lite)/, /^gemini-flash/, /^gemini-[\d.]+-pro$/, /^gemini/];

function gemini(key: string | undefined, model: string, priority: number): ProviderAdapter {
  const id: ProviderId = "gemini";
  let discovered = false;
  const adapter: ProviderAdapter = {
    id,
    label: "Google Gemini",
    model,
    configured: Boolean(key),
    priority,
    async discoverModel() {
      const ids = idsFrom(await getJSON(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`, {}, id));
      const next = pickModel(ids.filter((m) => m !== adapter.model), GEMINI_PREFS, /(lite|tts|image|thinking|embedding|nano)/i);
      if (next) {
        console.info(`[ai] gemini: "${adapter.model}" is unavailable – switching to "${next}"`);
        adapter.model = next;
      }
      return next;
    },
    async complete(req: CompletionRequest) {
      const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const contents = req.messages
        .filter((m) => m.role !== "system")
        .map((m: ChatMessage) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      for (let attempt = 0; attempt < 3; attempt++) {
        const tokens = Math.max(MIN_TOKENS, req.maxTokens ?? 1200) * (attempt + 1);
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${adapter.model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
              contents,
              generationConfig: {
                temperature: req.temperature ?? 0.2,
                maxOutputTokens: tokens,
                ...(req.json ? { responseMimeType: "application/json" } : {}),
                // Keep "thinking" small so short answers don't come back empty.
                ...(attempt > 0 ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
              },
            }),
          },
          req.timeoutMs ?? DEFAULT_TIMEOUT,
          id
        );
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const pe = classify(id, res.status, body);
          if (pe.kind === "model_unavailable" && !discovered) {
            discovered = true;
            if (await adapter.discoverModel?.().catch(() => undefined)) continue;
          }
          if (attempt > 0 && res.status === 400 && /thinking/i.test(body)) continue; // model doesn't support thinkingConfig
          throw pe;
        }
        const data = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[] } | null;
        const text = data?.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
        if (text.trim()) return { text, model: adapter.model };
      }
      throw new ProviderError(id, "bad_response", "gemini returned an empty completion");
    },
  };
  return adapter;
}

// ---------------------------------------------------------------------------

/** Build the adapter list from environment variables. Order = fallback order. */
export function buildAdapters(env: NodeJS.ProcessEnv = process.env): ProviderAdapter[] {
  const list: ProviderAdapter[] = [
    openAICompatible({
      id: "groq",
      label: "Groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      modelsUrl: "https://api.groq.com/openai/v1/models",
      key: env.GROQ_API_KEY,
      model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
      prefs: [/llama-3\.3-70b/, /llama-4.*(maverick|scout)/, /gpt-oss-120b/, /llama.*70b/, /qwen.*(32b|72b)/, /gpt-oss/, /llama/, /qwen|kimi|mistral|gemma/],
      priority: 10,
      supportsJsonMode: true,
    }),
    gemini(env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-flash-latest", 20),
    openAICompatible({
      id: "mistral",
      label: "Mistral",
      url: "https://api.mistral.ai/v1/chat/completions",
      modelsUrl: "https://api.mistral.ai/v1/models",
      key: env.MISTRAL_API_KEY,
      model: env.MISTRAL_MODEL || "mistral-small-latest",
      prefs: [/^mistral-small-latest$/, /^mistral-medium-latest$/, /^mistral-large-latest$/, /^open-mistral-nemo/, /^ministral-8b-latest$/, /^mistral-/],
      avoid: /(codestral|devstral|pixtral|voxtral|magistral|ocr|embed|moderation|saba)/i,
      priority: 30,
      supportsJsonMode: true,
    }),
    openAICompatible({
      id: "github",
      label: "GitHub Models",
      url: "https://models.github.ai/inference/chat/completions",
      modelsUrl: "https://models.github.ai/catalog/models",
      key: env.GITHUB_MODELS_TOKEN,
      model: env.GITHUB_MODEL || "openai/gpt-4.1-mini",
      prefs: [/openai\/gpt-4\.1-mini$/, /openai\/gpt-4o-mini$/, /openai\/gpt-[\d.]+-mini$/, /openai\/gpt-4\.1$/, /meta\/.*llama.*70b/i, /mistral-ai\/mistral-small/i, /openai\/gpt/],
      avoid: /(o1|o3|o4|reasoning|embedding|deepseek-r1|phi-4-reasoning)/i,
      priority: 40,
      supportsJsonMode: true,
      completionTokensParam: true,
      extraHeaders: { Accept: "application/json", "X-GitHub-Api-Version": "2022-11-28" },
    }),
    openAICompatible({
      id: "openrouter",
      label: "OpenRouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      modelsUrl: "https://openrouter.ai/api/v1/models",
      key: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      // Free models come and go on OpenRouter – only ever pick a ":free" one.
      prefs: [/llama-3\.3-70b.*:free$/, /llama-4.*:free$/, /(qwen|mistral|gemma|llama|deepseek-chat|gpt-oss|glm|kimi).*:free$/i, /:free$/],
      avoid: /(r1|thinking|reason|vision|vl-|coder|-vl)/i,
      priority: 50,
      supportsJsonMode: false,
      extraHeaders: { "HTTP-Referer": "https://vizpilot.app", "X-Title": "VizPilot" },
    }),
    openAICompatible({
      id: "zai",
      label: "Z.ai (GLM)",
      url: "https://api.z.ai/api/paas/v4/chat/completions",
      modelsUrl: "https://api.z.ai/api/paas/v4/models",
      key: env.ZAI_API_KEY,
      model: env.ZAI_MODEL || "glm-4.5-flash",
      prefs: [/glm-[\d.]+-flash$/i, /glm-[\d.]+-air/i, /glm-[\d.]+$/i, /glm/i],
      avoid: /(v$|-v-|vision|image|video|voice|embedding)/i,
      priority: 60,
      supportsJsonMode: false,
      // GLM "thinks" by default and can return an empty answer for short prompts.
      extraBody: { thinking: { type: "disabled" } },
    }),
    openAICompatible({
      id: "huggingface",
      label: "Hugging Face",
      url: "https://router.huggingface.co/v1/chat/completions",
      modelsUrl: "https://router.huggingface.co/v1/models",
      key: env.HUGGINGFACE_API_KEY,
      model: env.HUGGINGFACE_MODEL || "meta-llama/Llama-3.1-8B-Instruct",
      prefs: [/Llama-3\.3-70B-Instruct/i, /Llama-3\.1-8B-Instruct/i, /Qwen.*Instruct/i, /Instruct/i],
      priority: 70,
      supportsJsonMode: false,
    }),
  ];
  const order = (env.AI_PROVIDER_ORDER || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as ProviderId[];
  if (order.length) {
    list.forEach((a) => {
      const i = order.indexOf(a.id);
      a.priority = i === -1 ? 100 + a.priority : i;
    });
  }
  return list.sort((a, b) => a.priority - b.priority);
}
