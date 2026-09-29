"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import {
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  LayoutGrid,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  Plus,
  Ruler,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Table2,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  X,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Widget } from "@/components/charts/Widget";
import { FilterEditor, ICONS, Toggle } from "@/components/charts/ChartEditor";
import { SourcePicker, type SourceOption } from "@/components/data/SourcePicker";
import { DataUploader, type DataDraft } from "@/components/data/DataUploader";
import { DataTable } from "@/components/data/DataTable";
import { suggestPrompts } from "@/components/ai/AskAI";
import { suggestCharts } from "@/lib/charts/suggest";
import { api } from "@/lib/api";
import { CHART_TYPES, DEFAULT_CONFIG, PALETTES, getPalette, type ChartConfig, type ChartRecord, type Column, type DatasetRecord, type Row } from "@/lib/charts/types";
import { GAP, ROW_H, defaultBox, minBox } from "@/lib/layout/grid";
import { effectiveKeys, seriesLabel } from "@/lib/data/transform";

/**
 * Chart studio – a full-screen editor in the spirit of Graphy's chart page:
 *   left   Ask AI that edits *this* chart (with "how I built it")
 *   centre the widget on a framed canvas, resizable by its grips
 *   right  a tool rail: Graph · Fine tune · Design · Annotate · Size · Edit data
 */

export interface WidgetDraft {
  title: string;
  subtitle: string;
  note: string;
  config: ChartConfig;
  datasetId: string | null;
  /** Footprint on the dashboard grid (12 columns). */
  box?: { w: number; h: number };
}

interface Props {
  open: boolean;
  /** add / edit a widget, or "ask": Ask AI builds charts you can add one after another. */
  mode: "add" | "edit" | "ask";
  /** Ask mode: question to send as soon as the studio opens. */
  initialPrompt?: string | null;
  initial: WidgetDraft | null;
  sources: SourceOption[];
  theme: "light" | "dark";
  palette: string;
  reportTitle?: string;
  getDataset: (id: string) => Promise<DatasetRecord>;
  createDataset: (d: DataDraft) => Promise<DatasetRecord>;
  /** Persist cell edits made in "Edit data". */
  onEditData?: (datasetId: string, next: { columns: Column[]; rows: Row[] }) => void;
  onSave: (draft: WidgetDraft) => Promise<void>;
  onClose: () => void;
}

type Tool = "graph" | "tune" | "design" | "annotate" | "size" | "data" | null;

const TOOLS: { id: Exclude<Tool, null>; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "graph", label: "Graph", icon: BarChart3 },
  { id: "tune", label: "Fine tune", icon: SlidersHorizontal },
  { id: "design", label: "Design", icon: Palette },
  { id: "annotate", label: "Annotate", icon: PencilLine },
  { id: "size", label: "Size", icon: Ruler },
  { id: "data", label: "Edit data", icon: Table2 },
];

const SIZE_PRESETS: { label: string; hint: string; w: number; h: number }[] = [
  { label: "KPI tile", hint: "4 × 6", w: 4, h: 6 },
  { label: "Half width", hint: "6 × 10", w: 6, h: 10 },
  { label: "Two-thirds", hint: "8 × 11", w: 8, h: 11 },
  { label: "Full width", hint: "12 × 12", w: 12, h: 12 },
  { label: "Tall", hint: "6 × 16", w: 6, h: 16 },
  { label: "Banner", hint: "12 × 7", w: 12, h: 7 },
];

/** Column width (px) of a typical dashboard, used to preview the real size. */
const COL_PX = 84;
const framePx = (w: number, h: number) => ({ width: w * COL_PX + (w - 1) * GAP, height: h * ROW_H + (h - 1) * GAP });

function fits(config: ChartConfig, columns: Column[]) {
  if (config.type === "text") return true;
  const names = new Set(columns.map((c) => c.name));
  return (!config.xKey || names.has(config.xKey)) && config.yKeys.every((k) => names.has(k));
}

function starter(columns: Column[], rows: Row[], palette: string): Pick<WidgetDraft, "title" | "subtitle" | "config"> {
  const all = suggestCharts(columns, rows, palette);
  const s = all.find((x) => x.config.type !== "kpi") ?? all[0];
  if (s) return { title: s.title, subtitle: s.subtitle, config: s.config };
  return { title: "New chart", subtitle: "", config: { ...DEFAULT_CONFIG, palette, xKey: columns[0]?.name ?? "" } };
}

export function WidgetBuilder(props: Props) {
  if (!props.open) return null;
  return <Studio {...props} />;
}

// ============================================================================

interface AskResponse {
  kind: "chart" | "answer" | "insights";
  message: string;
  steps: string[];
  chart?: { title: string; subtitle: string; config: ChartConfig };
  answer?: { label: string; value: string; detail?: string };
  insights?: string[];
  followUps: string[];
  provider: string;
  model?: string;
  latencyMs?: number;
}
type Msg = { id: number; role: "user"; text: string } | { id: number; role: "ai"; res?: AskResponse; error?: string; prev?: Pick<WidgetDraft, "title" | "subtitle" | "config">; vote?: 1 | -1 };
let msgSeq = 0;

function Studio({ open, mode, initialPrompt, initial, sources, theme, palette, reportTitle, getDataset, createDataset, onEditData, onSave, onClose }: Props) {
  const ask = mode === "ask";
  const [draft, setDraft] = useState<WidgetDraft>(() => {
    const base = initial ?? { title: "New chart", subtitle: "", note: "", config: { ...DEFAULT_CONFIG, palette }, datasetId: sources.find((s) => s.inReport)?.id ?? sources[0]?.id ?? null };
    return { ...base, box: base.box ?? defaultBox(base.config.type) };
  });
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"studio" | "new-source">(() => (!initial?.datasetId && sources.length === 0 ? "new-source" : "studio"));
  const [newData, setNewData] = useState<DataDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(mode === "edit" || mode === "ask" || initial?.config.type === "text");
  // Ask mode: the canvas stays empty until the AI has built a chart.
  const [hasChart, setHasChart] = useState(!ask);
  // Ask mode: which chart is already on the dashboard (to show "Added ✓").
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [tool, setTool] = useState<Tool>(null);
  const [chatOpen, setChatOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 1024);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">(theme);

  const setCfg = (patch: Partial<ChartConfig>) => {
    setTouched(true);
    setDraft((d) => ({ ...d, config: { ...d.config, ...patch } }));
  };

  // Load the chosen source; a fresh, untouched widget starts from a good suggestion.
  useEffect(() => {
    const id = draft.datasetId;
    if (!id) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const ds = await getDataset(id);
        if (cancelled) return;
        setDataset(ds);
        setDraft((d) => {
          if (d.datasetId !== id) return d;
          if (ask || (touched && fits(d.config, ds.columns))) return d;
          const s = starter(ds.columns, ds.rows, palette);
          return { ...d, ...s, box: mode === "add" ? defaultBox(s.config.type) : d.box };
        });
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.datasetId]);

  const asRecord: ChartRecord = { _id: "draft", reportId: "", datasetId: draft.datasetId ?? "", title: draft.title, subtitle: draft.subtitle, note: draft.note, config: draft.config, size: "half", order: 0 };
  const box = draft.box ?? defaultBox(draft.config.type);
  const setBox = (b: { w: number; h: number }) => {
    const m = minBox(draft.config.type);
    setDraft((d) => ({ ...d, box: { w: Math.max(m.w, Math.min(12, Math.round(b.w))), h: Math.max(m.h, Math.min(40, Math.round(b.h))) } }));
  };

  const draftKey = JSON.stringify([draft.title, draft.config, draft.datasetId, draft.box]);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      if (ask) {
        setAddedKey(draftKey);
        setAddedCount((n) => n + 1);
      } else onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const useNewData = async () => {
    if (!newData) return;
    setSaving(true);
    setError(null);
    try {
      const ds = await createDataset({ ...newData, name: newData.name.trim() || "Untitled data" });
      setTouched(false);
      setDraft((d) => ({ ...d, datasetId: ds._id }));
      setView("studio");
      setNewData(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Escape closes an open tool first, then the studio.
  const onDialogClose = () => (tool ? setTool(null) : onClose());

  return (
    <Dialog open={open} onClose={onDialogClose} label={ask ? "Ask AI" : mode === "add" ? "Add widget" : "Edit widget"} className="sm:h-[calc(100vh-2rem)] sm:max-w-[calc(100vw-2rem)] sm:rounded-[22px]">
      {/* ---------- top bar ---------- */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-surface px-3 sm:px-4">
        <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          <span className="hidden items-center gap-1.5 text-ink-3 sm:inline-flex">
            <LayoutGrid className="h-4 w-4" />
            <span className="max-w-[180px] truncate">{reportTitle ?? "Dashboard"}</span>
          </span>
          <ChevronRight className="hidden h-4 w-4 shrink-0 text-ink-3 sm:block" />
          {ask ? <Sparkles className="h-4 w-4 shrink-0 text-brand" /> : <BarChart3 className="h-4 w-4 shrink-0 text-ink-2" />}
          {ask && !hasChart ? (
            <span className="truncate px-1.5 font-medium text-ink">Ask AI</span>
          ) : (
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-1 font-medium text-ink outline-none hover:bg-surface-2 focus:bg-surface-2 focus:ring-2 focus:ring-brand/25"
            aria-label="Widget title"
            data-testid="studio-title"
          />
          )}
          <span className="hidden shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3 md:inline">{ask ? (addedCount ? `${addedCount} added` : "Ask AI") : mode === "add" ? "New widget" : "Editing"}</span>
        </nav>
        <div className="flex items-center gap-2">
          {error && <span className="hidden max-w-[240px] truncate text-xs text-danger md:inline">{error}</span>}
          <Button variant="ghost" size="sm" onClick={onClose}>
            {ask ? "Done" : "Cancel"}
          </Button>
          <button
            onClick={save}
            disabled={saving || (!dataset && draft.config.type !== "text") || (ask && (!hasChart || addedKey === draftKey))}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-inverse px-3.5 text-sm font-medium text-inverse-fg shadow-[var(--shadow-sm)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow-md)] disabled:opacity-50"
            data-testid="save-widget"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : ask && addedKey !== draftKey ? <Plus className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {ask ? (addedKey === draftKey ? "Added to dashboard" : "Add to dashboard") : mode === "add" ? "Add to dashboard" : "Save changes"}
          </button>
          <button onClick={onClose} className="hidden rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink sm:block" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {view === "new-source" ? (
        <div className="flex min-h-0 flex-1 flex-col bg-bg">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 scrollbar-thin">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-lg font-semibold">Add a data source</h2>
              <p className="mb-4 mt-1 text-sm text-ink-2">Upload a file, paste cells or pick a sample. It becomes available to every widget.</p>
              <DataUploader draft={newData} onReady={setNewData} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t bg-surface px-5 py-3">
            {sources.length > 0 ? (
              <Button variant="ghost" onClick={() => setView("studio")}>
                <ArrowLeft className="h-4 w-4" /> Back to the chart
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={useNewData} disabled={!newData} loading={saving} data-testid="use-new-data">
              <Check className="h-4 w-4" /> Use this data
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 gap-3 bg-surface-3 p-2 sm:p-3">
          {/* ---------- left: Ask AI ---------- */}
          {chatOpen ? (
            <aside className="absolute inset-2 z-30 flex flex-col overflow-hidden rounded-[18px] border bg-surface shadow-[var(--shadow-lg)] animate-slide-in-left sm:inset-3 lg:static lg:w-[340px] lg:shrink-0 lg:shadow-none">
              <StudioChat
                dataset={dataset}
                sources={sources}
                datasetId={draft.datasetId}
                config={hasChart ? draft.config : null}
                palette={palette}
                mode={mode}
                title={draft.title}
                initialPrompt={initialPrompt ?? null}
                onSource={(id) => {
                  setTouched(false);
                  setDraft((d) => ({ ...d, datasetId: id }));
                }}
                onAddSource={() => setView("new-source")}
                onApply={(c) => {
                  setTouched(true);
                  setHasChart(true);
                  setDraft((d) => ({ ...d, title: c.title, subtitle: c.subtitle, config: c.config, box: ask && !hasChart ? defaultBox(c.config.type) : d.box }));
                }}
                current={{ title: draft.title, subtitle: draft.subtitle, config: draft.config }}
                onCollapse={() => setChatOpen(false)}
              />
            </aside>
          ) : (
            <button
              onClick={() => setChatOpen(true)}
              className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm font-medium shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] sm:left-5 sm:top-5"
              data-testid="open-studio-chat"
            >
              <PanelLeftOpen className="h-4 w-4 text-ink-3" />
              <Sparkles className="h-4 w-4 text-brand" /> Ask AI
            </button>
          )}

          {/* ---------- centre: canvas ---------- */}
          <div className="relative flex min-w-0 flex-1 overflow-hidden rounded-[18px] border bg-surface" onClick={() => tool && tool !== "data" && setTool(null)}>
            {ask && !hasChart ? (
              <AskEmpty dataset={dataset} />
            ) : (
            <Canvas
              loading={loading || !dataset}
              hasSource={!!draft.datasetId}
              box={box}
              onBox={setBox}
              theme={previewTheme}
              chart={asRecord}
              dataset={dataset}
            />
            )}

            {/* ---------- tool popover ---------- */}
            {tool && tool !== "data" && dataset && (
              <div
                className="absolute right-[84px] top-4 z-20 flex max-h-[calc(100%-2rem)] w-[340px] max-w-[calc(100%-100px)] flex-col overflow-hidden rounded-2xl border bg-surface shadow-[0_24px_60px_-24px_rgba(11,15,30,0.4),0_4px_12px_-4px_rgba(11,15,30,0.08)] animate-scale-in"
                onClick={(e) => e.stopPropagation()}
                data-testid={`tool-${tool}`}
              >
                <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
                  {tool === "graph" && <GraphPanel config={draft.config} columns={dataset.columns} rows={dataset.rows} setCfg={setCfg} />}
                  {tool === "tune" && <TunePanel config={draft.config} setCfg={setCfg} />}
                  {tool === "design" && <DesignPanel config={draft.config} setCfg={setCfg} previewTheme={previewTheme} setPreviewTheme={setPreviewTheme} />}
                  {tool === "annotate" && <AnnotatePanel draft={draft} setDraft={(p) => setDraft((d) => ({ ...d, ...p }))} />}
                  {tool === "size" && <SizePanel box={box} type={draft.config.type} setBox={setBox} />}
                </div>
              </div>
            )}

            {/* ---------- right: tool rail ---------- */}
            <div className="absolute inset-y-0 right-0 z-10 flex w-[76px] flex-col items-center justify-center gap-1 py-4" onClick={(e) => e.stopPropagation()}>
              {TOOLS.map((t) => {
                const on = tool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTool(on ? null : t.id)}
                    disabled={(!dataset && t.id !== "size") || (ask && !hasChart)}
                    className={clsx(
                      "group flex w-[62px] flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10.5px] font-medium transition-all disabled:opacity-40",
                      on ? "border-border-strong bg-surface text-ink shadow-[var(--shadow-sm)]" : "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink"
                    )}
                    data-testid={`rail-${t.id}`}
                  >
                    <t.icon className={clsx("h-[18px] w-[18px] transition-transform group-hover:scale-110", on && "text-brand")} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---------- Edit data overlay ---------- */}
          {tool === "data" && dataset && (
            <EditData
              dataset={dataset}
              chart={asRecord}
              theme={previewTheme}
              setType={(t) => setCfg({ type: t })}
              onChange={(next) => {
                setDataset({ ...dataset, ...next, rowCount: next.rows.length });
                onEditData?.(dataset._id, next);
              }}
              onClose={() => setTool(null)}
            />
          )}
        </div>
      )}
    </Dialog>
  );
}

// ============================================================================
// Canvas: the framed widget with resize grips (size = dashboard footprint)
// ============================================================================

function Canvas({ loading, hasSource, box, onBox, theme, chart, dataset }: { loading: boolean; hasSource: boolean; box: { w: number; h: number }; onBox: (b: { w: number; h: number }) => void; theme: "light" | "dark"; chart: ChartRecord; dataset: DatasetRecord | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState<null | "x" | "y">(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const px = framePx(box.w, box.h);
  const pad = 22; // frame ring
  // Leave room for the tool rail (and grips); phones get a tighter margin.
  const sideRoom = area.w < 560 ? 104 : 190;
  const scale = area.w ? Math.max(0.2, Math.min(1, (area.w - sideRoom) / (px.width + pad), (area.h - 90) / (px.height + pad))) : 1;

  const grip = (axis: "x" | "y", dir: 1 | -1) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, w: box.w, h: box.h };
    setDragging(axis);
    const move = (ev: PointerEvent) => {
      // The frame is centred, so the edge moves half of the size change: ×2.
      if (axis === "x") onBox({ w: start.w + ((ev.clientX - start.x) * dir * 2) / scale / (COL_PX + GAP), h: start.h });
      else onBox({ w: start.w, h: start.h + ((ev.clientY - start.y) * dir * 2) / scale / (ROW_H + GAP) });
    };
    const up = () => {
      setDragging(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const gripCls = (axis: "x" | "y") =>
    clsx(
      "absolute z-10 rounded-full bg-border-strong/80 transition-colors hover:bg-brand/70",
      axis === "x" ? "top-1/2 h-16 w-1.5 -translate-y-1/2 cursor-ew-resize" : "left-1/2 h-1.5 w-20 -translate-x-1/2 cursor-ns-resize",
      dragging === axis && "bg-brand"
    );

  return (
    <div ref={ref} className="canvas-dots relative flex flex-1 items-center justify-center overflow-hidden pr-[76px]" data-testid="studio-canvas">
      {!hasSource ? (
        <p className="text-sm text-ink-3">Pick a data source in the Ask AI panel to start.</p>
      ) : loading || !dataset ? (
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      ) : (
        <div className="relative" style={{ width: (px.width + pad) * scale, height: (px.height + pad) * scale }}>
          {/* grips */}
          <span className={clsx(gripCls("y"), "-top-5")} onPointerDown={grip("y", -1)} aria-label="Resize height" />
          <span className={clsx(gripCls("y"), "-bottom-5")} onPointerDown={grip("y", 1)} aria-label="Resize height" />
          <span className={clsx(gripCls("x"), "-left-5")} onPointerDown={grip("x", -1)} aria-label="Resize width" />
          <span className={clsx(gripCls("x"), "-right-5")} onPointerDown={grip("x", 1)} aria-label="Resize width" data-testid="studio-grip-right" />

          <div
            className="studio-frame absolute left-0 top-0 origin-top-left rounded-[22px] p-[11px] transition-[width,height] duration-150"
            style={{ width: px.width + pad, height: px.height + pad, transform: `scale(${scale})` }}
          >
            <div className="h-full" data-theme={theme} data-testid="widget-preview">
              <Widget chart={chart} rows={dataset.rows} columns={dataset.columns} theme={theme} readOnly fill hideActions />
            </div>
          </div>

          <div className={clsx("absolute -bottom-12 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] shadow-[var(--shadow-sm)] transition-opacity", "bg-popover text-ink-2", dragging ? "opacity-100" : "opacity-80")}>
            <Ruler className="h-3 w-3" />
            {box.w} × {box.h} on the dashboard · {box.w === 12 ? "full width" : box.w >= 8 ? "two-thirds" : box.w >= 6 ? "half width" : box.w >= 4 ? "third" : "narrow"}
          </div>
        </div>
      )}
    </div>
  );
}

/** Ask mode, before the first answer: an inviting empty canvas. */
function AskEmpty({ dataset }: { dataset: DatasetRecord | null }) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-dots pr-[76px]" data-testid="ask-empty">
      <div className="max-w-sm px-6 text-center animate-fade-up">
        <div className="relative mx-auto mb-5 h-28 w-44">
          <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-brand/25 bg-surface/70" />
          <div className="absolute inset-x-5 bottom-4 flex h-14 items-end gap-2">
            {[40, 70, 55, 90, 65].map((h, i) => (
              <span key={i} className="flex-1 animate-pulse-soft rounded-t-[4px] bg-brand/20" style={{ height: `${h}%`, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <span className="gradient-brand absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[var(--shadow-glow)]">
            <Sparkles className="h-4 w-4" />
          </span>
        </div>
        <h3 className="text-base font-semibold">Ask a question – the chart appears here</h3>
        <p className="mt-1.5 text-sm text-ink-2">
          {dataset ? (
            <>
              I&apos;m reading <strong className="text-ink">{dataset.name}</strong> ({dataset.rowCount.toLocaleString()} rows). Then use the tools on the right to fine-tune it.
            </>
          ) : (
            "Pick a data source in the chat to start."
          )}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Ask AI (left panel) – edits the chart in place
// ============================================================================

function StudioChat({
  dataset,
  sources,
  datasetId,
  config,
  palette,
  mode,
  title,
  initialPrompt,
  current,
  onSource,
  onAddSource,
  onApply,
  onCollapse,
}: {
  dataset: DatasetRecord | null;
  sources: SourceOption[];
  datasetId: string | null;
  config: ChartConfig | null;
  palette: string;
  mode: "add" | "edit" | "ask";
  title: string;
  initialPrompt: string | null;
  current: Pick<WidgetDraft, "title" | "subtitle" | "config">;
  onSource: (id: string) => void;
  onAddSource: () => void;
  onApply: (c: { title: string; subtitle: string; config: ChartConfig }) => void;
  onCollapse: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chips = useMemo(() => (dataset ? suggestPrompts(dataset.columns, dataset.rows).slice(0, mode === "ask" ? 5 : 4) : []), [dataset, mode]);
  const refine = ["Make it a bar chart", "Only the top 5", "Show it as a donut", "Group by month"];

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy || !datasetId) return;
    setInput("");
    setMessages((m) => [...m, { id: ++msgSeq, role: "user", text: prompt }]);
    setBusy(true);
    const history = messages.slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.role === "user" ? m.text : m.res?.message ?? "" }));
    try {
      const res = await api<AskResponse>("/api/ai/ask", { method: "POST", json: { datasetId, prompt, palette: config?.palette || palette, history, lastConfig: config } });
      const prev = config ? { ...current } : undefined;
      if (res.chart) onApply(res.chart);
      setMessages((m) => [...m, { id: ++msgSeq, role: "ai", res, prev: res.chart ? prev : undefined }]);
      if (!res.chart && res.kind !== "insights" && !res.answer) inputRef.current?.focus();
    } catch (e) {
      setMessages((m) => [...m, { id: ++msgSeq, role: "ai", error: (e as Error).message }]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  const sentInitial = useRef(false);
  useEffect(() => {
    if (!initialPrompt || sentInitial.current || !datasetId) return;
    sentInitial.current = true;
    void send(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, datasetId]);

  const colNames = dataset?.columns.map((c) => c.name) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <button onClick={onCollapse} className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Hide Ask AI" title="Hide">
            <PanelLeftClose className="h-4 w-4" />
          </button>
          <span className="text-[15px] font-semibold">Ask AI</span>
          <span className="rounded-md border bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-3">Beta</span>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="text-xs text-ink-3 hover:text-ink">
            Clear
          </button>
        )}
      </div>

      <div className="px-4 pb-2">
        <SourcePicker compact value={datasetId} options={sources} onChange={onSource} onAddNew={onAddSource} />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 scrollbar-thin">
        {/* the data chip, like Graphy's "Imported data" */}
        {dataset && (
          <div className="w-fit rounded-2xl bg-surface-3 px-3.5 py-2 text-sm text-ink-2">
            <span className="font-medium text-ink">{dataset.name}</span> · {dataset.rowCount.toLocaleString()} rows
          </div>
        )}
        {messages.length === 0 && (
          <div className="space-y-3 animate-fade-up">
            <p className="text-sm text-ink-2">
              {mode === "edit" ? (
                <>
                  Tell me how to change <strong className="text-ink">{title || "this chart"}</strong> – I&apos;ll update it on the canvas.
                </>
              ) : mode === "ask" ? (
                <>
                  Ask anything about <strong className="text-ink">{dataset?.name ?? "your data"}</strong>. I&apos;ll analyse the rows, build the chart on the canvas and explain how. Add the ones you like to your dashboard.
                </>
              ) : (
                "Describe the chart you want, or pick one to start. I'll build it on the canvas."
              )}
            </p>
            <div className="flex flex-col items-start gap-1.5">
              {(mode === "edit" ? refine : mode === "ask" ? [...new Set([...chips, "What are the key insights?"])] : chips).map((c) => (
                <button key={c} onClick={() => send(c)} className="rounded-xl border bg-surface px-3 py-1.5 text-left text-xs text-ink-2 transition-all hover:border-brand hover:text-brand" data-testid="studio-chip">
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-surface-3 px-3.5 py-2 text-sm text-ink animate-fade-up">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="space-y-2 animate-fade-up" data-testid="studio-ai-msg">
              {m.error ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{m.error}</p>
              ) : m.res ? (
                <>
                  {m.res.answer && (
                    <div className="rounded-xl border bg-gradient-to-br from-brand-soft/70 to-surface px-3 py-2.5" data-testid="ai-answer">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{m.res.answer.label}</div>
                      <div className="text-xl font-semibold text-brand-ink">{m.res.answer.value}</div>
                    </div>
                  )}
                  {m.res.chart ? <div className="text-sm font-semibold text-ink">Here&apos;s how I built this chart:</div> : <p className="text-sm text-ink">{m.res.message}</p>}
                  {m.res.chart && (
                    <ul className="space-y-1.5">
                      {m.res.steps.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-ink-2">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-3">
                            <Check className="h-2.5 w-2.5 text-ink-2" />
                          </span>
                          <StepChips text={s} columns={colNames} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.res.insights && (
                    <ul className="space-y-1.5">
                      {m.res.insights.map((t, i) => (
                        <li key={i} className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink-2" data-testid="ai-insight">
                          {t}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-1 pt-0.5">
                    {([1, -1] as const).map((v) => {
                      const I = v === 1 ? ThumbsUp : ThumbsDown;
                      return (
                        <button key={v} onClick={() => setMessages((ms) => ms.map((x) => (x.id === m.id && x.role === "ai" ? { ...x, vote: x.vote === v ? undefined : v } : x)))} className={clsx("rounded-md p-1 transition-colors", m.vote === v ? "text-brand" : "text-ink-3 hover:bg-surface-2 hover:text-ink")} aria-label={v === 1 ? "Helpful" : "Not helpful"}>
                          <I className="h-3.5 w-3.5" />
                        </button>
                      );
                    })}
                    {m.prev && (
                      <button onClick={() => m.prev && onApply(m.prev)} className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-ink-3 hover:bg-surface-2 hover:text-ink" title="Put the chart back as it was">
                        <Undo2 className="h-3 w-3" /> Undo
                      </button>
                    )}
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-ink-3">{m.res.provider}{m.res.latencyMs ? ` · ${(m.res.latencyMs / 1000).toFixed(1)}s` : ""}</span>
                  </div>
                  {m.res.followUps?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.res.followUps.slice(0, 3).map((f) => (
                        <button key={f} onClick={() => send(f)} className="rounded-full border border-dashed px-2.5 py-1 text-[11px] text-ink-2 hover:border-brand hover:text-brand">
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-ink-3">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
            Building…
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3"
      >
        <div className="flex items-end gap-2 rounded-2xl border bg-surface px-3 py-2 transition-shadow focus-within:border-brand/50 focus-within:shadow-[0_0_0_3px_var(--ring)]">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Show me…"
            className="max-h-28 min-h-[28px] flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-ink-3"
            data-testid="studio-ai-input"
          />
          <button type="submit" disabled={!input.trim() || busy || !datasetId} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-inverse text-inverse-fg transition-transform hover:scale-105 disabled:opacity-30" aria-label="Send">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

/** Render a step with column names as small chips, like Graphy's. */
function StepChips({ text, columns }: { text: string; columns: string[] }) {
  const names = [...columns].sort((a, b) => b.length - a.length).filter((n) => n.length > 1);
  const parts: React.ReactNode[] = [];
  let rest = text;
  let k = 0;
  while (rest) {
    let best: { i: number; n: string } | null = null;
    for (const n of names) {
      const i = rest.indexOf(n);
      if (i >= 0 && (!best || i < best.i)) best = { i, n };
    }
    if (!best) {
      parts.push(rest);
      break;
    }
    if (best.i > 0) parts.push(rest.slice(0, best.i));
    parts.push(
      <span key={k++} className="mx-0.5 inline-flex items-center gap-1 rounded-md border bg-surface px-1.5 py-px text-[12px] font-medium text-ink">
        <Table2 className="h-3 w-3 text-ink-3" />
        {best.n}
      </span>
    );
    rest = rest.slice(best.i + best.n.length);
  }
  return <span className="leading-6">{parts}</span>;
}

// ============================================================================
// Tool panels
// ============================================================================

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 text-[13px] font-semibold text-ink">{children}</div>;
}

function Row({ label, children, onClick, open }: { label: string; children?: React.ReactNode; onClick?: () => void; open?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 border-b py-3 text-left text-[13px] font-medium text-ink last:border-b-0 hover:text-brand">
      {label}
      <span className="flex items-center gap-2 text-ink-3">
        {children}
        {onClick && <ChevronDown className={clsx("h-4 w-4 transition-transform", open ? "rotate-180" : "-rotate-90")} />}
      </span>
    </button>
  );
}

function TypeGrid({ value, onPick }: { value: ChartConfig["type"]; onPick: (t: ChartConfig["type"]) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {CHART_TYPES.map((t) => {
        const Icon = ICONS[t.id];
        const on = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onPick(t.id)}
            title={t.hint}
            className={clsx("flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] transition-all", on ? "border-ink/60 bg-surface font-semibold text-ink shadow-[var(--shadow-sm)]" : "border-border text-ink-2 hover:bg-surface-2 hover:text-ink")}
            data-testid={`type-${t.id}`}
          >
            <Icon className="h-[18px] w-[18px]" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function GraphPanel({ config: cfg, columns, rows, setCfg }: { config: ChartConfig; columns: Column[]; rows: Row[]; setCfg: (p: Partial<ChartConfig>) => void }) {
  const [dataOpen, setDataOpen] = useState(true);
  const numeric = columns.filter((c) => c.type === "number");
  const single = ["pie", "donut", "kpi"].includes(cfg.type);
  const isText = cfg.type === "text";
  const pickType = (t: ChartConfig["type"]) => {
    const patch: Partial<ChartConfig> = { type: t };
    if (["pie", "donut", "kpi"].includes(t) && cfg.yKeys.length > 1) patch.yKeys = [cfg.yKeys[0]];
    if (t === "scatter") {
      patch.aggregate = "none";
      if (cfg.yKeys.length < 2) patch.yKeys = numeric.slice(0, 2).map((c) => c.name);
    } else if (cfg.aggregate === "none" && t !== "table") patch.aggregate = cfg.yKeys.length ? "sum" : "count";
    setCfg(patch);
  };
  const toggleY = (name: string) => {
    const agg = cfg.yKeys.length === 0 && cfg.aggregate === "count" && cfg.type !== "table" ? "sum" : cfg.aggregate;
    if (single) return setCfg({ yKeys: [name], aggregate: agg });
    const has = cfg.yKeys.includes(name);
    setCfg({ yKeys: has ? cfg.yKeys.filter((k) => k !== name) : [...cfg.yKeys, name], aggregate: agg });
  };
  const xIsDate = columns.find((c) => c.name === cfg.xKey)?.type === "date";

  return (
    <div>
      <PanelTitle>Graph type</PanelTitle>
      <TypeGrid value={cfg.type} onPick={pickType} />
      {!isText && (
        <>
          <div className="mt-3 border-t pt-1">
            <Row label="Data" onClick={() => setDataOpen((v) => !v)} open={dataOpen} />
          </div>
          {dataOpen && (
            <div className="space-y-3 pt-1">
              {cfg.type !== "kpi" && (
                <label className="block">
                  <span className="mb-1 block text-xs text-ink-3">{cfg.type === "scatter" ? "Point label" : "X-axis"}</span>
                  <select className="input h-9 py-1 text-sm" value={cfg.xKey} onChange={(e) => setCfg({ xKey: e.target.value })}>
                    <option value="">Choose a column…</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div>
                <span className="mb-1 block text-xs text-ink-3">{cfg.type === "scatter" ? "Measures (two)" : cfg.type === "table" ? "Columns" : "Y-axis"}</span>
                <div className="flex flex-wrap gap-1.5">
                  {cfg.type !== "scatter" && cfg.type !== "table" && (
                    <button onClick={() => setCfg({ yKeys: [], aggregate: "count" })} className={clsx("rounded-full border px-2.5 py-1 text-xs", cfg.yKeys.length === 0 && cfg.aggregate === "count" ? "border-brand bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2")}>
                      # Count rows
                    </button>
                  )}
                  {(cfg.type === "table" ? columns : numeric).map((c) => {
                    const on = cfg.yKeys.includes(c.name);
                    return (
                      <button key={c.name} onClick={() => toggleY(c.name)} className={clsx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs", on ? "border-brand bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2")}>
                        {on && <Check className="h-3 w-3" />}
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {cfg.type !== "scatter" && cfg.type !== "table" && (
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <span className="mb-1 block text-xs text-ink-3">Combine by</span>
                    <select className="input h-9 py-1 text-sm" value={cfg.aggregate} onChange={(e) => setCfg({ aggregate: e.target.value as ChartConfig["aggregate"] })}>
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="count">Count</option>
                      <option value="min">Minimum</option>
                      <option value="max">Maximum</option>
                      <option value="none">Don&apos;t combine</option>
                    </select>
                  </label>
                  {xIsDate ? (
                    <label>
                      <span className="mb-1 block text-xs text-ink-3">Group dates</span>
                      <select className="input h-9 py-1 text-sm" value={cfg.timeBucket ?? "auto"} onChange={(e) => setCfg({ timeBucket: e.target.value as ChartConfig["timeBucket"] })}>
                        <option value="auto">Auto</option>
                        <option value="none">Exact</option>
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="quarter">Quarter</option>
                        <option value="year">Year</option>
                      </select>
                    </label>
                  ) : (
                    cfg.type !== "kpi" && (
                      <label>
                        <span className="mb-1 block text-xs text-ink-3">Sort</span>
                        <select className="input h-9 py-1 text-sm" value={cfg.sort} onChange={(e) => setCfg({ sort: e.target.value as ChartConfig["sort"] })}>
                          <option value="none">Data order</option>
                          <option value="desc">Largest first</option>
                          <option value="asc">Smallest first</option>
                          <option value="label">A → Z</option>
                        </select>
                      </label>
                    )
                  )}
                </div>
              )}
              {cfg.type !== "kpi" && (
                <label className="block">
                  <span className="mb-1 block text-xs text-ink-3">Show only the top</span>
                  <input type="number" min={0} className="input h-9 py-1 text-sm" value={cfg.limit || ""} placeholder="All" onChange={(e) => setCfg({ limit: Math.max(0, Number(e.target.value) || 0) })} />
                </label>
              )}
              <FilterEditor filters={cfg.filters ?? []} columns={columns} rows={rows} onChange={(f) => setCfg({ filters: f.length ? f : undefined })} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TunePanel({ config: cfg, setCfg }: { config: ChartConfig; setCfg: (p: Partial<ChartConfig>) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const isText = cfg.type === "text";
  if (isText) return <p className="text-sm text-ink-3">Text blocks have no chart settings. Use Annotate to edit the text.</p>;
  return (
    <div>
      <Row label="Detail" onClick={() => setOpen(open === "detail" ? null : "detail")} open={open === "detail"} />
      {open === "detail" && (
        <div className="space-y-1 pb-2">
          <Toggle label="Value labels" value={cfg.showLabels} onChange={(v) => setCfg({ showLabels: v })} />
          <Toggle label="Grid lines" value={cfg.showGrid} onChange={(v) => setCfg({ showGrid: v })} />
          {(cfg.type === "line" || cfg.type === "area") && <Toggle label="Smooth curves" value={cfg.smooth} onChange={(v) => setCfg({ smooth: v })} />}
        </div>
      )}
      <div className="flex items-center justify-between border-b py-3 text-[13px] font-medium">
        Legend
        <div className="flex rounded-lg bg-surface-3 p-0.5 text-xs">
          {[
            [true, "Show"],
            [false, "None"],
          ].map(([v, l]) => (
            <button key={String(v)} onClick={() => setCfg({ showLegend: v as boolean })} className={clsx("rounded-md px-3 py-1 font-medium transition-all", cfg.showLegend === v ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-3")}>
              {l as string}
            </button>
          ))}
        </div>
      </div>
      <Row label="Number format" onClick={() => setOpen(open === "fmt" ? null : "fmt")} open={open === "fmt"}>
        <span className="text-xs">{{ auto: "Auto", plain: "1,234", compact: "1.2k", currency: "$", percent: "%" }[cfg.numberFormat]}</span>
      </Row>
      {open === "fmt" && (
        <div className="grid grid-cols-3 gap-1.5 pb-3">
          {(
            [
              ["auto", "Auto"],
              ["plain", "1,234"],
              ["compact", "1.2k"],
              ["currency", "$1.2k"],
              ["percent", "12%"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} onClick={() => setCfg({ numberFormat: v })} className={clsx("rounded-lg border px-2 py-1.5 text-xs", cfg.numberFormat === v ? "border-brand bg-brand-soft font-medium text-brand-ink" : "text-ink-2 hover:bg-surface-2")}>
              {l}
            </button>
          ))}
        </div>
      )}
      <Row label="Sort" onClick={() => setOpen(open === "sort" ? null : "sort")} open={open === "sort"}>
        <span className="text-xs">{{ none: "Data order", desc: "Largest first", asc: "Smallest first", label: "A → Z" }[cfg.sort]}</span>
      </Row>
      {open === "sort" && (
        <div className="grid grid-cols-2 gap-1.5 pb-3">
          {(
            [
              ["none", "Data order"],
              ["desc", "Largest first"],
              ["asc", "Smallest first"],
              ["label", "A → Z"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} onClick={() => setCfg({ sort: v })} className={clsx("rounded-lg border px-2 py-1.5 text-xs", cfg.sort === v ? "border-brand bg-brand-soft font-medium text-brand-ink" : "text-ink-2 hover:bg-surface-2")}>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DesignPanel({ config: cfg, setCfg, previewTheme, setPreviewTheme }: { config: ChartConfig; setCfg: (p: Partial<ChartConfig>) => void; previewTheme: "light" | "dark"; setPreviewTheme: (t: "light" | "dark") => void }) {
  const colors = getPalette(cfg.palette, previewTheme === "dark");
  const series = effectiveKeys(cfg);
  const multiColor = ["pie", "donut"].includes(cfg.type);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">Preview theme</span>
        <div className="flex rounded-lg bg-surface-3 p-0.5 text-xs">
          {(["light", "dark"] as const).map((t) => (
            <button key={t} onClick={() => setPreviewTheme(t)} className={clsx("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium capitalize transition-all", previewTheme === t ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-3")}>
              {t === "light" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <PanelTitle>Palette</PanelTitle>
        <div className="grid grid-cols-2 gap-1.5">
          {PALETTES.map((p) => (
            <button key={p.id} onClick={() => setCfg({ palette: p.id })} className={clsx("rounded-xl border p-2 text-left transition-all", cfg.palette === p.id ? "border-ink/50 shadow-[var(--shadow-sm)]" : "hover:bg-surface-2")} data-testid={`palette-${p.id}`}>
              <span className="flex -space-x-1">
                {(previewTheme === "dark" ? p.dark : p.colors).slice(0, 4).map((c, i) => (
                  <span key={c + i} className="h-4 w-4 rounded-full ring-2 ring-surface" style={{ background: c }} />
                ))}
              </span>
              <span className="mt-1.5 block text-xs font-medium">{p.label}</span>
              <span className="block text-[10px] text-ink-3">{p.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <PanelTitle>Series</PanelTitle>
        <div className="space-y-1.5">
          {(multiColor ? ["(one colour per slice)"] : series).map((k, i) => (
            <div key={k} className="flex items-center gap-2.5 text-xs text-ink-2">
              <span className="h-4 w-4 rounded-md" style={{ background: multiColor ? `conic-gradient(${colors.slice(0, 5).join(",")})` : colors[i % colors.length] }} />
              {multiColor ? k : seriesLabel(k, "Count")}
            </div>
          ))}
          {!series.length && !multiColor && <p className="text-xs text-ink-3">No series yet – pick a value in Graph.</p>}
        </div>
      </div>
      <p className="rounded-lg bg-surface-2 px-2.5 py-2 text-[11px] text-ink-3">
        Palettes are checked for colour-blind separation. The dashboard&apos;s light/dark theme is set from the report toolbar.
      </p>
    </div>
  );
}

function AnnotatePanel({ draft, setDraft }: { draft: WidgetDraft; setDraft: (p: Partial<WidgetDraft>) => void }) {
  const isText = draft.config.type === "text";
  return (
    <div className="space-y-3">
      <PanelTitle>{isText ? "Text block" : "Title & caption"}</PanelTitle>
      <label className="block">
        <span className="mb-1 block text-xs text-ink-3">{isText ? "Heading" : "Title"}</span>
        <input className="input h-9 py-1 text-sm" value={draft.title} onChange={(e) => setDraft({ title: e.target.value })} placeholder="Chart title" />
      </label>
      {!isText && (
        <label className="block">
          <span className="mb-1 block text-xs text-ink-3">Subtitle</span>
          <input className="input h-9 py-1 text-sm" value={draft.subtitle} onChange={(e) => setDraft({ subtitle: e.target.value })} placeholder="What should the reader notice?" />
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-xs text-ink-3">{isText ? "Text" : "Caption / takeaway"}</span>
        <textarea className="input min-h-[96px] resize-y text-sm" value={draft.note} onChange={(e) => setDraft({ note: e.target.value })} placeholder={isText ? "Write a summary or key takeaways…" : "e.g. Electronics drives 64% of revenue."} />
      </label>
    </div>
  );
}

function SizePanel({ box, type, setBox }: { box: { w: number; h: number }; type: ChartConfig["type"]; setBox: (b: { w: number; h: number }) => void }) {
  const m = minBox(type);
  return (
    <div>
      <PanelTitle>Presets</PanelTitle>
      <div className="space-y-0.5">
        {SIZE_PRESETS.filter((p) => p.w >= m.w && p.h >= m.h).map((p) => {
          const on = p.w === box.w && p.h === box.h;
          return (
            <button key={p.label} onClick={() => setBox(p)} className={clsx("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] transition-colors", on ? "bg-brand-soft text-brand-ink" : "hover:bg-surface-2")} data-testid="size-preset">
              <span className="flex h-6 w-8 items-center justify-center">
                <span className={clsx("rounded-[3px] border-2", on ? "border-brand" : "border-ink-3")} style={{ width: Math.max(6, p.w * 2.4), height: Math.max(6, Math.min(22, p.h * 1.3)) }} />
              </span>
              <span className="flex-1 font-medium">{p.label}</span>
              <span className="text-xs text-ink-3">{p.hint}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 border-t pt-3">
        <PanelTitle>Custom size</PanelTitle>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["w", "Columns", 12, m.w],
              ["h", "Rows", 40, m.h],
            ] as const
          ).map(([k, label, max, min]) => (
            <label key={k} className="flex items-center rounded-lg border bg-surface-2 pr-2">
              <input type="number" min={min} max={max} value={box[k]} onChange={(e) => setBox({ ...box, [k]: Number(e.target.value) || min })} className="w-full bg-transparent px-2.5 py-2 text-sm outline-none" aria-label={label} />
              <span className="text-[11px] text-ink-3">{k === "w" ? "cols" : "rows"}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-3">The dashboard is 12 columns wide. You can also drag the grips around the chart.</p>
      </div>
    </div>
  );
}

// ============================================================================
// Edit data – spreadsheet + live preview
// ============================================================================

function EditData({ dataset, chart, theme, setType, onChange, onClose }: { dataset: DatasetRecord; chart: ChartRecord; theme: "light" | "dark"; setType: (t: ChartConfig["type"]) => void; onChange: (next: { columns: Column[]; rows: Row[] }) => void; onClose: () => void }) {
  const [full, setFull] = useState(false);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b0f1e]/35 p-2 backdrop-blur-[2px] animate-fade-in sm:p-4" onClick={onClose}>
      <div className={clsx("flex w-full flex-col overflow-hidden rounded-2xl border bg-surface shadow-[var(--shadow-lg)] animate-scale-in", full ? "h-full" : "h-[88%] max-w-6xl")} onClick={(e) => e.stopPropagation()} data-testid="edit-data">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-brand" /> Edit data <span className="font-normal text-ink-3">· {dataset.name} · {dataset.rowCount.toLocaleString()} rows</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setFull((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-ink-2 hover:bg-surface-2">
              {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />} {full ? "Collapse" : "Expand"}
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close data">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3 scrollbar-thin">
            <DataTable columns={dataset.columns} rows={dataset.rows} editable onChange={onChange} maxHeight={9999} />
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-t bg-surface-2 p-3 lg:w-[320px] lg:border-l lg:border-t-0">
            <div className="h-[200px] rounded-xl border bg-surface p-1" data-theme={theme}>
              <Widget chart={chart} rows={dataset.rows} columns={dataset.columns} theme={theme} readOnly fill hideActions />
            </div>
            <TypeGrid value={chart.config.type} onPick={setType} />
            <p className="text-[11px] text-ink-3">Edits save to the dataset, so every widget using it updates.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
