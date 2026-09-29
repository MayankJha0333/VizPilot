"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ArrowRight, Check, Copy, Database, FileSpreadsheet, Globe, Hash, MousePointer2, Sparkles, Table2, Upload } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Logo, Reveal } from "@/components/ui/misc";
import { HeroFilm } from "@/components/marketing/HeroFilm";
import { PALETTES } from "@/lib/charts/types";

const QUESTIONS = [
  "Which region grew fastest last quarter?",
  "Revenue by category, top 5",
  "How many tickets per priority?",
  "Show churn rate over time",
  "Average resolution hours by agent",
  "Spend vs revenue by platform",
  "What stands out in this data?",
  "Monthly signups as a line",
  "Share of orders by channel as a donut",
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const cta = user ? "/dashboard" : "/signup";
  const [scrolled, setScrolled] = useState(false);
  const [onLight, setOnLight] = useState(false);
  useEffect(() => {
    const on = () => {
      setScrolled(window.scrollY > 24);
      // Is the nav currently over the light middle section?
      const light = document.getElementById("light-zone")?.getBoundingClientRect();
      setOnLight(!!light && light.top <= 64 && light.bottom > 64);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="landing flex min-h-screen flex-col bg-[#0b0f1e]">
      {/* Display serif – loaded at runtime; falls back to Georgia offline. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- display font is only used on this page */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" precedence="default" />

      {/* Nav */}
      <header
        className={clsx(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          onLight ? "border-b border-black/5 bg-white/80 backdrop-blur-xl" : scrolled ? "border-b border-white/10 bg-[#0b0f1e]/80 backdrop-blur-xl" : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo dark={!onLight} />
          <nav className={clsx("hidden items-center gap-8 text-sm md:flex", onLight ? "text-ink-2" : "text-white/60")}>
            {[
              ["#how", "How it works"],
              ["#features", "Features"],
              ["#ai", "Ask AI"],
            ].map(([href, label]) => (
              <a key={href} href={href} className={clsx("transition-colors", onLight ? "hover:text-ink" : "hover:text-white")}>
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {!loading && user ? (
              <Link href="/dashboard" className={onLight ? "btn-dark !h-9 !px-3.5" : "btn-light"}>
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link href="/login" className={clsx("rounded-lg px-3 py-2 text-sm font-medium transition-colors", onLight ? "text-ink-2 hover:text-ink" : "text-white/70 hover:text-white")}>
                  Log in
                </Link>
                <Link href="/signup" className={onLight ? "btn-dark !h-9 !px-3.5" : "btn-light"}>
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ============ HERO ============ */}
        <section className="relative overflow-hidden pb-24 pt-32 text-white sm:pt-40">
          <div className="hero-aurora pointer-events-none absolute inset-0" />
          <div className="hero-grid pointer-events-none absolute inset-0" />
          <div className="noise pointer-events-none absolute inset-0 opacity-[0.35]" />

          <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
            <a href="#ai" className="land-in inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-xs text-white/70 backdrop-blur transition-colors hover:border-white/25 hover:text-white">
              <span className="rounded-full bg-[#eb6834] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">New</span>
              <span className="sm:hidden">Drag, resize & mix data sources</span>
              <span className="hidden sm:inline">Drag, resize and mix data sources in one dashboard</span>
              <ArrowRight className="h-3 w-3" />
            </a>

            <h1 className="land-in mx-auto mt-7 max-w-5xl [text-wrap:balance] text-[44px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-7xl lg:text-[84px]" style={{ animationDelay: "80ms" }}>
              Ask your data.
              <br />
              <span className="font-display font-normal italic tracking-[-0.01em] text-white/90">
                Watch the <span className="shimmer-text">dashboard</span> build itself.
              </span>
            </h1>

            <p className="land-in mx-auto mt-7 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg" style={{ animationDelay: "160ms" }}>
              Drop in a CSV, paste a table or pick a sample. VizPilot&apos;s AI analyst reads your rows, answers in plain English and builds interactive widgets you can drag, resize and share.
            </p>

            <div className="land-in mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "240ms" }}>
              <Link href={cta} className="btn-glow group">
                Build your first dashboard
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="#how" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white">
                See how it works
              </a>
            </div>
            <div className="land-in mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/45" style={{ animationDelay: "300ms" }}>
              {["Free to start", "No credit card", "Works with text-only data"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#1baf7a]" /> {t}
                </span>
              ))}
            </div>
          </div>

          <div className="land-in relative mt-16 px-3 sm:mt-20 sm:px-6" style={{ animationDelay: "380ms" }}>
            <HeroFilm />
          </div>
        </section>

        {/* ============ QUESTION MARQUEE ============ */}
        <section className="relative border-y border-white/[0.07] bg-[#0d1224] py-6">
          <div className="marquee-mask overflow-hidden">
            <div className="marquee flex w-max gap-3">
              {[...QUESTIONS, ...QUESTIONS].map((q, i) => (
                <span key={i} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/65">
                  <Sparkles className="h-3.5 w-3.5 text-[#7b8cf0]" /> {q}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ============ LIGHT CONTENT ============ */}
        <div id="light-zone" className="relative bg-[#f4f5f8] text-ink">
          {/* HOW IT WORKS */}
          <section id="how" className="mx-auto max-w-6xl px-4 pb-10 pt-24 sm:px-6 sm:pt-32">
            <Reveal>
              <p className="eyebrow">How it works</p>
              <h2 className="section-title">
                From a spreadsheet to a <em className="font-display font-normal">living dashboard</em> in three moves.
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              <Reveal delay={0}>
                <StepCard n="01" title="Bring any data" body="Upload CSV or Excel, paste cells, type values or start from six realistic samples. Types are detected for you.">
                  <div className="relative h-full">
                    {[
                      { icon: FileSpreadsheet, label: "orders_q3.csv", tone: "text-[#1baf7a]" },
                      { icon: Table2, label: "Pasted from Sheets", tone: "text-[#2a78d6]" },
                      { icon: Database, label: "Support tickets", tone: "text-[#eb6834]" },
                    ].map((f, i) => (
                      <div key={f.label} className="file-chip absolute left-1/2 flex w-[78%] items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-xs font-medium shadow-[var(--shadow-sm)]" style={{ top: 14 + i * 40, animationDelay: `${i * 0.9}s` }}>
                        <f.icon className={clsx("h-4 w-4", f.tone)} /> {f.label}
                        <Check className="ml-auto h-3.5 w-3.5 text-success" />
                      </div>
                    ))}
                  </div>
                </StepCard>
              </Reveal>
              <Reveal delay={120}>
                <StepCard n="02" title="Ask in plain English" body="“Revenue by region, top 5.” The AI plans the analysis, computes it from your rows and shows how it built the answer.">
                  <div className="flex h-full flex-col justify-center gap-2 px-5">
                    <div className="ml-auto rounded-2xl rounded-br-md bg-brand px-3 py-2 text-xs text-white">Revenue by region, top 5</div>
                    <div className="rounded-2xl rounded-bl-md border bg-white px-3 py-2 text-xs text-ink-2 shadow-[var(--shadow-sm)]">
                      <div className="mb-1.5 font-medium text-ink">North America leads with 38%</div>
                      <div className="flex h-10 items-end gap-1">
                        {[92, 64, 48, 30, 18].map((h, i) => (
                          <span key={i} className="grow-bar flex-1 rounded-t-[3px] bg-brand" style={{ height: `${h}%`, animationDelay: `${0.15 * i}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </StepCard>
              </Reveal>
              <Reveal delay={240}>
                <StepCard n="03" title="Arrange & share" body="Drag widgets anywhere, resize from the corner, switch themes, then publish a live read-only link.">
                  <MiniGrid />
                </StepCard>
              </Reveal>
            </div>
          </section>

          {/* FEATURES BENTO */}
          <section id="features" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <Reveal>
              <p className="eyebrow">Built like a real analytics tool</p>
              <h2 className="section-title">
                Every widget is <em className="font-display font-normal">interactive</em>. Every layout is yours.
              </h2>
            </Reveal>

            <div className="mt-14 grid auto-rows-[minmax(230px,auto)] gap-5 md:grid-cols-6">
              <Reveal className="md:col-span-4">
                <Bento title="A dashboard you arrange like a canvas" body="Drag by the title, resize from any edge. Neighbours glide out of the way and the layout saves itself." icon={<MousePointer2 className="h-4 w-4" />} dark>
                  <MiniGrid big />
                </Bento>
              </Reveal>
              <Reveal delay={100} className="md:col-span-2">
                <Bento title="Many sources, one view" body="Each widget picks its own data – orders next to tickets next to ad spend." icon={<Database className="h-4 w-4" />}>
                  <SourceFlow />
                </Bento>
              </Reveal>

              <Reveal delay={0} className="md:col-span-2">
                <Bento title="Answers, not just charts" body="Ask “which agent closes fastest?” and get the number, the chart and the steps." icon={<Hash className="h-4 w-4" />}>
                  <div className="flex h-full items-center px-5 pb-5">
                    <div className="w-full rounded-2xl border bg-gradient-to-br from-brand-soft to-white p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Fastest average resolution</div>
                      <div className="mt-1 font-display text-4xl text-brand-ink">Priya</div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-ink-2">
                        {["Grouped by Agent", "Averaged hours", "Sorted lowest first"].map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 shadow-[var(--shadow-sm)]">
                            <Check className="h-2.5 w-2.5 text-success" /> {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Bento>
              </Reveal>
              <Reveal delay={100} className="md:col-span-2">
                <Bento title="Never stuck on one AI" body="Seven providers in a chain. If one is down or rate-limited, the next answers – you won't notice." icon={<Sparkles className="h-4 w-4" />}>
                  <FallbackChain />
                </Bento>
              </Reveal>
              <Reveal delay={200} className="md:col-span-2">
                <Bento title="Share a live link" body="Publish read-only, present full-screen, or export any widget as PNG or CSV." icon={<Globe className="h-4 w-4" />}>
                  <div className="flex h-full flex-col justify-center gap-2.5 px-5 pb-5">
                    <div className="flex items-center gap-2 rounded-xl border bg-white p-1.5 pl-3 shadow-[var(--shadow-sm)]">
                      <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-success" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-2">vizpilot.app/share/q3-sales</span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-ink px-2 py-1 text-[10px] font-medium text-white">
                        <Copy className="h-3 w-3" /> Copy
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-3">● Published · updates as you edit</div>
                  </div>
                </Bento>
              </Reveal>

              <Reveal className="md:col-span-6">
                <Bento title="Colour-blind-safe palettes, light and dark" body="Every palette is validated for colour-vision deficiency and contrast, with its own dark-mode steps." icon={<Sparkles className="h-4 w-4" />} row>
                  <div className="grid w-full gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                    {PALETTES.map((p, pi) => (
                      <div key={p.id} className="rounded-2xl border bg-white p-3 shadow-[var(--shadow-sm)]">
                        <div className="flex h-16 items-end gap-1">
                          {p.colors.slice(0, 6).map((c, i) => (
                            <span key={c + i} className="grow-bar flex-1 rounded-t-[4px]" style={{ background: c, height: `${[70, 95, 55, 80, 40, 62][i]}%`, animationDelay: `${pi * 0.12 + i * 0.06}s` }} />
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="font-medium">{p.label}</span>
                          <span className="text-ink-3">{p.hint}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Bento>
              </Reveal>
            </div>
          </section>

          {/* ASK AI SPOTLIGHT */}
          <section id="ai" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
            <div className="grid items-center gap-10 rounded-[32px] border bg-white p-6 shadow-[var(--shadow-md)] sm:p-10 md:grid-cols-2">
              <Reveal>
                <p className="eyebrow">Ask AI</p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                  An analyst that <em className="font-display font-normal">shows its work</em>.
                </h2>
                <ul className="mt-6 space-y-3 text-sm text-ink-2">
                  {[
                    "Understands filters, comparisons and follow-ups – “only Europe”, “make it monthly”.",
                    "Computes every number from your rows, never guessed.",
                    "Explains each step: grouping, maths, sorting.",
                    "Picks the right data source for the question on its own.",
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                        <Check className="h-3 w-3" />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
                <Link href={cta} className="btn-dark mt-8">
                  Try it on a sample <ArrowRight className="h-4 w-4" />
                </Link>
              </Reveal>
              <Reveal delay={120}>
                <AskDemo />
              </Reveal>
            </div>
          </section>
        </div>

        {/* ============ CTA ============ */}
        <section className="relative overflow-hidden bg-[#0b0f1e] px-4 py-28 text-center text-white sm:px-6">
          <div className="hero-aurora pointer-events-none absolute inset-0 opacity-80" />
          <div className="hero-grid pointer-events-none absolute inset-0" />
          <Reveal className="relative">
            <h2 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl">
              Your first dashboard
              <br />
              <span className="font-display font-normal italic text-white/85">before your coffee cools.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-white/55">Bring a CSV or just use a sample. Free to start.</p>
            <Link href={cta} className="btn-glow group mt-9">
              Start for free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0b0f1e]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-white/40 sm:flex-row sm:px-6">
          <Logo dark />
          <p>© {new Date().getFullYear()} VizPilot. Built with Next.js, MongoDB and Firebase.</p>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StepCard({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-[26px] border bg-white shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]">
      <div className="relative h-44 overflow-hidden border-b bg-[#f7f8fb] bg-dots">{children}</div>
      <div className="p-6">
        <div className="font-display text-3xl italic text-brand">{n}</div>
        <h3 className="mt-1 text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
      </div>
    </div>
  );
}

function Bento({ title, body, icon, children, dark, row }: { title: string; body: string; icon: React.ReactNode; children: React.ReactNode; dark?: boolean; row?: boolean }) {
  return (
    <div
      className={clsx(
        "group flex h-full overflow-hidden rounded-[26px] border transition-all duration-300 hover:-translate-y-1",
        row ? "flex-col lg:flex-row lg:items-center" : "flex-col",
        dark ? "border-white/10 bg-[#0b0f1e] text-white hover:shadow-[0_30px_60px_-30px_rgba(11,15,30,0.7)]" : "bg-white shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]"
      )}
    >
      <div className={clsx("p-6", row && "lg:w-80 lg:shrink-0")}>
        <span className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", dark ? "bg-white/10 text-[#9aa6f5]" : "bg-brand-soft text-brand")}>{icon}</span>
        <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
        <p className={clsx("mt-1.5 text-sm leading-relaxed", dark ? "text-white/55" : "text-ink-2")}>{body}</p>
      </div>
      <div className={clsx("relative min-h-[150px] flex-1", row && "w-full")}>{children}</div>
    </div>
  );
}

/** Tiny dashboard where blocks trade places on a loop (pure CSS). */
function MiniGrid({ big }: { big?: boolean }) {
  return (
    <div className={clsx("mini-grid absolute inset-0", big ? "m-6 mt-0" : "m-4")}>
      <div className={clsx("mg-a mg-block", big ? "bg-[#4c5fd5]" : "bg-brand")}>
        <span className="mg-line" />
      </div>
      <div className="mg-b mg-block bg-[#eb6834]" />
      <div className="mg-c mg-block bg-[#1baf7a]" />
      <div className="mg-d mg-block bg-[#eda100]" />
      <span className="mg-cursor">
        <MousePointer2 className="h-4 w-4 fill-white text-ink" />
      </span>
    </div>
  );
}

function SourceFlow() {
  const src = [
    { label: "orders.csv", icon: FileSpreadsheet, c: "#1baf7a" },
    { label: "tickets", icon: Database, c: "#eb6834" },
    { label: "ad spend", icon: Upload, c: "#2a78d6" },
  ];
  return (
    <div className="relative flex h-full items-center justify-between gap-2 px-5 pb-5">
      <div className="flex flex-col gap-2">
        {src.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 text-[11px] font-medium shadow-[var(--shadow-sm)]">
            <s.icon className="h-3.5 w-3.5" style={{ color: s.c }} /> {s.label}
          </span>
        ))}
      </div>
      <svg viewBox="0 0 60 90" className="h-24 w-12 shrink-0" aria-hidden>
        {[15, 45, 75].map((y, i) => (
          <path key={y} d={`M0 ${y} C 30 ${y}, 30 45, 60 45`} fill="none" stroke={src[i].c} strokeWidth="1.5" className="flow-dash" style={{ animationDelay: `${i * 0.3}s` }} />
        ))}
      </svg>
      <div className="grid h-24 w-24 shrink-0 grid-cols-2 gap-1 rounded-xl border bg-white p-1.5 shadow-[var(--shadow-md)]">
        {src.map((s) => (
          <span key={s.label} className="rounded-md opacity-80" style={{ background: s.c }} />
        ))}
        <span className="rounded-md bg-[#4c5fd5] opacity-80" />
      </div>
    </div>
  );
}

function FallbackChain() {
  const list = [
    { name: "Groq", state: "Rate limited", tone: "text-[#c98500]", dot: "bg-[#eda100]" },
    { name: "Gemini", state: "Busy (503)", tone: "text-[#c98500]", dot: "bg-[#eda100]" },
    { name: "Mistral", state: "Answered · 0.8s", tone: "text-success", dot: "bg-success" },
    { name: "GitHub Models", state: "Standby", tone: "text-ink-3", dot: "bg-border-strong" },
  ];
  return (
    <div className="relative flex h-full flex-col justify-center px-5 pb-5">
      <div className="relative flex flex-col gap-1.5">
        {/* the "request" travelling down the chain */}
        <span className="chain-scan pointer-events-none absolute inset-x-0 top-0 h-[calc((100%-18px)/4)] rounded-lg ring-2 ring-brand/50" />
        {list.map((p) => (
          <div key={p.name} className="flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-sm)]">
            <span className={clsx("h-1.5 w-1.5 rounded-full", p.dot)} />
            <span className="font-medium">{p.name}</span>
            <span className={clsx("ml-auto", p.tone)}>{p.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A looping Ask AI exchange rendered with plain HTML. */
function AskDemo() {
  return (
    <div className="relative rounded-[24px] border bg-[#f7f8fb] p-4 shadow-inner">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
        <span className="gradient-brand flex h-6 w-6 items-center justify-center rounded-md text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        Ask AI
        <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-ink">Beta</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-md border bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-2">
          <Database className="h-3 w-3 text-brand" /> Support tickets
        </span>
      </div>
      <div className="space-y-3">
        <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-brand px-3 py-2 text-xs text-white">How many tickets per priority?</div>
        <div className="rounded-2xl rounded-bl-md border bg-white p-3 text-xs shadow-[var(--shadow-sm)]">
          <p className="text-ink">
            <strong>Medium</strong> is the most common priority with 104 tickets (40%).
          </p>
          <div className="mt-2 space-y-1 text-[11px] text-ink-2">
            {["Grouped by Priority (4 values)", "Counted tickets in each group", "Sorted largest first"].map((s, i) => (
              <div key={s} className="step-in flex items-center gap-1.5" style={{ animationDelay: `${0.3 + i * 0.35}s` }}>
                <Check className="h-3 w-3 text-success" /> {s}
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {[
              ["Medium", 100],
              ["Low", 88],
              ["High", 50],
              ["Urgent", 12],
            ].map(([l, v], i) => (
              <div key={l as string} className="flex items-center gap-2">
                <span className="w-12 text-[10px] text-ink-3">{l}</span>
                <span className="grow-x h-3 rounded-r-[4px] bg-brand" style={{ width: `${v}%`, animationDelay: `${1.2 + i * 0.12}s` }} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t pt-2 text-[10px] text-ink-3">
            <span>groq · 0.9s</span>
            <span className="rounded-md bg-brand px-2 py-1 font-medium text-white">+ Add to dashboard</span>
          </div>
        </div>
      </div>
    </div>
  );
}
