"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { ArrowUp, Check, CheckCircle2, ChevronDown, Lightbulb, Plus, RotateCcw, Sparkles, ThumbsDown, ThumbsUp, Wand2, X } from "lucide-react";
import { api } from "@/lib/api";
import type { ChartConfig, Column, Row } from "@/lib/charts/types";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { Button } from "@/components/ui/Button";
import { entityWord, groupableColumns, measureAggregate, rankMeasures } from "@/lib/charts/suggest";

export interface AskResponse {
  kind: "chart" | "answer" | "insights";
  message: string;
  steps: string[];
  chart?: { title: string; subtitle: string; config: ChartConfig };
  answer?: { label: string; value: string; detail?: string };
  insights?: string[];
  facts?: string;
  followUps: string[];
  provider: string;
  model?: string;
  latencyMs?: number;
}

type Msg = { id: number; role: "user"; text: string } | { id: number; role: "assistant"; res?: AskResponse; error?: string; added?: boolean; vote?: 1 | -1 };

interface Props {
  datasetId: string;
  datasetName: string;
  columns: Column[];
  rows: Row[];
  palette: string;
  initialPrompt?: string | null;
  onConsumePrompt?: () => void;
  onAddChart: (c: { title: string; subtitle: string; config: ChartConfig }) => Promise<void>;
  onClose: () => void;
  /** Rendered under the title – e.g. a data-source picker. */
  headerSlot?: React.ReactNode;
  /** Wide layout (dialog): centre the conversation in a readable column. */
  wide?: boolean;
}

let msgId = 0;
const THINKING = ["Understanding your question", "Reading the columns", "Analysing the rows", "Building the visualization"];

export function AskAI({ datasetId, datasetName, columns, rows, palette, initialPrompt, onConsumePrompt, onAddChart, onClose, headerSlot, wide }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinkStep, setThinkStep] = useState(0);
  const [lastConfig, setLastConfig] = useState<ChartConfig | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, thinkStep]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!busy) return;
    setThinkStep(0);
    const t = setInterval(() => setThinkStep((s) => Math.min(THINKING.length - 1, s + 1)), 650);
    return () => clearInterval(t);
  }, [busy]);

  const chips = useMemo(() => suggestPrompts(columns, rows), [columns, rows]);

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setInput("");
    const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.role === "user" ? m.text : m.res ? `${m.res.chart ? `[chart: ${m.res.chart.title}] ` : ""}${m.res.message}` : "" }));
    setMessages((m) => [...m, { id: ++msgId, role: "user", text: prompt }]);
    setBusy(true);
    try {
      const res = await api<AskResponse>("/api/ai/ask", { method: "POST", json: { datasetId, prompt, palette, history, lastConfig } });
      if (res.chart) setLastConfig(res.chart.config);
      setMessages((m) => [...m, { id: ++msgId, role: "assistant", res }]);
    } catch (err) {
      setMessages((m) => [...m, { id: ++msgId, role: "assistant", error: (err as Error).message }]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const consumed = useRef<string | null>(null);
  useEffect(() => {
    if (initialPrompt && consumed.current !== initialPrompt) {
      consumed.current = initialPrompt;
      onConsumePrompt?.();
      void send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const add = async (id: number, chart: NonNullable<AskResponse["chart"]>) => {
    await onAddChart(chart);
    setMessages((m) => m.map((msg) => (msg.id === id && msg.role === "assistant" ? { ...msg, added: true } : msg)));
  };
  const vote = (id: number, v: 1 | -1) => setMessages((m) => m.map((msg) => (msg.id === id && msg.role === "assistant" ? { ...msg, vote: msg.vote === v ? undefined : v } : msg)));

  const lastId = messages[messages.length - 1]?.id;

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="gradient-brand flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-[var(--shadow-glow)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              Ask AI <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-ink">Beta</span>
            </div>
            {headerSlot ?? <div className="max-w-[220px] truncate text-xs text-ink-3">Analysing {datasetName}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setLastConfig(null);
              }}
              className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink"
              aria-label="New conversation"
              title="Start over"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={clsx("flex-1 space-y-5 overflow-y-auto py-4 scrollbar-thin", wide ? "px-[max(1rem,calc((100%-46rem)/2))] py-6" : "px-4")}>
        {messages.length === 0 && (
          <div className="space-y-4 animate-fade-up">
            <div className="rounded-2xl border bg-gradient-to-br from-brand-soft/80 via-surface to-surface p-4">
              <p className="text-sm text-ink">
                Ask anything about <strong>{datasetName}</strong> — I&apos;ll analyse the {rows.length.toLocaleString()} rows and build the right chart, answer a number, or summarise what stands out.
              </p>
              <p className="mt-2 text-xs text-ink-3">Try filters (“for Electronics”), comparisons (“units vs revenue”), or follow-ups (“make it a donut”, “top 5”, “monthly”).</p>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Suggested questions</div>
              <div className="stagger stagger-auto flex flex-col gap-1.5">
                {chips.map((c) => (
                  <button key={c} onClick={() => send(c)} className="flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-left text-xs text-ink-2 transition-all duration-200 hover:border-brand hover:text-brand hover:shadow-[var(--shadow-sm)]">
                    <Sparkles className="h-3 w-3 shrink-0 text-brand" />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end animate-fade-up">
              <div className="gradient-brand max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm text-white shadow-[var(--shadow-sm)]">{m.text}</div>
            </div>
          ) : (
            <AssistantMessage key={m.id} msg={m} rows={rows} columns={columns} isLast={m.id === lastId && !busy} onAdd={(c) => add(m.id, c)} onVote={(v) => vote(m.id, v)} onFollow={send} />
          )
        )}

        {busy && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Sparkles className="h-3 w-3 animate-pulse-soft" />
              </span>
              <span className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-2">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            </div>
            <ul className="ml-8 space-y-1">
              {THINKING.map((t, i) => (
                <li key={t} className={clsx("flex items-center gap-2 text-xs transition-all duration-300", i < thinkStep ? "text-ink-2" : i === thinkStep ? "text-ink" : "text-ink-3/60")}>
                  {i < thinkStep ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <span className={clsx("h-3.5 w-3.5 rounded-full border-2", i === thinkStep ? "animate-spin border-brand border-t-transparent" : "border-border-strong")} />}
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className={clsx("border-t py-3", wide ? "px-[max(0.75rem,calc((100%-46rem)/2))]" : "px-3")}
      >
        <div className="gradient-border flex items-end gap-2 rounded-2xl bg-surface px-3 py-2 shadow-[var(--shadow-sm)] transition-shadow focus-within:shadow-[0_0_0_3px_var(--ring)]">
          <textarea
            ref={inputRef}
            rows={1}
            className="max-h-28 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-ink-3"
            placeholder={lastConfig ? "Refine it, or ask something else…" : "Ask about your data…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            data-testid="ai-input"
          />
          <button type="submit" disabled={!input.trim() || busy} className="gradient-brand flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-[var(--shadow-glow)] transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100" aria-label="Send">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-ink-3">Enter to send · Shift+Enter for a new line · answers are computed from your data, never guessed</p>
      </form>
    </div>
  );
}

function AssistantMessage({ msg, rows, columns, isLast, onAdd, onVote, onFollow }: { msg: Extract<Msg, { role: "assistant" }>; rows: Row[]; columns: Column[]; isLast: boolean; onAdd: (c: NonNullable<AskResponse["chart"]>) => void; onVote: (v: 1 | -1) => void; onFollow: (t: string) => void }) {
  const [showSteps, setShowSteps] = useState(true);
  const res = msg.res;
  if (msg.error) {
    return (
      <div className="flex items-start gap-2.5 animate-fade-up">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-danger">!</span>
        <p className="text-sm text-danger">Sorry — {msg.error}</p>
      </div>
    );
  }
  if (!res) return null;
  return (
    <div className="space-y-2.5 animate-fade-up">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Sparkles className="h-3 w-3" />
        </span>
        <p className="text-sm leading-relaxed text-ink">{res.message}</p>
      </div>

      {res.answer && (
        <div className="ml-8 rounded-2xl border bg-gradient-to-br from-brand-soft/70 to-surface px-4 py-3 animate-scale-in" data-testid="ai-answer">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{res.answer.label}</div>
          <div className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-brand-ink">{res.answer.value}</div>
        </div>
      )}

      {res.insights && (
        <ul className="ml-8 space-y-1.5 stagger stagger-auto">
          {res.insights.map((ins, j) => (
            <li key={j} data-testid="ai-insight" className="flex items-start gap-2 rounded-xl border bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              {ins}
            </li>
          ))}
        </ul>
      )}

      {res.steps.length > 0 && (
        <div className="ml-8">
          <button onClick={() => setShowSteps((s) => !s)} className="flex items-center gap-1 text-[11px] font-semibold text-ink-2 hover:text-ink">
            <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", !showSteps && "-rotate-90")} />
            Here&apos;s how I built this
          </button>
          {showSteps && (
            <ol className="mt-1.5 space-y-1 stagger stagger-auto">
              {res.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-ink-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-50 text-success">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  <StepText text={s} columns={columns} />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {res.chart && (
        <div className="ml-8 space-y-2">
          <div className="overflow-hidden rounded-2xl border bg-surface shadow-[var(--shadow-sm)] animate-scale-in">
            <div className="px-3.5 pt-3">
              <div className="truncate text-xs font-semibold">{res.chart.title}</div>
              {res.chart.subtitle && <div className="truncate text-[11px] text-ink-3">{res.chart.subtitle}</div>}
            </div>
            <div className="pointer-events-none px-2 pt-2">
              <ChartRenderer config={res.chart.config} rows={rows} columns={columns} height={res.chart.config.type === "kpi" ? 110 : 170} compact />
            </div>
            {res.facts && <div className="px-3.5 pt-1 text-[11px] text-ink-3">{res.facts}</div>}
            <div className="mt-2 flex items-center justify-between gap-2 border-t bg-surface-2 px-3 py-2">
              <div className="flex items-center gap-1">
                <button onClick={() => onVote(1)} className={clsx("rounded-md p-1 transition-colors", msg.vote === 1 ? "text-success" : "text-ink-3 hover:text-ink")} aria-label="Good answer">
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onVote(-1)} className={clsx("rounded-md p-1 transition-colors", msg.vote === -1 ? "text-danger" : "text-ink-3 hover:text-ink")} aria-label="Bad answer">
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
                <span className="ml-1 text-[10px] uppercase tracking-wide text-ink-3">{res.provider === "rules" ? "rules engine" : `${res.provider}${res.latencyMs ? ` · ${(res.latencyMs / 1000).toFixed(1)}s` : ""}`}</span>
              </div>
              <Button size="xs" variant={msg.added ? "soft" : "primary"} disabled={msg.added} onClick={() => onAdd(res.chart!)} data-testid="ai-add-chart">
                {msg.added ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Added
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> Add to dashboard
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLast && res.followUps.length > 0 && (
        <div className="ml-8 flex flex-wrap gap-1.5">
          {res.followUps.map((c) => (
            <button key={c} onClick={() => onFollow(c)} className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[11px] text-ink-2 transition-colors hover:border-brand hover:text-brand">
              <Wand2 className="h-3 w-3" /> {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Highlights column names inside a step sentence, like Graphy's chips. */
function StepText({ text, columns }: { text: string; columns: Column[] }) {
  const names = [...columns.map((c) => c.name)].sort((a, b) => b.length - a.length);
  const parts: React.ReactNode[] = [];
  let rest = text;
  let guard = 0;
  while (rest && guard++ < 20) {
    let best: { i: number; name: string } | null = null;
    for (const n of names) {
      const i = rest.indexOf(n);
      if (i !== -1 && (best === null || i < best.i)) best = { i, name: n };
    }
    if (!best) {
      parts.push(rest);
      break;
    }
    if (best.i > 0) parts.push(rest.slice(0, best.i));
    parts.push(
      <span key={parts.length} className="mx-0.5 inline-flex rounded-md border bg-surface px-1.5 py-px font-medium text-ink">
        {best.name}
      </span>
    );
    rest = rest.slice(best.i + best.name.length);
  }
  return <span>{parts}</span>;
}

export function suggestPrompts(columns: Column[], rows: Row[]): string[] {
  const numeric = rankMeasures(columns).map((c) => c.name);
  const cats = groupableColumns(columns, rows).map((c) => c.name);
  const dates = columns.filter((c) => c.type === "date").map((c) => c.name);
  const ent = entityWord(columns, rows);
  const hasEntity = ent.plural !== "rows";
  const m0 = numeric[0];
  const additive = m0 ? measureAggregate(m0) === "sum" : true;
  const measure = m0 ? (additive ? m0 : `average ${m0.toLowerCase()}`) : "";
  const out: string[] = [];
  if (hasEntity && cats[0] && (!m0 || !additive)) out.push(`How many ${ent.plural} per ${cats[0]}?`);
  if (m0 && cats[0]) out.push(`${measure.charAt(0).toUpperCase() + measure.slice(1)} by ${cats[0]}`);
  if (m0 && dates[0]) out.push(`How has ${measure} changed over time?`);
  if (hasEntity && dates[0] && !additive) out.push(`${ent.plural.charAt(0).toUpperCase() + ent.plural.slice(1)} over time`);
  if (m0 && cats[1]) out.push(`Top 5 ${cats[1]} by ${measure}`);
  if (m0 && cats[0]) out.push(`Which ${cats[0]} has the highest ${measure}?`);
  if (!m0 && cats[0]) out.push(`How many ${ent.plural} per ${cats[0]}?`);
  if (!m0 && cats[1]) out.push(`Share of ${ent.plural} by ${cats[1]} as a donut`);
  if (numeric[1] && cats[0] && additive) out.push(`Average ${numeric[1]} per ${cats[0]}`);
  out.push("What are the key insights?");
  return [...new Set(out)].slice(0, 5);
}
