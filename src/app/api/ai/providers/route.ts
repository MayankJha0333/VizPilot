import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/auth-server";
import { complete, providerStatus, resetBreakers } from "@/lib/ai";
import type { ProviderId } from "@/lib/ai/types";

/** GET → status of every provider (for the settings page). */
export async function GET(req: Request) {
  try {
    await requireUser(req);
    return NextResponse.json({ providers: providerStatus() });
  } catch (err) {
    return jsonError(err);
  }
}

const Input = z.object({
  action: z.enum(["test", "reset"]),
  provider: z.enum(["groq", "gemini", "mistral", "github", "openrouter", "zai", "huggingface"]).optional(),
});

/** POST {action:"test", provider} → sends a tiny prompt to one provider. {action:"reset"} clears cooldowns. */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const parsed = Input.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    if (parsed.data.action === "reset") {
      resetBreakers(parsed.data.provider as ProviderId | undefined);
      return NextResponse.json({ ok: true, providers: providerStatus() });
    }
    const started = Date.now();
    try {
      const r = await complete({
        only: parsed.data.provider,
        allowCooling: true,
        timeoutMs: 20000,
        maxTokens: 40,
        messages: [
          { role: "system", content: "Reply with the single word: pong" },
          { role: "user", content: "ping" },
        ],
      });
      return NextResponse.json({ ok: true, provider: r.provider, model: r.model, latencyMs: Date.now() - started, reply: r.text.trim().slice(0, 40), providers: providerStatus() });
    } catch (err) {
      return NextResponse.json({ ok: false, error: (err as Error).message, latencyMs: Date.now() - started, providers: providerStatus() });
    }
  } catch (err) {
    return jsonError(err);
  }
}
