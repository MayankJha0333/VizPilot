import "server-only";
import { buildAdapters } from "@/lib/ai/providers";
import { ProviderError, type AttemptLog, type CompletionRequest, type CompletionResult, type ProviderAdapter, type ProviderId, type ProviderStatus } from "@/lib/ai/types";

/**
 * Orchestrator: tries providers in priority order, skipping ones that are
 * cooling down after failures (circuit breaker). Auth/config failures disable a
 * provider for a long time (its key is wrong); rate limits and server errors
 * cool it down briefly; timeouts count as soft failures.
 *
 * State is in-memory per server process – enough for a single Next.js server.
 */

interface Breaker {
  failures: number;
  successes: number;
  cooldownEndsAt: number;
  reason?: string;
  kind?: ProviderError["kind"];
  lastLatencyMs?: number;
  lastUsedAt?: number;
}

declare global {
  var __vizpilotAI: { breakers: Map<ProviderId, Breaker>; adapters?: ProviderAdapter[]; builder?: unknown } | undefined;
}
const state = global.__vizpilotAI ?? { breakers: new Map<ProviderId, Breaker>() };
global.__vizpilotAI = state;

function adapters(): ProviderAdapter[] {
  // Rebuild when providers.ts changed (hot reload) so stale adapters never linger.
  if (!state.adapters || state.builder !== buildAdapters) {
    state.adapters = buildAdapters();
    state.builder = buildAdapters;
  }
  return state.adapters;
}

function breaker(id: ProviderId): Breaker {
  let b = state.breakers.get(id);
  if (!b) {
    b = { failures: 0, successes: 0, cooldownEndsAt: 0 };
    state.breakers.set(id, b);
  }
  return b;
}

const COOLDOWN_MS: Record<ProviderError["kind"], number> = {
  auth: 30 * 60_000, // wrong key – don't hammer it
  quota: 60 * 60_000, // out of credits – won't fix itself soon
  model_unavailable: 30 * 60_000, // retired model and no replacement found
  config: 15 * 60_000, // other rejected requests
  rate_limit: 90_000,
  server: 60_000,
  timeout: 45_000,
  network: 45_000,
  bad_response: 30_000,
};

function recordFailure(id: ProviderId, err: ProviderError) {
  const b = breaker(id);
  b.failures += 1;
  // Escalate cooldown for repeated failures (max 10 min).
  const base = COOLDOWN_MS[err.kind] ?? 30_000;
  const mult = Math.min(8, Math.pow(2, Math.max(0, Math.min(b.failures, 6) - 1)));
  // Transient failures escalate up to 10 min; "structural" ones keep their long base.
  const cap = ["auth", "quota", "model_unavailable", "config"].includes(err.kind) ? base : 10 * 60_000;
  b.cooldownEndsAt = Date.now() + Math.min(base * mult, cap);
  b.reason = err.message;
  b.kind = err.kind;
}

function recordSuccess(id: ProviderId, latency: number) {
  const b = breaker(id);
  b.successes += 1;
  b.failures = 0;
  b.cooldownEndsAt = 0;
  b.reason = undefined;
  b.kind = undefined;
  b.lastLatencyMs = latency;
  b.lastUsedAt = Date.now();
}

export function hasAIProvider(): boolean {
  return adapters().some((a) => a.configured);
}

export function providerStatus(): ProviderStatus[] {
  const now = Date.now();
  return adapters().map((a) => {
    const b = breaker(a.id);
    const cooling = b.cooldownEndsAt > now;
    return {
      id: a.id,
      label: a.label,
      model: a.model,
      configured: a.configured,
      state: !a.configured ? "disabled" : cooling ? "cooling" : "ready",
      reason: !a.configured ? "No API key in .env" : cooling ? b.reason : undefined,
      lastFailure: cooling ? b.kind : undefined,
      cooldownEndsAt: cooling ? b.cooldownEndsAt : undefined,
      successes: b.successes,
      failures: b.failures,
      lastLatencyMs: b.lastLatencyMs,
      lastUsedAt: b.lastUsedAt,
    };
  });
}

/** Reset breakers (used by the "retry now" button in settings). */
export function resetBreakers(id?: ProviderId) {
  if (id) state.breakers.delete(id);
  else {
    state.breakers.clear();
    state.adapters = undefined; // re-read .env and retry the default models
  }
}

export interface CompleteOptions extends CompletionRequest {
  /** Try only this provider (used by the settings "test" button). */
  only?: ProviderId;
  /** Include cooling providers as a last resort. */
  allowCooling?: boolean;
}

export async function complete(opts: CompleteOptions): Promise<CompletionResult> {
  const all = adapters().filter((a) => a.configured);
  if (all.length === 0) throw new Error("No AI provider is configured. Add an API key to .env.");
  const now = Date.now();
  let candidates = opts.only ? all.filter((a) => a.id === opts.only) : all.filter((a) => breaker(a.id).cooldownEndsAt <= now);
  if (!candidates.length && (opts.allowCooling ?? true)) {
    // Everything is cooling – try the one whose cooldown ends soonest.
    candidates = [...all].sort((a, b) => breaker(a.id).cooldownEndsAt - breaker(b.id).cooldownEndsAt).slice(0, 2);
  }
  const attempts: AttemptLog[] = [];
  for (const a of candidates) {
    const started = Date.now();
    try {
      const { text, model } = await a.complete(opts);
      const latencyMs = Date.now() - started;
      recordSuccess(a.id, latencyMs);
      attempts.push({ provider: a.id, model, ok: true, latencyMs });
      if (attempts.length > 1) console.info(`[ai] ${a.id} succeeded after ${attempts.length - 1} failed attempt(s)`);
      return { text, provider: a.id, model, latencyMs, attempts };
    } catch (err) {
      const latencyMs = Date.now() - started;
      const pe = err instanceof ProviderError ? err : new ProviderError(a.id, "bad_response", (err as Error).message);
      recordFailure(a.id, pe);
      attempts.push({ provider: a.id, model: a.model, ok: false, latencyMs, error: pe.message, status: pe.status });
      console.warn(`[ai] ${a.id} failed (${pe.kind}${pe.status ? ` ${pe.status}` : ""}) in ${latencyMs}ms – trying next provider`);
    }
  }
  const summary = attempts.map((x) => `${x.provider}: ${x.error}`).join(" | ");
  throw new Error(`All AI providers failed. ${summary}`);
}

/** Pull the first JSON object/array out of a model response (tolerates fences and prose). */
export function extractJSON<T = unknown>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  for (let end = candidate.length; end > start; end--) {
    const ch = candidate[end - 1];
    if (ch !== "}" && ch !== "]") continue;
    try {
      return JSON.parse(candidate.slice(start, end)) as T;
    } catch {
      /* keep shrinking */
    }
  }
  return null;
}

/** Ask for JSON, parse it, and retry once with a stricter reminder if the model rambled. */
export async function completeJSON<T>(system: string, user: string, opts: Partial<CompleteOptions> = {}): Promise<{ data: T; result: CompletionResult }> {
  const first = await complete({ ...opts, json: true, messages: [{ role: "system", content: system }, { role: "user", content: user }] });
  const parsed = extractJSON<T>(first.text);
  if (parsed) return { data: parsed, result: first };
  const second = await complete({
    ...opts,
    json: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
      { role: "assistant", content: first.text.slice(0, 1500) },
      { role: "user", content: "That was not valid JSON. Reply again with ONLY the JSON object, no prose, no code fences." },
    ],
  });
  const parsed2 = extractJSON<T>(second.text);
  if (!parsed2) throw new Error("The model did not return valid JSON.");
  return { data: parsed2, result: second };
}
