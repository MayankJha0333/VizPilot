"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Check, FileSpreadsheet, Share2, Sparkles, Upload, Wand2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Logo, Reveal } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const cta = user ? "/dashboard" : "/signup";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-ink-2 md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#charts" className="hover:text-ink">Charts</a>
          </nav>
          <div className="flex items-center gap-2">
            {!loading && user ? (
              <Link href="/dashboard">
                <Button size="sm">Open dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink">
                  Log in
                </Link>
                <Link href="/signup">
                  <Button size="sm">Sign up free</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="hero-glow bg-dots relative overflow-hidden">
          <div className="orb left-[8%] top-24 h-64 w-64 bg-brand/40" />
          <div className="orb right-[6%] top-40 h-72 w-72 bg-brand-3/30 [animation-delay:-7s]" />
          <div className="orb bottom-10 left-1/2 h-56 w-56 bg-success/20 [animation-delay:-3s]" />
          <div className="stagger stagger-auto relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
            <span className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs font-medium text-ink-2 shadow-[var(--shadow-sm)]">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> New · An AI analyst that builds your charts
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Ask your data a question. <span className="gradient-text">Get the chart.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-ink-2">
              Upload a CSV or paste a table. VizPilot&apos;s AI analyst understands your question, analyses the rows and builds interactive widgets — then you share the report with a link.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={cta}>
                <Button size="lg">
                  Start for free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="outline">
                  See how it works
                </Button>
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-3">
              <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success" /> No credit card</span>
              <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success" /> 10 chart types</span>
              <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success" /> Share with a link</span>
            </div>

            <HeroPreview />
          </div>
        </section>

        {/* Benefits */}
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="card flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-4 text-sm text-ink-2">
            {["Actionable insights", "No ambiguity", "Fewer meetings", "Faster decisions", "Less back & forth", "Stronger alignment"].map((b) => (
              <span key={b} className="inline-flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white">
                  <Check className="h-2.5 w-2.5" />
                </span>
                {b}
              </span>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-2">Three steps from a spreadsheet to a report you&apos;re proud to send.</p>
          <div className="mt-12 space-y-6">
            <Reveal><Step
              n={1}
              title="Add your data"
              accent="Add"
              body="Upload a CSV or Excel file, paste cells straight from a spreadsheet, type values by hand, or start with a sample dataset. VizPilot detects column types for you."
              icon={<Upload className="h-5 w-5" />}
            /></Reveal>
            <Reveal delay={80}><Step
              n={2}
              title="Let AI build the charts"
              accent="Let AI"
              body="We suggest the charts that fit your columns. Or describe what you want — “revenue by region, top 5” — and Ask AI turns it into a chart, with a plain-English note on how it got there."
              icon={<Wand2 className="h-5 w-5" />}
            /></Reveal>
            <Reveal delay={160}><Step
              n={3}
              title="Polish and share"
              accent="Polish"
              body="Tweak colours, palettes and labels, add notes, then publish a read-only link or download a PNG. Your report stays live as you edit."
              icon={<Share2 className="h-5 w-5" />}
            /></Reveal>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-y bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">Everything you need, nothing you don&apos;t</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: FileSpreadsheet, title: "Any table in", body: "CSV, Excel, pasted cells or typed values — we clean it up and detect numbers, dates and categories." },
                { icon: BarChart3, title: "10 chart types", body: "Column, bar, stacked, line, area, pie, donut, scatter, KPI tiles and tables — all with one click." },
                { icon: Sparkles, title: "Ask AI", body: "“Revenue by region, top 5” — describe it, refine it, add it. Works with text-only data too." },
                { icon: Wand2, title: "Auto-suggested reports", body: "Turn a dataset into a first draft report instantly, then edit any chart." },
                { icon: Share2, title: "Share & export", body: "Publish a public link, duplicate reports, download charts as PNG." },
                { icon: Check, title: "Yours, securely", body: "Sign in with Google or email. Your data lives in your own MongoDB." },
              ].map((f, i) => (
                <Reveal key={f.title} delay={i * 60}>
                  <div className="card card-hover group h-full p-6">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[-4deg]">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="mt-1.5 text-sm text-ink-2">{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Chart types */}
        <section id="charts" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Chart types</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {["Column", "Bar", "Stacked", "Line", "Area", "Pie", "Donut", "Scatter", "KPI", "Table"].map((c, i) => (
              <Reveal key={c} delay={i * 40}>
                <span className="inline-block rounded-full border bg-surface px-4 py-1.5 text-sm text-ink-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:text-brand">{c}</span>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center text-white">
            <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-pink-500/30 blur-3xl" />
            <h2 className="relative text-3xl font-semibold tracking-tight">Your first report in under five minutes</h2>
            <p className="relative mx-auto mt-3 max-w-md text-white/70">Bring a CSV or just use a sample. You&apos;ll have charts before the kettle boils.</p>
            <Link href={cta} className="relative mt-8 inline-block">
              <Button size="lg" variant="outline" className="border-white/20 bg-white text-ink hover:bg-white/90">
                Start for free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-ink-3 sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} VizPilot. Built with Next.js, MongoDB and Firebase.</p>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, accent, body, icon }: { n: number; title: string; accent: string; body: string; icon: React.ReactNode }) {
  const rest = title.replace(accent, "").trim();
  return (
    <div className="mx-auto flex max-w-3xl gap-4 sm:gap-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-2xl font-semibold text-ink sm:h-16 sm:w-16 sm:text-3xl">{n}</div>
      <div className="card flex-1 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">{icon}</span>
          <h3 className="text-xl font-semibold">
            <span className="text-brand">{accent}</span> {rest}
          </h3>
        </div>
        <p className="mt-3 text-ink-2">{body}</p>
      </div>
    </div>
  );
}

function HeroPreview() {
  const bars = [42, 58, 51, 70, 66, 84, 79, 96];
  const line = [30, 44, 38, 60, 54, 72, 68, 90];
  const w = 320;
  const h = 120;
  const pts = line.map((v, i) => `${(i / (line.length - 1)) * w},${h - (v / 100) * h}`).join(" ");
  return (
    <div className="relative mx-auto mt-14 max-w-4xl">
      <div className="card overflow-hidden text-left shadow-[var(--shadow-lg)] animate-scale-in" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center gap-2 border-b bg-surface-2 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="ml-3 text-xs text-ink-3">Q3 growth report</span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-6">
          <div className="rounded-xl border p-4 sm:col-span-2">
            <div className="text-sm font-semibold">Monthly revenue</div>
            <div className="text-xs text-ink-3">Jan – Aug 2025</div>
            <div className="mt-4 flex h-32 items-end gap-2">
              {bars.map((b, i) => (
                <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-brand to-[#8f8ff0] animate-grow-bar" style={{ height: `${b}%`, animationDelay: `${300 + i * 70}ms` }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border p-4">
              <div className="text-xs text-ink-3">New customers</div>
              <div className="mt-1 text-2xl font-semibold">1,284</div>
              <div className="text-xs font-medium text-success">↑ 18% vs last quarter</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-ink-3">Signups trend</div>
              <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-14 w-full" preserveAspectRatio="none">
                <polyline points={pts} fill="none" stroke="#F472B6" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" className="animate-draw" style={{ animationDelay: "600ms" }} />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute -left-10 top-40 hidden rotate-[-6deg] rounded-2xl border bg-surface px-4 py-3 text-xs shadow-[var(--shadow-md)] animate-float md:block" style={{ "--rot": "-6deg" } as React.CSSProperties}>
        <div className="font-semibold">Ask AI</div>
        <div className="text-ink-3">“revenue by region, top 5”</div>
      </div>
      <div className="pointer-events-none absolute -right-6 bottom-8 hidden rotate-[5deg] rounded-2xl border bg-surface px-4 py-3 text-xs shadow-[var(--shadow-md)] animate-float md:block" style={{ "--rot": "5deg", animationDelay: "-3s" } as React.CSSProperties}>
        <div className="font-semibold text-success">● Published</div>
        <div className="text-ink-3">vizpilot.app/share/…</div>
      </div>
    </div>
  );
}
