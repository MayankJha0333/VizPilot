"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { AreaChart, BarChart3, BarChartHorizontal, Check, CircleDot, Hash, Layers, LineChart, PieChart, Plus, ScatterChart, SlidersHorizontal, Table2, Type, X } from "lucide-react";
import { CHART_TYPES, PALETTES, type ChartConfig, type ChartRecord, type ChartType, type Column, type Filter, type Row } from "@/lib/charts/types";
import { Field, Segmented } from "@/components/ui/misc";
import { distinctCount } from "@/lib/data/transform";

const ICONS: Record<ChartType, React.ComponentType<{ className?: string }>> = {
  column: BarChart3,
  bar: BarChartHorizontal,
  stackedColumn: Layers,
  line: LineChart,
  area: AreaChart,
  pie: PieChart,
  donut: CircleDot,
  scatter: ScatterChart,
  kpi: Hash,
  table: Table2,
  text: Type,
};

interface Props {
  chart: ChartRecord;
  columns: Column[];
  rows: Row[];
  onChange: (patch: Partial<ChartRecord>) => void;
  onClose?: () => void;
  /** Inside the widget builder dialog: no header, the dialog provides one. */
  embedded?: boolean;
}

type Tab = "chart" | "data" | "style";

export function ChartEditor({ chart, columns, rows, onChange, onClose, embedded }: Props) {
  const [tab, setTab] = useState<Tab>("chart");
  const cfg = chart.config;
  const setCfg = (patch: Partial<ChartConfig>) => onChange({ config: { ...cfg, ...patch } });

  const numeric = columns.filter((c) => c.type === "number");
  const single = ["pie", "donut", "kpi"].includes(cfg.type);
  const isText = cfg.type === "text";

  const toggleY = (name: string) => {
    const wasCount = cfg.yKeys.length === 0 && cfg.aggregate === "count";
    const agg = wasCount && cfg.type !== "table" ? "sum" : cfg.aggregate;
    if (single) return setCfg({ yKeys: [name], aggregate: agg });
    const has = cfg.yKeys.includes(name);
    const next = has ? cfg.yKeys.filter((k) => k !== name) : [...cfg.yKeys, name];
    setCfg({ yKeys: next, aggregate: agg });
  };

  const filters = cfg.filters ?? [];
  const setFilters = (f: Filter[]) => setCfg({ filters: f.length ? f : undefined });

  return (
    <div className="flex h-full flex-col">
      {!embedded && (
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">Edit widget</div>
            <div className="text-xs text-ink-3">Changes save automatically</div>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close editor">
          <X className="h-4 w-4" />
        </button>
      </div>
      )}
      <div className="px-4 pt-3">
        <Segmented
          value={tab}
          onChange={setTab}
          className="w-full [&>button]:flex-1"
          options={[
            { value: "chart", label: "Widget" },
            { value: "data", label: "Data" },
            { value: "style", label: "Style" },
          ]}
        />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 scrollbar-thin">
        {tab === "chart" && (
          <>
            <div>
              <div className="label">Type</div>
              <div className="grid grid-cols-3 gap-2">
                {CHART_TYPES.map((t) => {
                  const Icon = ICONS[t.id];
                  const active = cfg.type === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        const patch: Partial<ChartConfig> = { type: t.id };
                        if (["pie", "donut", "kpi"].includes(t.id) && cfg.yKeys.length > 1) patch.yKeys = [cfg.yKeys[0]];
                        if (t.id === "scatter") {
                          patch.aggregate = "none";
                          if (cfg.yKeys.length < 2) patch.yKeys = numeric.slice(0, 2).map((c) => c.name);
                        } else if (cfg.aggregate === "none" && t.id !== "table") {
                          patch.aggregate = cfg.yKeys.length ? "sum" : "count";
                        }
                        setCfg(patch);
                      }}
                      title={t.hint}
                      className={clsx(
                        "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition-all duration-200 hover:-translate-y-0.5",
                        active ? "border-brand bg-brand-soft text-brand-ink shadow-[0_0_0_3px_var(--ring)]" : "text-ink-2 hover:bg-surface-2"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label={isText ? "Heading" : "Title"}>
              <input className="input" value={chart.title} onChange={(e) => onChange({ title: e.target.value })} placeholder={isText ? "Section heading (optional)" : "Chart title"} />
            </Field>
            {!isText && (
              <Field label="Subtitle">
                <input className="input" value={chart.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} placeholder="What should the reader notice?" />
              </Field>
            )}
            <Field label={isText ? "Text" : "Note"} hint={isText ? "Shown as the widget body." : "Shown under the chart. Great for a takeaway."}>
              <textarea className="input min-h-[96px] resize-y" value={chart.note} onChange={(e) => onChange({ note: e.target.value })} placeholder={isText ? "Write a summary, context or key takeaways…" : "e.g. Revenue grew 3x after the March launch."} />
            </Field>
          </>
        )}

        {tab === "data" && !isText && (
          <>
            {cfg.type !== "kpi" && (
              <Field label={cfg.type === "scatter" ? "Point label" : cfg.type === "table" ? "First column" : "X axis / categories"}>
                <select className="input" value={cfg.xKey} onChange={(e) => setCfg({ xKey: e.target.value })}>
                  <option value="">Choose a column…</option>
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} · {c.type}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div>
              <div className="label">{cfg.type === "scatter" ? "Measures (pick two)" : cfg.type === "table" ? "Columns to show" : single ? "Value" : "Values"}</div>
              <div className="flex flex-wrap gap-1.5">
                {cfg.type !== "scatter" && cfg.type !== "table" && (
                  <button
                    onClick={() => setCfg({ yKeys: [], aggregate: "count" })}
                    className={clsx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", cfg.yKeys.length === 0 && cfg.aggregate === "count" ? "border-brand bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2")}
                    title="Count how many rows fall into each category"
                  >
                    {cfg.yKeys.length === 0 && cfg.aggregate === "count" && <Check className="h-3 w-3" />}# Count rows
                  </button>
                )}
                {(cfg.type === "table" ? columns : numeric).map((c) => {
                  const on = cfg.yKeys.includes(c.name);
                  return (
                    <button key={c.name} onClick={() => toggleY(c.name)} className={clsx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", on ? "border-brand bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2")}>
                      {on && <Check className="h-3 w-3" />}
                      {c.name}
                    </button>
                  );
                })}
                {numeric.length === 0 && cfg.type !== "table" && <p className="w-full text-xs text-ink-3">No numeric columns in this dataset — use “Count rows” to chart how many rows fall into each category.</p>}
              </div>
            </div>
            {cfg.type !== "kpi" && cfg.type !== "scatter" && cfg.type !== "table" && columns.find((c) => c.name === cfg.xKey)?.type === "date" && (
              <Field label="Group dates by" hint="Roll daily data up so trends are easier to read.">
                <select className="input" value={cfg.timeBucket ?? "auto"} onChange={(e) => setCfg({ timeBucket: e.target.value as ChartConfig["timeBucket"] })}>
                  <option value="auto">Auto</option>
                  <option value="none">Exact values</option>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="quarter">Quarter</option>
                  <option value="year">Year</option>
                </select>
              </Field>
            )}
            {cfg.type !== "scatter" && cfg.type !== "table" && (
              <Field label="Combine rows by" hint="How to roll up rows that share the same category.">
                <select className="input" value={cfg.aggregate} onChange={(e) => setCfg({ aggregate: e.target.value as ChartConfig["aggregate"] })}>
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                  <option value="count">Count (number of rows)</option>
                  <option value="min">Minimum</option>
                  <option value="max">Maximum</option>
                  <option value="none">Don&apos;t combine (one bar per row)</option>
                </select>
              </Field>
            )}
            {cfg.type !== "kpi" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sort">
                  <select className="input" value={cfg.sort} onChange={(e) => setCfg({ sort: e.target.value as ChartConfig["sort"] })}>
                    <option value="none">Data order</option>
                    <option value="desc">Largest first</option>
                    <option value="asc">Smallest first</option>
                    <option value="label">A → Z</option>
                  </select>
                </Field>
                <Field label="Limit">
                  <input type="number" min={0} className="input" value={cfg.limit || ""} placeholder="All" onChange={(e) => setCfg({ limit: Math.max(0, Number(e.target.value) || 0) })} />
                </Field>
              </div>
            )}
            <FilterEditor filters={filters} columns={columns} rows={rows} onChange={setFilters} />
          </>
        )}
        {tab === "data" && isText && <p className="text-sm text-ink-3">Text widgets don&apos;t use data. Switch to the Widget tab to edit the text.</p>}

        {tab === "style" && (
          <>
            {!isText && (
              <div>
                <div className="label">Palette</div>
                <div className="grid grid-cols-2 gap-2">
                  {PALETTES.map((p) => (
                    <button key={p.id} onClick={() => setCfg({ palette: p.id })} className={clsx("flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-medium", cfg.palette === p.id ? "border-brand bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2")}>
                      <span className="flex gap-0.5">
                        {p.colors.slice(0, 5).map((c, i) => (
                          <span key={c + i} className="h-3.5 w-2.5 first:rounded-l-full last:rounded-r-full" style={{ background: c }} />
                        ))}
                      </span>
                      <span className="flex flex-col items-start leading-tight">
                        {p.label}
                        {p.hint && <span className="text-[10px] font-normal text-ink-3">{p.hint}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!isText && (
              <Field label="Number format">
                <select className="input" value={cfg.numberFormat} onChange={(e) => setCfg({ numberFormat: e.target.value as ChartConfig["numberFormat"] })}>
                  <option value="auto">Auto (1.2k, 3.4M)</option>
                  <option value="plain">Plain (1,234)</option>
                  <option value="compact">Compact</option>
                  <option value="currency">Currency ($)</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </Field>
            )}
            {!isText && (
              <div className="space-y-2">
                <Toggle label="Show legend" value={cfg.showLegend} onChange={(v) => setCfg({ showLegend: v })} />
                <Toggle label="Show grid lines" value={cfg.showGrid} onChange={(v) => setCfg({ showGrid: v })} />
                <Toggle label="Show value labels" value={cfg.showLabels} onChange={(v) => setCfg({ showLabels: v })} />
                {(cfg.type === "line" || cfg.type === "area") && <Toggle label="Smooth curves" value={cfg.smooth} onChange={(v) => setCfg({ smooth: v })} />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterEditor({ filters, columns, rows, onChange }: { filters: Filter[]; columns: Column[]; rows: Row[]; onChange: (f: Filter[]) => void }) {
  const [draftCol, setDraftCol] = useState(columns[0]?.name ?? "");
  const col = columns.find((c) => c.name === draftCol);
  const values = col && col.type !== "number" ? [...new Set(rows.map((r) => String(r[col.name] ?? "")).filter(Boolean))].slice(0, 60) : [];
  const [draftVal, setDraftVal] = useState("");
  const [draftOp, setDraftOp] = useState<Filter["op"]>("eq");
  const add = () => {
    if (!col || draftVal === "") return;
    onChange([...filters, { column: col.name, op: col.type === "number" ? draftOp : "eq", value: col.type === "number" ? Number(draftVal) : draftVal }]);
    setDraftVal("");
  };
  return (
    <div>
      <div className="label">Filters</div>
      <div className="space-y-1.5">
        {filters.map((f, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-lg border bg-surface-2 px-2.5 py-1.5 text-xs">
            <span className="truncate">
              <strong>{f.column}</strong> {f.op} <span className="text-ink-2">{Array.isArray(f.value) ? f.value.join(", ") : String(f.value)}</span>
            </span>
            <button onClick={() => onChange(filters.filter((_, j) => j !== i))} className="rounded p-0.5 text-ink-3 hover:text-danger" aria-label="Remove filter">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
        <select className="input h-9 py-1 text-xs" value={draftCol} onChange={(e) => setDraftCol(e.target.value)}>
          {columns.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        {col?.type === "number" ? (
          <select className="input h-9 py-1 text-xs" value={draftOp} onChange={(e) => setDraftOp(e.target.value as Filter["op"])}>
            <option value="gt">&gt;</option>
            <option value="gte">≥</option>
            <option value="lt">&lt;</option>
            <option value="lte">≤</option>
            <option value="eq">=</option>
          </select>
        ) : (
          <span />
        )}
        {col?.type === "number" ? (
          <input type="number" className="input h-9 py-1 text-xs" placeholder="Value" value={draftVal} onChange={(e) => setDraftVal(e.target.value)} />
        ) : values.length && distinctCount(rows, col?.name ?? "") <= 60 ? (
          <select className="input h-9 py-1 text-xs" value={draftVal} onChange={(e) => setDraftVal(e.target.value)}>
            <option value="">Pick a value…</option>
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : (
          <input className="input h-9 py-1 text-xs" placeholder="Value" value={draftVal} onChange={(e) => setDraftVal(e.target.value)} />
        )}
        <button onClick={add} disabled={!draftVal} className="flex h-9 items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-40">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-sm text-ink hover:bg-surface-2">
      {label}
      <span className={clsx("relative h-5 w-9 rounded-full transition-colors", value ? "bg-brand" : "bg-border-strong")}>
        <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", value ? "translate-x-4" : "translate-x-0.5")} />
      </span>
    </button>
  );
}
