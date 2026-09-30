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
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="landing flex min-h-screen flex-col overflow-x-clip bg-bg text-ink">

      {/* Nav */}
      <header className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4">
        <div className={clsx("mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full bg-surface/90 pl-5 pr-2 backdrop-blur-xl transition-shadow duration-300", scrolled ? "shadow-[var(--shadow-md)]" : "shadow-[var(--shadow-sm)]")}>
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-bold text-ink-2 md:flex">
            {[
              ["#how", "How it works"],
              ["#features", "Features"],
              ["#ai", "Ask AI"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="transition-colors hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {!loading && user ? (
              <Link href="/dashboard" className="btn-dark !h-10 !px-4">
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-full px-3.5 py-2 text-sm font-bold text-ink-2 transition-colors hover:text-ink">
                  Log in
                </Link>
                <Link href="/signup" className="btn-dark !h-10 !px-4">
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ============ HERO ============ */}
        <section className="relative pb-24 pt-32 sm:pt-40">
          {/* floating clay pebbles */}
          <span aria-hidden className="clay-blob animate-float left-[4%] top-40 hidden h-28 w-28 bg-clay-lavender md:block" />
          <span aria-hidden className="clay-blob animate-float right-[6%] top-32 hidden h-20 w-20 bg-clay-peach [animation-delay:-2s] md:block" />
          <span aria-hidden className="clay-blob animate-float left-[14%] top-[520px] hidden h-14 w-14 bg-clay-mint [animation-delay:-4s] lg:block" />
          <span aria-hidden className="clay-blob animate-float right-[15%] top-[470px] hidden h-10 w-10 bg-clay-sky [animation-delay:-3s] lg:block" />

          <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
            <a href="#ai" className="land-in inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pl-1.5 pr-4 text-xs font-bold text-ink-2 shadow-[var(--shadow-sm)] transition-transform hover:-translate-y-0.5 hover:text-ink">
              <span className="rounded-full bg-clay-peach px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-clay-peach-ink">New</span>
              <span className="sm:hidden">Drag, resize & mix data sources</span>
              <span className="hidden sm:inline">Drag, resize and mix data sources in one dashboard</span>
              <ArrowRight className="h-3 w-3" />
            </a>

            <h1 className="land-in mx-auto mt-8 max-w-5xl [text-wrap:balance] text-[44px] font-black leading-[1.02] tracking-[-0.035em] sm:text-7xl lg:text-[82px]" style={{ animationDelay: "80ms" }}>
              Ask your data.
              <br />
              <span className="text-ink-2">
                Watch the <span className="clay-mark">dashboard</span> build itself.
              </span>
            </h1>

            <p className="land-in mx-auto mt-8 max-w-xl text-base font-semibold leading-relaxed text-ink-2 sm:text-lg" style={{ animationDelay: "160ms" }}>
              Drop in a CSV, paste a table or pick a sample. VizPilot&apos;s AI analyst reads your rows, answers in plain English and builds interactive widgets you can drag, resize and share.
            </p>

            <div className="land-in mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "240ms" }}>
              <Link href={cta} className="btn-glow group">
                Build your first dashboard
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="#how" className="btn-light !h-14 !px-7 !text-base">
                See how it works
              </a>
            </div>
            <div className="land-in mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-bold text-ink-3" style={{ animationDelay: "300ms" }}>
              {["Free to start", "No credit card", "Works with text-only data"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span className="clay-tile h-5 w-5 rounded-full bg-clay-mint text-clay-mint-ink"><Check className="h-3 w-3" /></span> {t}
                </span>
              ))}
            </div>
          </div>

          <div className="land-in relative mt-16 px-3 sm:mt-20 sm:px-6" style={{ animationDelay: "380ms" }}>
            <HeroFilm />
          </div>
        </section>

        {/* ============ QUESTION MARQUEE ============ */}
        <section className="relative py-8">
          <div className="marquee-mask overflow-hidden">
            <div className="marquee flex w-max gap-3">
              {[...QUESTIONS, ...QUESTIONS].map((q, i) => (
                <span key={i} className="my-3 inline-flex shrink-0 items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm font-bold text-ink-2 shadow-[var(--shadow-sm)]">
                  <Sparkles className="h-3.5 w-3.5 text-brand" /> {q}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ============ LIGHT CONTENT ============ */}
        <div id="light-zone" className="relative text-ink">
          {/* HOW IT WORKS */}
          <section id="how" className="mx-auto max-w-6xl px-4 pb-10 pt-24 sm:px-6 sm:pt-32">
            <Reveal>
              <p className="eyebrow">How it works</p>
              <h2 className="section-title">
                From a spreadsheet to a <em className="clay-mark">living dashboard</em> in three moves.
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              <Reveal delay={0}>
                <StepCard n="01" title="Bring any data" body="Upload CSV or Excel, paste cells, type values or start from six realistic samples. Types are detected for you.">
                  <div className="relative h-full">
                    {[
                      { icon: FileSpreadsheet, label: "orders_q3.csv", tone: "bg-clay-mint text-clay-mint-ink" },
                      { icon: Table2, label: "Pasted from Sheets", tone: "bg-clay-sky text-clay-sky-ink" },
                      { icon: Database, label: "Support tickets", tone: "bg-clay-peach text-clay-peach-ink" },
                    ].map((f, i) => (
                      <div key={f.label} className="file-chip absolute left-1/2 flex w-[78%] items-center gap-2.5 rounded-full bg-surface py-2 pl-2 pr-3 text-xs font-bold shadow-[var(--shadow-sm)]" style={{ top: 14 + i * 40, animationDelay: `${i * 0.9}s` }}>
                        <span className={clsx("clay-tile h-7 w-7 rounded-full", f.tone)}><f.icon className="h-3.5 w-3.5" /></span> {f.label}
                        <Check className="ml-auto h-3.5 w-3.5 text-success-ink" />
                      </div>
                    ))}
                  </div>
                </StepCard>
              </Reveal>
              <Reveal delay={120}>
                <StepCard n="02" title="Ask in plain English" body="“Revenue by region, top 5.” The AI plans the analysis, computes it from your rows and shows how it built the answer.">
                  <div className="flex h-full flex-col justify-center gap-2 px-5">
                    <div className="clay-tile ml-auto block rounded-[18px] rounded-br-md bg-clay-lavender px-3 py-2 text-xs font-bold text-clay-lavender-ink">Revenue by region, top 5</div>
                    <div className="rounded-[18px] rounded-bl-md bg-surface px-3 py-2 text-xs text-ink-2 shadow-[var(--shadow-sm)]">
                      <div className="mb-1.5 font-bold text-ink">North America leads with 38%</div>
                      <div className="flex h-10 items-end gap-1">
                        {[92, 64, 48, 30, 18].map((h, i) => (
                          <span key={i} className="grow-bar flex-1 rounded-t-[6px] bg-brand" style={{ height: `${h}%`, animationDelay: `${0.15 * i}s` }} />
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
                Every widget is <em className="clay-mark peach">interactive</em>. Every layout is yours.
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
                    <div className="w-full rounded-[22px] bg-clay-lavender p-4 shadow-[var(--clay-inset)]">
                      <div className="text-[10px] font-black uppercase tracking-wider text-clay-lavender-ink">Fastest average resolution</div>
                      <div className="mt-1 font-display text-4xl text-clay-lavender-ink">Priya</div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-ink-2">
                        {["Grouped by Agent", "Averaged hours", "Sorted lowest first"].map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-bold shadow-[var(--shadow-sm)]">
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
                    <div className="clay-inset flex items-center gap-2 rounded-full p-1.5 pl-4">
                      <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-success" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-2">vizpilot.app/share/q3-sales</span>
                      <span className="clay-brand inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold">
                        <Copy className="h-3 w-3" /> Copy
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-ink-3">● Published · updates as you edit</div>
                  </div>
                </Bento>
              </Reveal>

              <Reveal className="md:col-span-6">
                <Bento title="Colour-blind-safe palettes, light and dark" body="Every palette is validated for colour-vision deficiency and contrast, with its own dark-mode steps." icon={<Sparkles className="h-4 w-4" />} row>
                  <div className="grid w-full gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                    {PALETTES.map((p, pi) => (
                      <div key={p.id} className="rounded-[22px] bg-surface p-3 shadow-[var(--card-shadow)]">
                        <div className="flex h-16 items-end gap-1">
                          {p.colors.slice(0, 6).map((c, i) => (
                            <span key={c + i} className="grow-bar flex-1 rounded-t-[8px]" style={{ background: c, height: `${[70, 95, 55, 80, 40, 62][i]}%`, animationDelay: `${pi * 0.12 + i * 0.06}s` }} />
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="font-extrabold">{p.label}</span>
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
            <div className="clay grid items-center gap-10 rounded-[36px] p-6 sm:p-10 md:grid-cols-2">
              <Reveal>
                <p className="eyebrow">Ask AI</p>
                <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  An analyst that <em className="clay-mark mint">shows its work</em>.
                </h2>
                <ul className="mt-6 space-y-3 text-sm font-semibold text-ink-2">
                  {[
                    "Understands filters, comparisons and follow-ups – “only Europe”, “make it monthly”.",
                    "Computes every number from your rows, never guessed.",
                    "Explains each step: grouping, maths, sorting.",
                    "Picks the right data source for the question on its own.",
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <span className="clay-tile mt-0.5 h-5 w-5 shrink-0 rounded-full bg-clay-mint text-clay-mint-ink">
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
        <section className="px-3 pb-10 sm:px-6">
          <div className="clay-tile relative mx-auto block max-w-6xl overflow-hidden rounded-[40px] bg-clay-lavender px-4 py-24 text-center sm:px-6">
          <span aria-hidden className="clay-blob animate-float -left-8 -top-8 h-40 w-40 bg-clay-sky" />
          <span aria-hidden className="clay-blob animate-float -bottom-10 right-[8%] h-32 w-32 bg-clay-peach [animation-delay:-3s]" />
          <span aria-hidden className="clay-blob animate-float right-[22%] top-8 hidden h-12 w-12 bg-clay-mint [animation-delay:-1.5s] sm:block" />
          <Reveal className="relative">
            <h2 className="mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.03em] text-ink sm:text-6xl">
              Your first dashboard
              <br />
              <span className="text-clay-lavender-ink">before your coffee cools.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md font-semibold text-ink-2">Bring a CSV or just use a sample. Free to start.</p>
            <Link href={cta} className="btn-glow group mt-9">
              Start for free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm font-semibold text-ink-3 sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} VizPilot. Built with Next.js, MongoDB and Firebase.</p>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StepCard({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="card card-hover group flex h-full flex-col overflow-hidden rounded-[30px]">
      <div className="relative m-2.5 mb-0 h-44 overflow-hidden rounded-[24px] bg-surface-2 shadow-[var(--clay-inset)]">{children}</div>
      <div className="p-6">
        <div className="font-display inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-clay-lavender px-2.5 text-lg text-clay-lavender-ink shadow-[var(--shadow-sm)]">{n}</div>
        <h3 className="mt-3 text-lg font-black tracking-tight">{title}</h3>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-ink-2">{body}</p>
      </div>
    </div>
  );
}

function Bento({ title, body, icon, children, dark, row }: { title: string; body: string; icon: React.ReactNode; children: React.ReactNode; dark?: boolean; row?: boolean }) {
  return (
    <div
      className={clsx(
        "card card-hover group flex h-full overflow-hidden rounded-[30px]",
        row ? "flex-col lg:flex-row lg:items-center" : "flex-col",
        dark && "!bg-clay-lavender"
      )}
    >
      <div className={clsx("p-6", row && "lg:w-80 lg:shrink-0")}>
        <span className={clsx("clay-tile h-10 w-10 rounded-[14px]", dark ? "bg-surface text-clay-lavender-ink" : "bg-clay-lavender text-clay-lavender-ink")}>{icon}</span>
        <h3 className={clsx("mt-4 text-lg font-black tracking-tight", dark && "text-clay-lavender-ink")}>{title}</h3>
        <p className={clsx("mt-1.5 text-sm font-semibold leading-relaxed", dark ? "text-clay-lavender-ink" : "text-ink-2")}>{body}</p>
      </div>
      <div className={clsx("relative min-h-[150px] flex-1", row && "w-full")}>{children}</div>
    </div>
  );
}

/** Tiny dashboard where blocks trade places on a loop (pure CSS). */
function MiniGrid({ big }: { big?: boolean }) {
  return (
    <div className={clsx("mini-grid absolute inset-0", big ? "m-6 mt-0" : "m-4")}>
      <div className={clsx("mg-a mg-block", big ? "bg-surface" : "bg-clay-lavender")}>
        <span className="mg-line" />
      </div>
      <div className="mg-b mg-block bg-clay-peach" />
      <div className="mg-c mg-block bg-clay-mint" />
      <div className="mg-d mg-block bg-clay-lemon" />
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
          <span key={s.label} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1.5 text-[11px] font-bold shadow-[var(--shadow-sm)]">
            <s.icon className="h-3.5 w-3.5" style={{ color: s.c }} /> {s.label}
          </span>
        ))}
      </div>
      <svg viewBox="0 0 60 90" className="h-24 w-12 shrink-0" aria-hidden>
        {[15, 45, 75].map((y, i) => (
          <path key={y} d={`M0 ${y} C 30 ${y}, 30 45, 60 45`} fill="none" stroke={src[i].c} strokeWidth="1.5" className="flow-dash" style={{ animationDelay: `${i * 0.3}s` }} />
        ))}
      </svg>
      <div className="grid h-24 w-24 shrink-0 grid-cols-2 gap-1.5 rounded-[20px] bg-surface p-2 shadow-[var(--card-shadow)]">
        {src.map((s) => (
          <span key={s.label} className="clay-tile rounded-[10px]" style={{ background: s.c }} />
        ))}
        <span className="clay-tile rounded-[10px] bg-brand" />
      </div>
    </div>
  );
}

function FallbackChain() {
  const list = [
    { name: "Groq", state: "Rate limited", tone: "text-clay-lemon-ink", dot: "bg-warning" },
    { name: "Gemini", state: "Busy (503)", tone: "text-clay-lemon-ink", dot: "bg-warning" },
    { name: "Mistral", state: "Answered · 0.8s", tone: "text-success-ink", dot: "bg-success" },
    { name: "GitHub Models", state: "Standby", tone: "text-ink-3", dot: "bg-border-strong" },
  ];
  return (
    <div className="relative flex h-full flex-col justify-center px-5 pb-5">
      <div className="relative flex flex-col gap-1.5">
        {/* the "request" travelling down the chain */}
        <span className="chain-scan pointer-events-none absolute inset-x-0 top-0 h-[calc((100%-18px)/4)] rounded-full ring-2 ring-brand/50" />
        {list.map((p) => (
          <div key={p.name} className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[11px] font-semibold shadow-[var(--shadow-sm)]">
            <span className={clsx("h-1.5 w-1.5 rounded-full", p.dot)} />
            <span className="font-extrabold">{p.name}</span>
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
    <div className="clay-inset relative rounded-[28px] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
        <span className="clay-brand flex h-7 w-7 items-center justify-center rounded-full">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        Ask AI
        <span className="rounded-full bg-clay-lemon px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-clay-lemon-ink">Beta</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-ink-2 shadow-[var(--shadow-sm)]">
          <Database className="h-3 w-3 text-brand" /> Support tickets
        </span>
      </div>
      <div className="space-y-3">
        <div className="clay-tile ml-auto block w-fit rounded-[18px] rounded-br-md bg-clay-lavender px-3 py-2 text-xs font-bold text-clay-lavender-ink">How many tickets per priority?</div>
        <div className="rounded-[20px] rounded-bl-md bg-surface p-3 text-xs shadow-[var(--card-shadow)]">
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
                <span className="grow-x h-3 rounded-r-full bg-brand" style={{ width: `${v}%`, animationDelay: `${1.2 + i * 0.12}s` }} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t pt-2 text-[10px] text-ink-3">
            <span>groq · 0.9s</span>
            <span className="clay-brand rounded-full px-2.5 py-1 font-extrabold">+ Add to dashboard</span>
          </div>
        </div>
      </div>
    </div>
  );
}
