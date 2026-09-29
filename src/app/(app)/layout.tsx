"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageLoader } from "@/components/ui/misc";
import { AlertTriangle } from "lucide-react";

/**
 * Gate for everything under /(app): waits for Firebase, then redirects
 * signed-out visitors to /login. The proxy does the same on the server for
 * a snappy first paint; this handles token expiry and client navigations.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && configured && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, configured, router, pathname]);

  if (!configured) return <SetupNotice />;
  if (loading || !user) return <PageLoader label="Checking your session…" />;
  return <>{children}</>;
}

function SetupNotice() {
  return (
    <div className="mx-auto mt-24 max-w-lg px-6">
      <div className="card p-6">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold">Firebase isn&apos;t configured yet</h1>
        <p className="mt-2 text-sm text-ink-2">
          Add your Firebase web app keys to <code className="rounded bg-surface-2 px-1">.env</code> (see{" "}
          <code className="rounded bg-surface-2 px-1">.env.example</code>) and restart the dev server.
        </p>
      </div>
    </div>
  );
}
