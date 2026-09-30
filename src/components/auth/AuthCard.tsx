"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/misc";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg">
      {/* soft clay pebbles floating behind the form */}
      <span aria-hidden className="clay-blob animate-float -left-16 top-24 h-56 w-56 bg-clay-lavender" />
      <span aria-hidden className="clay-blob animate-float -right-10 top-10 h-36 w-36 bg-clay-peach [animation-delay:-2s]" />
      <span aria-hidden className="clay-blob animate-float bottom-10 right-[12%] h-24 w-24 bg-clay-mint [animation-delay:-4s]" />
      <span aria-hidden className="clay-blob animate-float bottom-24 left-[14%] hidden h-16 w-16 bg-clay-sky [animation-delay:-3s] sm:block" />
      <header className="relative flex h-16 items-center px-6">
        <Logo />
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-[420px]">
          <div className="card rounded-[32px] p-6 sm:p-9">
            <h1 className="text-[28px] font-extrabold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm font-semibold text-ink-2">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <p className="mt-5 text-center text-sm font-semibold text-ink-2">{footer}</p>}
        </div>
      </main>
      <footer className="relative px-6 py-4 text-center text-xs font-semibold text-ink-3">
        By continuing you agree to our{" "}
        <Link href="/" className="underline hover:text-ink">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/" className="underline hover:text-ink">
          privacy notice
        </Link>
        .
      </footer>
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.5 35.1 44 29.9 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
