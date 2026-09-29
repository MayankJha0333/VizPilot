export type ProviderId = "groq" | "gemini" | "mistral" | "github" | "openrouter" | "zai" | "huggingface";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  /** Ask the provider for a JSON object (when it supports it). */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Per-call timeout in ms. */
  timeoutMs?: number;
}

export interface CompletionResult {
  text: string;
  provider: ProviderId;
  model: string;
  latencyMs: number;
  /** Providers that were tried and failed before this one succeeded. */
  attempts: AttemptLog[];
}

export interface AttemptLog {
  provider: ProviderId;
  model: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
  status?: number;
}

/**
 * auth – wrong key · quota – out of credits · model_unavailable – model retired and no replacement found
 * rate_limit – burst limit · server – 5xx · timeout / network – transient · bad_response – empty/garbled · config – other 4xx
 */
export type FailureKind = "auth" | "quota" | "model_unavailable" | "rate_limit" | "server" | "timeout" | "bad_response" | "network" | "config";

export class ProviderError extends Error {
  kind: FailureKind;
  status?: number;
  provider: ProviderId;
  constructor(provider: ProviderId, kind: FailureKind, message: string, status?: number) {
    super(message);
    this.provider = provider;
    this.kind = kind;
    this.status = status;
  }
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  /** Model used for this adapter (overridable via env). */
  model: string;
  /** Is a key configured? */
  configured: boolean;
  /** Ordering hint – lower runs first. */
  priority: number;
  complete(req: CompletionRequest): Promise<{ text: string; model: string }>;
  /** Look up the provider's live model list and switch to the best available model. */
  discoverModel?(): Promise<string | undefined>;
}

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  model: string;
  configured: boolean;
  state: "ready" | "cooling" | "disabled";
  /** Why it's cooling/disabled. */
  reason?: string;
  /** Kind of the last failure (auth, quota, rate_limit…). */
  lastFailure?: FailureKind;
  cooldownEndsAt?: number;
  successes: number;
  failures: number;
  lastLatencyMs?: number;
  lastUsedAt?: number;
}
