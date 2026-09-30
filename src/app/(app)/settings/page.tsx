"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "firebase/auth";
import { clsx } from "clsx";
import { CheckCircle2, Clock, LogOut, RefreshCw, Sparkles, XCircle, Zap } from "lucide-react";
import { AppShell, Avatar } from "@/components/layout/AppShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Badge, Field } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { ProviderStatus } from "@/lib/ai/types";

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const currentName = profile?.name || user?.displayName || "";
  const [name, setName] = useState(currentName);
  const [seenName, setSeenName] = useState(currentName);
  if (currentName !== seenName) {
    setSeenName(currentName);
    setName(currentName);
  }
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<{ db: string } | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    setTimeout(() => setNow(Date.now()), 0);
    return () => clearInterval(t);
  }, []);

  const loadProviders = useCallback(() => api<{ providers: ProviderStatus[] }>("/api/ai/providers").then((d) => setProviders(d.providers)).catch(() => {}), []);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
    loadProviders();
  }, [loadProviders]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await updateProfile(user, { displayName: name.trim() });
      await user.getIdToken(true);
      await api("/api/auth/session", { method: "POST" });
      toast.success("Profile updated");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const test = async (id?: string) => {
    setTesting(id ?? "all");
    try {
      const r = await api<{ ok: boolean; provider?: string; model?: string; latencyMs: number; reply?: string; error?: string; providers: ProviderStatus[] }>("/api/ai/providers", { method: "POST", json: { action: "test", provider: id } });
      setProviders(r.providers);
      setTestResult((t) => ({ ...t, [id ?? "all"]: { ok: r.ok, text: r.ok ? `${r.provider} · ${r.model} · ${(r.latencyMs / 1000).toFixed(1)}s` : r.error ?? "failed" } }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTesting(null);
    }
  };
  const reset = async () => {
    const r = await api<{ providers: ProviderStatus[] }>("/api/ai/providers", { method: "POST", json: { action: "reset" } });
    setProviders(r.providers);
    setTestResult({});
    toast.success("Cooldowns cleared");
  };

  const configured = providers?.filter((p) => p.configured) ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="animate-fade-up">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-ink-2">Your account, AI providers and workspace status.</p>
        </div>

        {/* AI providers */}
        <section className="card overflow-hidden animate-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="clay-tile h-10 w-10 bg-clay-lavender text-clay-lavender-ink">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">AI providers</h2>
                <p className="text-xs text-ink-3">Tried in this order. If one fails or rate-limits, the next one answers — you never notice.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={reset}>
                <RefreshCw className="h-3.5 w-3.5" /> Clear cooldowns
              </Button>
              <Button size="sm" onClick={() => test()} loading={testing === "all"} data-testid="test-ai">
                <Zap className="h-3.5 w-3.5" /> Test fallback chain
              </Button>
            </div>
          </div>
          {testResult.all && (
            <div className={clsx("mx-4 mb-2 rounded-2xl px-4 py-2.5 text-xs font-bold", testResult.all.ok ? "bg-success-soft text-success-ink" : "bg-danger-soft text-danger-ink")}>
              {testResult.all.ok ? `Answered by ${testResult.all.text}` : testResult.all.text}
            </div>
          )}
          <ul className="divide-y">
            {providers === null && <li className="px-5 py-4 text-sm text-ink-3">Loading…</li>}
            {providers?.map((p, i) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold", p.configured ? "bg-brand-soft text-brand-ink" : "bg-surface-3 text-ink-3")}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{p.label}</span>
                    <span className="truncate text-xs text-ink-3">{p.model}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-3">
                    {p.state === "ready" && (
                      <span className="inline-flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3 w-3" /> Ready
                      </span>
                    )}
                    {p.state === "cooling" && (
                      <span className="inline-flex items-center gap-1 text-clay-lemon-ink" title={p.reason}>
                        <Clock className="h-3 w-3" /> Cooling down{p.cooldownEndsAt ? ` (${Math.max(1, Math.round((p.cooldownEndsAt - (now || p.cooldownEndsAt)) / 60000))} min)` : ""}
                      </span>
                    )}
                    {p.state === "disabled" && (
                      <span className="inline-flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> No key in .env
                      </span>
                    )}
                    {p.successes > 0 && <span>· {p.successes} ok</span>}
                    {p.failures > 0 && <span>· {p.failures} failed</span>}
                    {p.lastLatencyMs && <span>· {(p.lastLatencyMs / 1000).toFixed(1)}s</span>}
                    {testResult[p.id] && <span className={testResult[p.id].ok ? "text-success" : "text-danger"}>· {testResult[p.id].text}</span>}
                  </div>
                  {p.state === "cooling" && p.reason && <p className="mt-0.5 truncate text-[11px] text-ink-3">{p.reason}</p>}
                </div>
                <Button size="xs" variant="outline" disabled={!p.configured || testing !== null} loading={testing === p.id} onClick={() => test(p.id)}>
                  Test
                </Button>
              </li>
            ))}
          </ul>
          <div className="clay-inset m-3 rounded-2xl px-4 py-3 text-xs font-semibold text-ink-3">
            {configured.length} of {providers?.length ?? 0} providers configured. Order can be changed with <code className="rounded-lg bg-surface px-1">AI_PROVIDER_ORDER=groq,gemini,…</code> in .env. Without any key, the built-in rules engine answers.
          </div>
        </section>

        <section className="card p-5 animate-fade-up">
          <h2 className="text-sm font-semibold">Profile</h2>
          <div className="mt-4 flex items-center gap-4">
            <Avatar initial={(name || user?.email || "U").charAt(0).toUpperCase()} photo={user?.photoURL || ""} size={56} />
            <div className="flex-1 space-y-3">
              <Field label="Display name" htmlFor="profile-name">
                <input id="profile-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="profile-email">
                <input id="profile-email" className="input" value={user?.email || ""} disabled />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} loading={busy} disabled={!name.trim()}>
              Save changes
            </Button>
          </div>
        </section>

        <section className="card p-5 animate-fade-up">
          <h2 className="text-sm font-semibold">Workspace status</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span>Database (MongoDB)</span>
              {health ? <Badge tone={health.db === "ok" ? "success" : "warning"}>{health.db === "ok" ? "Connected" : "Error"}</Badge> : <Badge>Checking…</Badge>}
            </li>
            <li className="flex items-center justify-between">
              <span>Sign-in provider</span>
              <Badge>{user?.providerData?.[0]?.providerId === "google.com" ? "Google" : "Email & password"}</Badge>
            </li>
          </ul>
          {health && health.db !== "ok" && <p className="mt-3 rounded-2xl bg-clay-lemon px-3 py-2 text-xs font-bold text-clay-lemon-ink">{health.db}</p>}
        </section>

        <section className="card p-5 animate-fade-up">
          <h2 className="text-sm font-semibold">Session</h2>
          <p className="mt-1 text-sm text-ink-2">Signed in as {user?.email}.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={async () => {
              await signOut();
              router.push("/login");
            }}
            data-testid="sign-out"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
