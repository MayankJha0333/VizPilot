"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Logo({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <Link href="/" className={clsx("inline-flex items-center", className)}>
      <Wordmark dark={dark} />
    </Link>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[32%] shadow-[0_6px_14px_-5px_rgba(60,74,205,0.6),inset_0_-2px_4px_rgba(20,28,120,0.4),inset_0_2px_3px_rgba(255,255,255,0.45)]"
      style={{ width: size, height: size, background: "linear-gradient(135deg,#4c5fd5 0%,#3f6fe0 55%,#2a78d6 100%)" }}
      aria-hidden
    >
      <span className="absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_0%,rgba(255,255,255,0.35),transparent_60%)]" />
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="relative">
        <path d="M8 10.5 L14.5 23.5 L25 9.5" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5 9.5 H25 V16" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="6" r="2.2" fill="#eb6834" />
      </svg>
    </span>
  );
}

/** Wordmark used in the dark sidebar and marketing header. */
export function Wordmark({ dark = false, size = 28 }: { dark?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={clsx("text-[18px] font-extrabold tracking-tight", dark ? "text-white" : "text-ink")}>
        Viz<span className={dark ? "text-brand-2" : "text-brand"}>Pilot</span>
      </span>
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx("inline-block h-5 w-5 animate-spin rounded-full border-2 border-border-strong border-t-brand", className)}
      aria-label="Loading"
    />
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-ink-3 animate-fade-in">
      <div className="relative">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
        <LogoMark size={36} />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("card relative flex flex-col items-center justify-center overflow-hidden px-6 py-16 text-center animate-fade-up", className)}>
      <div className="orb -left-10 -top-10 h-40 w-40 bg-clay-lavender" />
      <div className="orb -bottom-16 -right-10 h-44 w-44 bg-clay-peach [animation-delay:-5s]" />
      {icon && (
        <div className="clay-tile relative mb-4 h-16 w-16 rounded-[22px] bg-clay-lavender text-clay-lavender-ink animate-pop">
          {icon}
        </div>
      )}
      <h3 className="relative text-xl font-extrabold text-ink">{title}</h3>
      {description && <p className="relative mt-1.5 max-w-md text-sm text-ink-2">{description}</p>}
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-3 text-ink-2 border-transparent",
    brand: "bg-brand-soft text-brand-ink border-transparent",
    success: "bg-success-soft text-success-ink border-transparent",
    warning: "bg-clay-lemon text-clay-lemon-ink border-transparent",
    danger: "bg-danger-soft text-danger-ink border-transparent",
  };
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={clsx("clay-inset inline-flex rounded-full p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-all duration-200",
            o.value === value ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-2 hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Hover tooltip (CSS only). Wrap any element. */
export function Tooltip({ label, side = "right", children }: { label: string; side?: "right" | "top" | "bottom"; children: React.ReactNode }) {
  const pos = {
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  }[side];
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={clsx(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-xl bg-inverse px-2.5 py-1 text-[11px] font-bold text-inverse-fg opacity-0 shadow-[var(--shadow-md)] transition-opacity duration-150 group-hover/tip:opacity-100",
          pos
        )}
      >
        {label}
      </span>
    </span>
  );
}

/** Slim progress bar that flashes across the top on every route change. */
export function RouteProgress() {
  const pathname = usePathname();
  const [key, setKey] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setKey((k) => k + 1);
  }, [pathname]);
  if (key === 0) return null;
  return <div key={key} className="route-progress" aria-hidden />;
}

/** Fades content up when it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("is-visible");
            io.disconnect();
          }
        });
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={clsx("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Animates a number from 0 to its value. */
export function CountUp({ value, duration = 900, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const shown = Math.abs(value) < 100 && !Number.isInteger(value) ? n : Math.round(n);
  return <>{format ? format(shown) : shown.toLocaleString()}</>;
}

export function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} month${mo > 1 ? "s" : ""} ago`;
  return `${Math.floor(mo / 12)} year${mo >= 24 ? "s" : ""} ago`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
