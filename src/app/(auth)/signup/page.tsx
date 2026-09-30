"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Eye, EyeOff } from "lucide-react";
import { AuthCard, GoogleIcon } from "@/components/auth/AuthCard";
import { authErrorMessage, useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/misc";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const { signUp, signInWithGoogle, configured } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard?welcome=1";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);

  const strong = password.length >= 8;
  const hasNumber = /\d/.test(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Tell us your name so we can personalise things.");
    if (password.length < 6) return setError("Use at least 6 characters for your password.");
    setBusy("email");
    try {
      await signUp(email.trim(), password, name);
      router.replace(next);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(null);
    }
  };

  const google = async () => {
    setError(null);
    setBusy("google");
    try {
      await signInWithGoogle();
      router.replace(next);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(null);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Free to start. No credit card needed."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {!configured && (
        <p className="mb-4 rounded-2xl bg-clay-lemon px-4 py-2.5 text-sm font-bold text-clay-lemon-ink">
          Firebase keys are missing in <code>.env</code>. Add them to enable sign-up.
        </p>
      )}
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={google} loading={busy === "google"} disabled={!configured || busy === "email"}>
        <GoogleIcon /> Continue with Google
      </Button>
      <div className="my-5 flex items-center gap-3 text-xs text-ink-3">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="name">
          <input id="name" autoComplete="name" required className="input" placeholder="Ada Lovelace" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required className="input" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              className="input pr-10"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password && (
            <ul className="mt-2 flex gap-4 text-xs">
              <li className={strong ? "text-success" : "text-ink-3"}>
                <Check className="mr-1 inline h-3 w-3" />8+ characters
              </li>
              <li className={hasNumber ? "text-success" : "text-ink-3"}>
                <Check className="mr-1 inline h-3 w-3" />Contains a number
              </li>
            </ul>
          )}
        </Field>
        {error && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-2.5 text-sm font-bold text-danger-ink">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy === "email"} disabled={!configured || busy === "google"}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
