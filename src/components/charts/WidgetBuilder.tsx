"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { ArrowLeft, Check, LayoutGrid, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Widget } from "@/components/charts/Widget";
import { ChartEditor } from "@/components/charts/ChartEditor";
import { SourcePicker, type SourceOption } from "@/components/data/SourcePicker";
import { DataUploader, type DataDraft } from "@/components/data/DataUploader";
import { suggestCharts } from "@/lib/charts/suggest";
import { DEFAULT_CONFIG, type ChartConfig, type ChartRecord, type Column, type DatasetRecord } from "@/lib/charts/types";

export interface WidgetDraft {
  title: string;
  subtitle: string;
  note: string;
  config: ChartConfig;
  datasetId: string | null;
}

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initial: WidgetDraft | null;
  sources: SourceOption[];
  theme: "light" | "dark";
  palette: string;
  getDataset: (id: string) => Promise<DatasetRecord>;
  createDataset: (d: DataDraft) => Promise<DatasetRecord>;
  onSave: (draft: WidgetDraft) => Promise<void>;
  onClose: () => void;
}

/** Does the config still make sense for these columns? */
function fits(config: ChartConfig, columns: Column[]) {
  if (config.type === "text") return true;
  const names = new Set(columns.map((c) => c.name));
  return (!config.xKey || names.has(config.xKey)) && config.yKeys.every((k) => names.has(k));
}

function starter(columns: Column[], rows: DatasetRecord["rows"], palette: string): Pick<WidgetDraft, "title" | "subtitle" | "config"> {
  const s = suggestCharts(columns, rows, palette).find((x) => x.config.type !== "kpi") ?? suggestCharts(columns, rows, palette)[0];
  if (s) return { title: s.title, subtitle: s.subtitle, config: s.config };
  return { title: "New chart", subtitle: "", config: { ...DEFAULT_CONFIG, palette, xKey: columns[0]?.name ?? "" } };
}

export function WidgetBuilder(props: Props) {
  // Remount per open so drafts never leak between sessions.
  if (!props.open) return null;
  return <Builder {...props} />;
}

function Builder({ open, mode, initial, sources, theme, palette, getDataset, createDataset, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<WidgetDraft>(
    () => initial ?? { title: "New chart", subtitle: "", note: "", config: { ...DEFAULT_CONFIG, palette }, datasetId: sources.find((s) => s.inReport)?.id ?? sources[0]?.id ?? null }
  );
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"build" | "new-source">(() => (!initial?.datasetId && sources.length === 0 ? "new-source" : "build"));
  const [newData, setNewData] = useState<DataDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(mode === "edit" || initial?.config.type === "text");

  // Load the selected source; when a fresh "add" has untouched defaults, start from a good suggestion.
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
        setDraft((d) => (d.datasetId !== id ? d : !touched || !fits(d.config, ds.columns) ? { ...d, ...starter(ds.columns, ds.rows, palette) } : d));
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

  const suggestions = useMemo(() => (dataset && mode === "add" ? suggestCharts(dataset.columns, dataset.rows, palette).slice(0, 6) : []), [dataset, mode, palette]);

  const asRecord: ChartRecord = {
    _id: "draft",
    reportId: "",
    datasetId: draft.datasetId ?? "",
    title: draft.title,
    subtitle: draft.subtitle,
    note: draft.note,
    config: draft.config,
    size: "half",
    order: 0,
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
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
      setView("build");
      setNewData(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isText = draft.config.type === "text";
  const previewH = draft.config.type === "kpi" ? 260 : isText ? 200 : 440;

  return (
    <Dialog open={open} onClose={onClose} label={mode === "add" ? "Add widget" : "Edit widget"} className="sm:max-w-[1180px]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-5 py-3.5">
        <span className="gradient-brand flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[var(--shadow-glow)]">
          <LayoutGrid className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{view === "new-source" ? "Add a data source" : mode === "add" ? "Add widget" : "Edit widget"}</h2>
          <p className="truncate text-xs text-ink-3">{view === "new-source" ? "Upload a file, paste cells, or pick a sample. It becomes available to every widget." : "Pick the data, the chart and the style. The preview updates as you go."}</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      {view === "new-source" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
            <div className="mx-auto max-w-3xl">
              <DataUploader draft={newData} onReady={setNewData} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t bg-surface-2 px-5 py-3">
            {sources.length > 0 ? (
              <Button variant="ghost" onClick={() => setView("build")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              {error && <span className="text-xs text-danger">{error}</span>}
              <Button onClick={useNewData} disabled={!newData} loading={saving} data-testid="use-new-data">
                <Check className="h-4 w-4" /> Use this data
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* Preview */}
          <div className="relative flex shrink-0 flex-col bg-bg px-4 py-4 scrollbar-thin sm:px-5 sm:py-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <div className="bg-dots pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex flex-wrap items-center gap-2">
              <SourcePicker value={draft.datasetId} options={sources} onChange={(id) => setDraft((d) => ({ ...d, datasetId: id }))} onAddNew={() => setView("new-source")} />
              {dataset && (
                <span className="text-xs text-ink-3">
                  {dataset.rowCount.toLocaleString()} rows · {dataset.columns.length} columns
                </span>
              )}
            </div>

            {suggestions.length > 0 && (
              <div className="relative mt-4">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                  <Wand2 className="h-3.5 w-3.5" /> Quick start
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => {
                    const on = draft.title === s.title && draft.config.type === s.config.type;
                    return (
                      <button
                        key={s.title + s.config.type}
                        onClick={() => {
                          setTouched(true);
                          setDraft((d) => ({ ...d, title: s.title, subtitle: s.subtitle, config: s.config }));
                        }}
                        className={clsx("rounded-full border px-3 py-1.5 text-xs font-medium transition-all", on ? "border-brand bg-brand text-white shadow-[var(--shadow-glow)]" : "bg-surface text-ink-2 hover:-translate-y-px hover:border-brand hover:text-brand")}
                      >
                        {s.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="relative mt-5 flex flex-1 items-start justify-center">
              {!dataset || loading ? (
                <div className="flex h-[300px] w-full items-center justify-center rounded-[18px] border border-dashed bg-surface/70 text-sm text-ink-3">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin text-brand" /> : "Choose a data source to start"}
                </div>
              ) : (
                <div className={clsx("h-[var(--ph-sm)] w-full transition-all duration-300 sm:h-[var(--ph)]", draft.config.type === "kpi" ? "max-w-sm" : "max-w-3xl")} style={{ "--ph": `${previewH}px`, "--ph-sm": `${Math.min(previewH, 320)}px` } as React.CSSProperties} data-testid="widget-preview">
                  <Widget chart={asRecord} rows={dataset.rows} columns={dataset.columns} theme={theme} readOnly fill />
                </div>
              )}
            </div>
            <p className="relative mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-3">
              <Sparkles className="h-3 w-3" /> Tip: after adding, drag the widget by its title and resize it from the corner.
            </p>
          </div>

          {/* Controls */}
          <div className="flex w-full shrink-0 flex-col border-t lg:min-h-0 lg:w-[380px] lg:border-l lg:border-t-0">
            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {dataset && (
                <ChartEditor
                  embedded
                  chart={asRecord}
                  columns={dataset.columns}
                  rows={dataset.rows}
                  onChange={(p) => {
                    setTouched(true);
                    setDraft((d) => ({ ...d, ...(p.title !== undefined && { title: p.title }), ...(p.subtitle !== undefined && { subtitle: p.subtitle }), ...(p.note !== undefined && { note: p.note }), ...(p.config && { config: p.config }) }));
                  }}
                />
              )}
            </div>
            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 border-t bg-surface-2 px-4 py-3">
              {error ? <span className="truncate text-xs text-danger">{error}</span> : <span className="hidden text-[11px] text-ink-3 sm:inline">Esc to cancel</span>}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={save} loading={saving} disabled={!dataset && !isText} data-testid="save-widget">
                  <Check className="h-4 w-4" /> {mode === "add" ? "Add to dashboard" : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
