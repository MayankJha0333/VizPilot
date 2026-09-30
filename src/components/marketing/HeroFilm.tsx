"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { ArrowUp, BarChart3, Database, Home, LayoutGrid, Settings, Sparkles } from "lucide-react";
import { Widget } from "@/components/charts/Widget";
import { getSample } from "@/lib/data/samples";
import { DEFAULT_CONFIG, type ChartConfig, type ChartRecord } from "@/lib/charts/types";

/**
 * The hero's "product film": a real VizPilot dashboard that builds itself.
 * An Ask AI prompt types out, the AI "thinks", and a real widget (rendered by
 * the same chart engine as the app, on the sample e-commerce data) drops in.
 */

interface Scene {
  prompt: string;
  title: string;
  subtitle: string;
  config: Partial<ChartConfig>;
  area: string; // CSS grid-area
  mobile?: boolean;
}

const SCENES: Scene[] = [
  { prompt: "How has revenue changed this year?", title: "Revenue over time", subtitle: "Monthly, Jan – Sep 2025", config: { type: "area", xKey: "Order date", yKeys: ["Revenue"], timeBucket: "month" }, area: "1 / 3 / 2 / 7", mobile: true },
  { prompt: "Total revenue", title: "Total revenue", subtitle: "All orders", config: { type: "kpi", xKey: "Order date", yKeys: ["Revenue"] }, area: "1 / 1 / 2 / 3", mobile: true },
  { prompt: "Top categories as bars", title: "Revenue by category", subtitle: "Ranked", config: { type: "bar", xKey: "Category", yKeys: ["Revenue"], sort: "desc" }, area: "2 / 1 / 3 / 4" },
  { prompt: "Share by channel as a donut", title: "Revenue by channel", subtitle: "Share of total", config: { type: "donut", xKey: "Channel", yKeys: ["Revenue"], sort: "desc" }, area: "2 / 4 / 3 / 7" },
];

type Phase = { i: number; step: "typing" | "thinking" | "shown" | "hold" | "reset"; chars: number };

export function HeroFilm() {
  const data = useMemo(() => getSample("ecommerce-orders")!, []);
  const charts: ChartRecord[] = useMemo(
    () =>
      SCENES.map((s, i) => ({
        _id: `film-${i}`,
        reportId: "",
        datasetId: "",
        title: s.title,
        subtitle: s.subtitle,
        note: "",
        config: { ...DEFAULT_CONFIG, aggregate: "sum", palette: "aurora", ...s.config } as ChartConfig,
        size: "half",
        order: i,
      })),
    []
  );
  const [phase, setPhase] = useState<Phase>({ i: 0, step: "typing", chars: 0 });
  const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  // The timeline.
  useEffect(() => {
    if (reduced) return;
    const scene = SCENES[phase.i];
    let t: ReturnType<typeof setTimeout>;
    if (phase.step === "typing") {
      t = phase.chars < scene.prompt.length ? setTimeout(() => setPhase((p) => ({ ...p, chars: p.chars + 1 })), 38 + Math.random() * 40) : setTimeout(() => setPhase((p) => ({ ...p, step: "thinking" })), 350);
    } else if (phase.step === "thinking") {
      t = setTimeout(() => setPhase((p) => ({ ...p, step: "shown" })), 900);
    } else if (phase.step === "shown") {
      t = setTimeout(() => setPhase((p) => (p.i < SCENES.length - 1 ? { i: p.i + 1, step: "typing", chars: 0 } : { ...p, step: "hold" })), 1500);
    } else if (phase.step === "hold") {
      t = setTimeout(() => setPhase((p) => ({ ...p, step: "reset" })), 4200);
    } else {
      t = setTimeout(() => setPhase({ i: 0, step: "typing", chars: 0 }), 700);
    }
    return () => clearTimeout(t);
  }, [phase, reduced]);

  const visible = (i: number) => reduced || (phase.step !== "reset" && (i < phase.i || (i === phase.i && (phase.step === "shown" || phase.step === "hold"))));
  const scene = SCENES[phase.i];
  const typed = reduced ? SCENES[0].prompt : phase.step === "typing" ? scene.prompt.slice(0, phase.chars) : phase.step === "reset" || phase.step === "hold" ? "" : scene.prompt;
  const count = SCENES.filter((_, i) => visible(i)).length;

  return (
    <div className="film-frame relative mx-auto w-full max-w-[1100px]">
      {/* glow under the window */}
      <div className="pointer-events-none absolute -inset-x-10 -bottom-16 top-24 rounded-[48px] bg-[radial-gradient(60%_60%_at_50%_50%,rgba(123,112,230,0.28),transparent_70%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-[34px] bg-bg p-2.5 text-left shadow-[var(--shadow-lg)]">
        {/* window chrome */}
        <div className="flex items-center gap-2 px-3 pb-2.5 pt-1">
          <span className="clay-tile h-3 w-3 rounded-full bg-clay-peach" />
          <span className="clay-tile h-3 w-3 rounded-full bg-clay-lemon" />
          <span className="clay-tile h-3 w-3 rounded-full bg-clay-mint" />
          <div className="clay-inset mx-auto flex items-center gap-1.5 rounded-full px-4 py-1 text-[11px] font-bold text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> vizpilot.app/reports/q3-sales
          </div>
          <span className="w-12" />
        </div>

        <div className="flex gap-2.5">
          {/* mini sidebar */}
          <div className="clay hidden w-14 shrink-0 flex-col items-center gap-3 rounded-[22px] py-4 sm:flex">
            <span className="clay-brand flex h-8 w-8 items-center justify-center rounded-[12px]">
              <BarChart3 className="h-4 w-4" />
            </span>
            {[Home, LayoutGrid, Database, Settings].map((I, k) => (
              <span key={k} className={clsx("flex h-8 w-8 items-center justify-center rounded-[12px]", k === 1 ? "clay-inset text-brand" : "text-ink-3")}>
                <I className="h-4 w-4" />
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1 p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-ink sm:text-base">Q3 sales review</div>
                <div className="text-[11px] text-ink-3">
                  E-commerce orders · 420 rows · <span className="tabular-nums">{count}</span> widget{count === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="hidden rounded-full bg-brand-soft px-3 py-1.5 text-[11px] font-extrabold text-brand-ink shadow-[var(--shadow-sm)] sm:inline-flex">
                  <Sparkles className="mr-1 h-3 w-3" /> Ask AI
                </span>
                <span className="clay-brand rounded-full px-3 py-1.5 text-[11px] font-extrabold">Share</span>
              </div>
            </div>

            {/* the dashboard grid */}
            <div className="grid h-[360px] grid-cols-1 gap-3 sm:h-[520px] sm:grid-cols-6 sm:grid-rows-2">
              {SCENES.map((s, i) => (
                <div
                  key={s.title}
                  className={clsx("film-cell relative min-h-0 sm:[grid-area:var(--area)]", !s.mobile && "hidden sm:block", visible(i) ? "is-in" : "is-out")}
                  style={{ "--area": s.area } as React.CSSProperties}
                >
                  {visible(i) && (
                    <div className="h-full">
                      <Widget chart={charts[i]} rows={data.rows} columns={data.columns} theme="light" readOnly fill />
                    </div>
                  )}
                  {!visible(i) && <div className="h-full rounded-[22px] shadow-[var(--clay-inset)]" />}
                  {phase.i === i && phase.step === "thinking" && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-surface/80 shadow-[var(--clay-inset)] backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-xs font-medium text-brand">
                        <span className="typing-dot" />
                        <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
                        <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
                        Building widget…
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* the Ask AI composer */}
            <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
              <div className={clsx("flex w-full max-w-md items-center gap-2 rounded-full bg-surface p-1.5 pl-4 shadow-[var(--shadow-md)] transition-all duration-500", phase.step === "hold" || phase.step === "reset" ? "translate-y-3 opacity-0" : "opacity-100")}>
                <Sparkles className="h-4 w-4 shrink-0 text-brand" />
                <span className="min-w-0 flex-1 truncate py-1.5 text-[13px] font-bold text-ink">
                  {typed}
                  {phase.step === "typing" && <span className="caret" />}
                  {!typed && <span className="text-ink-3">Ask about your data…</span>}
                </span>
                <span className={clsx("clay-brand flex h-9 w-9 items-center justify-center rounded-full transition-transform", phase.step === "thinking" && "scale-90")}>
                  <ArrowUp className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
