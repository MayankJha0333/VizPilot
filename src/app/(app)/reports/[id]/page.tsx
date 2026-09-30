"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ArrowLeft, ArrowUp, Check, Copy, Database, Globe, LayoutGrid, Link2, Moon, MoreHorizontal, Play, Plus, Share2, Sparkles, Sun, Trash2, Type, Wand2, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Widget } from "@/components/charts/Widget";
import { DashboardGrid } from "@/components/charts/DashboardGrid";
import { WidgetBuilder, type WidgetDraft } from "@/components/charts/WidgetBuilder";
import { suggestPrompts } from "@/components/ai/AskAI";
import { DataTable } from "@/components/data/DataTable";
import type { SourceOption } from "@/components/data/SourcePicker";
import type { DataDraft } from "@/components/data/DataUploader";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, PageLoader, Tooltip, Wordmark, timeAgo } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { suggestCharts } from "@/lib/charts/suggest";
import { DEFAULT_CONFIG, type ChartConfig, type ChartRecord, type Column, type DatasetRecord, type DatasetSummary, type ReportRecord, type Row } from "@/lib/charts/types";
import { buildLayout, compact, defaultBox, firstFit, minBox, resizeItem, type LayoutItem } from "@/lib/layout/grid";

type Builder = { mode: "add"; initial: WidgetDraft | null } | { mode: "edit"; chartId: string } | { mode: "ask"; initial: WidgetDraft; prompt: string | null } | null;

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell wide>
      <ReportEditor id={id} />
    </AppShell>
  );
}

const EMPTY_ROWS: Row[] = [];
const EMPTY_COLS: Column[] = [];

function ReportEditor({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [datasets, setDatasets] = useState<Record<string, DatasetRecord>>({});
  const [workspace, setWorkspace] = useState<DatasetSummary[]>([]);
  const [charts, setCharts] = useState<ChartRecord[]>([]);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [builder, setBuilder] = useState<Builder>(null);
  const [dataOpen, setDataOpen] = useState(false);
  const [dataTab, setDataTab] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ChartRecord | "report" | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [composer, setComposer] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const layoutRef = useRef<LayoutItem[]>([]);
  const composerRef = useRef<HTMLInputElement>(null);
  const layoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // ---- load --------------------------------------------------------------------
  useEffect(() => {
    api<{ report: ReportRecord; charts: ChartRecord[]; dataset: DatasetRecord | null; datasets?: DatasetRecord[] }>(`/api/reports/${id}`)
      .then((d) => {
        setReport(d.report);
        setCharts(d.charts);
        const map: Record<string, DatasetRecord> = {};
        (d.datasets ?? (d.dataset ? [d.dataset] : [])).forEach((ds) => (map[ds._id] = ds));
        setDatasets(map);
        const built = buildLayout(d.charts.map((c) => ({ i: c._id, box: c.layout, type: c.config.type, size: c.size })));
        setLayout(built);
        // Older reports have no stored layout – persist the computed one once.
        if (d.charts.some((c) => !c.layout)) void api(`/api/reports/${id}`, { method: "PATCH", json: { layouts: built.map(({ i, ...b }) => ({ id: i, ...b })) } }).catch(() => {});
      })
      .catch((err) => setError(err.message));
    api<{ datasets: DatasetSummary[] }>("/api/datasets")
      .then((d) => setWorkspace(d.datasets))
      .catch(() => {});
  }, [id]);

  const primaryId = report?.datasetId ?? null;
  const primary = primaryId ? datasets[primaryId] ?? null : null;
  const theme = report?.theme ?? "light";
  const dark = theme === "dark";

  // Sources: datasets used in this report first, then the rest of the workspace.
  const usedIds = useMemo(() => new Set([primaryId, ...charts.map((c) => c.datasetId)].filter(Boolean) as string[]), [primaryId, charts]);
  const sources: SourceOption[] = useMemo(() => {
    const out = new Map<string, SourceOption>();
    for (const ds of Object.values(datasets)) out.set(ds._id, { id: ds._id, name: ds.name, rowCount: ds.rowCount, columnCount: ds.columns.length, inReport: usedIds.has(ds._id) });
    for (const ds of workspace) if (!out.has(ds._id)) out.set(ds._id, { id: ds._id, name: ds.name, rowCount: ds.rowCount, columnCount: ds.columns.length, inReport: usedIds.has(ds._id) });
    return [...out.values()].sort((a, b) => Number(!!b.inReport) - Number(!!a.inReport));
  }, [datasets, workspace, usedIds]);
  const reportSources = sources.filter((s) => s.inReport);

  const prompts = useMemo(() => suggestPrompts(primary?.columns ?? EMPTY_COLS, primary?.rows ?? EMPTY_ROWS), [primary]);

  const getDataset = useCallback(
    async (dsId: string) => {
      if (datasets[dsId]) return datasets[dsId];
      const d = await api<{ dataset: DatasetRecord }>(`/api/datasets/${dsId}`);
      setDatasets((m) => ({ ...m, [dsId]: d.dataset }));
      return d.dataset;
    },
    [datasets]
  );

  const createDataset = useCallback(async (draft: DataDraft) => {
    const d = await api<{ dataset: DatasetRecord }>("/api/datasets", { method: "POST", json: { name: draft.name, source: draft.source, columns: draft.columns, rows: draft.rows } });
    setDatasets((m) => ({ ...m, [d.dataset._id]: d.dataset }));
    setWorkspace((w) => [{ ...d.dataset }, ...w]);
    return d.dataset;
  }, []);

  // ---- persistence -------------------------------------------------------------
  const flag = (state: "saving" | "saved") => {
    setSaving(state);
    if (state === "saved") setTimeout(() => setSaving("idle"), 1500);
  };

  const patchReport = useCallback(
    async (patch: Partial<ReportRecord>) => {
      setReport((r) => (r ? { ...r, ...patch } : r));
      flag("saving");
      try {
        const d = await api<{ report: ReportRecord }>(`/api/reports/${id}`, { method: "PATCH", json: patch });
        setReport(d.report);
        flag("saved");
      } catch (err) {
        toast.error((err as Error).message);
        setSaving("idle");
      }
    },
    [id, toast]
  );

  const saveLayout = useCallback(
    (next: LayoutItem[]) => {
      setLayout(next);
      layoutRef.current = next;
      if (layoutTimer.current) clearTimeout(layoutTimer.current);
      flag("saving");
      layoutTimer.current = setTimeout(async () => {
        try {
          await api(`/api/reports/${id}`, { method: "PATCH", json: { layouts: layoutRef.current.map(({ i, ...b }) => ({ id: i, ...b })) } });
          flag("saved");
        } catch (err) {
          toast.error((err as Error).message);
          setSaving("idle");
        }
      }, 350);
    },
    [id, toast]
  );

  const createChart = useCallback(
    async (input: { title: string; subtitle?: string; note?: string; config: ChartConfig; datasetId?: string | null; box?: { w: number; h: number } }) => {
      const { w, h } = input.box ?? defaultBox(input.config.type);
      const pos = firstFit(w, h, layoutRef.current);
      const box = { ...pos, w, h };
      const d = await api<{ chart: ChartRecord }>("/api/charts", {
        method: "POST",
        json: {
          reportId: id,
          title: input.title,
          subtitle: input.subtitle ?? "",
          note: input.note ?? "",
          config: input.config,
          size: "half",
          layout: box,
          ...(input.datasetId ? { datasetId: input.datasetId } : {}),
        },
      });
      setCharts((cs) => [...cs, d.chart]);
      const next = compact([...layoutRef.current, { i: d.chart._id, ...box }]);
      setLayout(next);
      layoutRef.current = next;
      if (!report?.datasetId && d.chart.datasetId) setReport((r) => (r ? { ...r, datasetId: d.chart.datasetId } : r));
      setFlash(d.chart._id);
      setTimeout(() => setFlash(null), 1600);
      setTimeout(() => document.querySelector(`[data-grid-item="${d.chart._id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
      return d.chart;
    },
    [id, report?.datasetId]
  );

  const saveWidget = async (draft: WidgetDraft) => {
    if (builder?.mode === "edit") {
      const chartId = builder.chartId;
      const patch = { title: draft.title, subtitle: draft.subtitle, note: draft.note, config: draft.config, ...(draft.datasetId ? { datasetId: draft.datasetId } : {}) };
      await api(`/api/charts/${chartId}`, { method: "PATCH", json: patch });
      setCharts((cs) => cs.map((c) => (c._id === chartId ? { ...c, ...patch, datasetId: draft.datasetId ?? c.datasetId } : c)));
      // Size chosen in the studio → resize on the grid (others re-flow).
      const cur = layout.find((l) => l.i === chartId);
      if (draft.box && cur && (cur.w !== draft.box.w || cur.h !== draft.box.h)) saveLayout(resizeItem(layout, chartId, draft.box.w, draft.box.h));
      toast.success("Widget updated");
    } else {
      await createChart(draft);
      toast.success(builder?.mode === "ask" ? "Added to dashboard" : "Widget added");
    }
  };

  const addText = () => setBuilder({ mode: "add", initial: { title: "Summary", subtitle: "", note: "", config: { ...DEFAULT_CONFIG, type: "text", palette: report?.palette ?? "aurora" }, datasetId: primaryId ?? sources[0]?.id ?? null } });

  const addSuggested = async () => {
    if (!primary) return;
    const s = suggestCharts(primary.columns, primary.rows, report?.palette ?? "aurora");
    try {
      for (const sug of s) await createChart({ title: sug.title, subtitle: sug.subtitle, config: sug.config, datasetId: primary._id });
      toast.success(`Added ${s.length} suggested widgets`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const duplicateChart = async (c: ChartRecord) => {
    try {
      const d = await api<{ chart: ChartRecord }>(`/api/charts/${c._id}`, { method: "POST" });
      const src = layout.find((l) => l.i === c._id);
      const w = src?.w ?? 6;
      const h = src?.h ?? 10;
      const pos = firstFit(w, h, layout);
      setCharts((cs) => [...cs, d.chart]);
      saveLayout(compact([...layout, { i: d.chart._id, ...pos, w, h }]));
      toast.success("Widget duplicated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const deleteChart = async (c: ChartRecord) => {
    try {
      await api(`/api/charts/${c._id}`, { method: "DELETE" });
      setCharts((cs) => cs.filter((x) => x._id !== c._id));
      saveLayout(compact(layout.filter((l) => l.i !== c._id)));
      toast.success("Widget deleted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const deleteReport = async () => {
    try {
      await api(`/api/reports/${id}`, { method: "DELETE" });
      toast.success("Report deleted");
      router.push("/dashboard");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const saveDataset = async (dsId: string, next: { columns: Column[]; rows: Row[] }) => {
    setDatasets((m) => (m[dsId] ? { ...m, [dsId]: { ...m[dsId], ...next, rowCount: next.rows.length } } : m));
    flag("saving");
    try {
      await api(`/api/datasets/${dsId}`, { method: "PATCH", json: next });
      flag("saved");
    } catch (err) {
      toast.error((err as Error).message);
      setSaving("idle");
    }
  };

  /** Which report data source best matches the question (column names + values)? */
  const bestSourceFor = (prompt: string): string | null => {
    const words = prompt.toLowerCase().match(/[a-z0-9%]{3,}/g) ?? [];
    if (!words.length) return null;
    let best: { id: string; score: number } | null = null;
    for (const s of reportSources) {
      const ds = datasets[s.id];
      if (!ds) continue;
      const names = ds.columns.map((c) => c.name.toLowerCase());
      const values = new Set<string>();
      for (const r of ds.rows.slice(0, 300)) for (const c of ds.columns) if (c.type === "string" && r[c.name] != null) values.add(String(r[c.name]).toLowerCase());
      const entity = ds.name.toLowerCase();
      let score = 0;
      for (const w of words) {
        const stem = w.replace(/s$/, "");
        if (names.some((n) => n.includes(stem))) score += 3;
        else if ([...values].some((v) => v.includes(stem))) score += 1;
        if (entity.includes(stem)) score += 2;
      }
      if (!best || score > best.score) best = { id: s.id, score };
    }
    return best && best.score > 0 ? best.id : null;
  };

  /** Ask AI opens the chart studio in "ask" mode, on the source that best fits the question. */
  const openAsk = (prompt?: string) => {
    const pick = prompt ? bestSourceFor(prompt) : null;
    setBuilder({
      mode: "ask",
      prompt: prompt ?? null,
      initial: { title: "", subtitle: "", note: "", config: { ...DEFAULT_CONFIG, palette: report?.palette ?? "aurora" }, datasetId: pick ?? primaryId ?? sources[0]?.id ?? null },
    });
  };

  // ---- keyboard ------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (builder) return;
        composerRef.current?.focus();
      }
      if (e.key === "Escape" && present) setPresent(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [builder, present]);

  // ---- render --------------------------------------------------------------------
  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20">
        <EmptyState title="Couldn't open this report" description={error} action={<Link href="/dashboard"><Button>Back to home</Button></Link>} />
      </div>
    );
  }
  if (!report) return <PageLoader label="Opening report…" />;

  const shareUrl = report.shareId && typeof window !== "undefined" ? `${window.location.origin}/share/${report.shareId}` : "";
  const multiSource = reportSources.length > 1;
  const editing = builder?.mode === "edit" ? charts.find((c) => c._id === builder.chartId) ?? null : null;

  const gridItems = (readOnly: boolean) =>
    charts.map((c, i) => {
      const ds = datasets[c.datasetId] ?? primary;
      const min = minBox(c.config.type);
      return {
        id: c._id,
        minW: min.w,
        minH: min.h,
        className: flash === c._id ? "animate-flash rounded-[18px]" : undefined,
        node: (
          <Widget
            chart={c}
            rows={ds?.rows ?? EMPTY_ROWS}
            columns={ds?.columns ?? EMPTY_COLS}
            theme={theme}
            index={i}
            readOnly={readOnly}
            draggable={!readOnly}
            fill
            sourceName={multiSource ? ds?.name : undefined}
            onSelect={readOnly ? undefined : () => setBuilder({ mode: "edit", chartId: c._id })}
            onDuplicate={() => duplicateChart(c)}
            onDelete={() => setConfirmDelete(c)}
          />
        ),
      };
    });

  if (present) {
    return (
      <div data-theme={theme} className="canvas-dots fixed inset-0 z-[85] overflow-y-auto text-ink animate-fade-in">
        <div className="glass sticky top-0 z-40 flex items-center justify-between px-6 py-3">
          <Wordmark dark={dark} size={24} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-3">Press Esc to exit</span>
            <Button size="sm" variant="ghost" onClick={() => setPresent(false)}>
              <X className="h-4 w-4" /> Exit
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight">{report.title}</h1>
          {report.description && <p className="mt-2 max-w-2xl text-ink-2">{report.description}</p>}
          <div className="mt-8">
            <DashboardGrid layout={layout} items={gridItems(true)} dark={dark} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-theme={theme} className={clsx("flex min-h-[calc(100vh-56px)] flex-col bg-bg text-ink transition-colors duration-300", dark ? "overflow-clip lg:my-3 lg:mr-3 lg:min-h-[calc(100vh-24px)] lg:rounded-[28px] lg:shadow-[var(--shadow-lg)]" : "lg:min-h-screen")}>
      {/* Top bar */}
      <div className="glass sticky top-14 z-40 flex flex-wrap items-center gap-2 px-3 py-2 sm:h-14 sm:flex-nowrap sm:px-5 sm:py-0 lg:top-0">
        <Tooltip label="Back to home" side="bottom">
          <Link href="/dashboard" className="clay-sm clay-press flex h-9 w-9 items-center justify-center rounded-[14px] text-ink-3 transition-colors hover:text-ink" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Tooltip>
        <div className="flex min-w-0 flex-1 flex-col">
          <input
            className="min-w-0 rounded-xl bg-transparent px-2 py-0.5 text-base font-extrabold text-ink outline-none transition-colors hover:bg-surface-3/70 focus:bg-surface-2 focus:shadow-[var(--clay-inset)] sm:text-lg"
            value={report.title}
            onChange={(e) => setReport({ ...report, title: e.target.value })}
            onBlur={(e) => e.target.value.trim() && patchReport({ title: e.target.value.trim() })}
            aria-label="Report title"
            data-testid="report-title-input"
          />
          <div className="hidden items-center gap-2 px-2 text-[11px] text-ink-3 sm:flex">
            {reportSources.length > 0 && (
              <button onClick={() => setDataOpen(true)} className="inline-flex items-center gap-1 hover:text-ink" data-testid="sources-meta">
                <Database className="h-3 w-3" />
                {multiSource ? `${reportSources.length} data sources` : `${primary?.name ?? reportSources[0]?.name} · ${(primary?.rowCount ?? reportSources[0]?.rowCount ?? 0).toLocaleString()} rows`}
              </button>
            )}
            <span>·</span>
            <span>
              {charts.length} widget{charts.length === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span className={clsx("inline-flex items-center gap-1 transition-colors", saving === "saved" ? "text-success" : "")} data-testid="save-state">
              {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : `Edited ${timeAgo(report.updatedAt)}`}
            </span>
          </div>
        </div>
        <div className="flex w-full items-center justify-end gap-1.5 sm:ml-auto sm:w-auto">
          <Tooltip label={dark ? "Switch to light" : "Switch to dark"} side="bottom">
            <button
              role="switch"
              aria-checked={dark}
              aria-label="Toggle theme"
              onClick={() => patchReport({ theme: dark ? "light" : "dark" })}
              className="clay-inset relative flex h-9 w-[66px] shrink-0 items-center justify-between rounded-full px-2.5 text-ink-3 transition-colors"
            >
              <span className={clsx("absolute top-[4px] h-7 w-7 rounded-full bg-surface shadow-[var(--shadow-sm)] transition-transform duration-300 ease-[var(--ease-spring)]", dark ? "translate-x-[26px]" : "-translate-x-[6px]")} />
              <Sun className={clsx("relative h-3.5 w-3.5 transition-colors", !dark && "text-warning")} />
              <Moon className={clsx("relative h-3.5 w-3.5 transition-colors", dark && "text-brand")} />
            </button>
          </Tooltip>
          <Tooltip label="Present" side="bottom">
            <Button size="sm" variant="ghost" onClick={() => setPresent(true)} aria-label="Present" disabled={charts.length === 0}>
              <Play className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Button size="sm" variant="soft" onClick={() => openAsk()} disabled={sources.length === 0} data-testid="ask-ai">
            <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Ask AI</span>
          </Button>
          <Menu
            trigger={
              <Button size="sm" data-testid="add-chart">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add</span>
              </Button>
            }
            items={[
              { label: "Widget…", icon: <LayoutGrid className="h-4 w-4" />, onClick: () => setBuilder({ mode: "add", initial: null }) },
              { label: "Text block", icon: <Type className="h-4 w-4" />, onClick: addText },
              { label: "Suggested widgets", icon: <Wand2 className="h-4 w-4" />, onClick: addSuggested, disabled: !primary },
              { label: "Widget from new data…", icon: <Database className="h-4 w-4" />, onClick: () => setBuilder({ mode: "add", initial: { title: "New chart", subtitle: "", note: "", config: { ...DEFAULT_CONFIG, palette: report.palette }, datasetId: null } }) },
            ]}
          />
          <Button size="sm" variant="outline" onClick={() => setShareOpen(true)} data-testid="share">
            <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Share</span>
          </Button>
          <Menu
            trigger={
              <button className="clay-sm clay-press flex h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:text-ink" aria-label="More">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
            items={[
              { label: "View & edit data", icon: <Database className="h-4 w-4" />, onClick: () => setDataOpen(true), disabled: reportSources.length === 0 },
              {
                label: "Duplicate report",
                icon: <Copy className="h-4 w-4" />,
                onClick: async () => {
                  const d = await api<{ report: { _id: string } }>(`/api/reports/${id}/duplicate`, { method: "POST" });
                  router.push(`/reports/${d.report._id}`);
                },
              },
              { label: "Delete report", icon: <Trash2 className="h-4 w-4" />, onClick: () => setConfirmDelete("report"), danger: true },
            ]}
          />
        </div>
      </div>

      {/* Canvas */}
      <div className="canvas-dots relative min-w-0 flex-1 px-3 pb-32 pt-5 transition-colors duration-300 sm:px-6">
        {report.description && <p className="mb-4 max-w-2xl text-sm text-ink-2 animate-fade-up">{report.description}</p>}

        {charts.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="Start building your dashboard"
            description={primary ? `${primary.name} has ${primary.rowCount.toLocaleString()} rows and ${primary.columns.length} columns. Ask AI, let us suggest widgets, or add one yourself — from this data or any other source.` : "Add a widget and pick its data — upload a file, paste a table or use a sample."}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {sources.length > 0 && (
                  <Button onClick={() => openAsk()}>
                    <Sparkles className="h-4 w-4" /> Ask AI
                  </Button>
                )}
                {primary && (
                  <Button variant="outline" onClick={addSuggested} data-testid="suggest-charts">
                    <Wand2 className="h-4 w-4" /> Suggest widgets
                  </Button>
                )}
                <Button variant="outline" onClick={() => setBuilder({ mode: "add", initial: null })}>
                  <Plus className="h-4 w-4" /> Add widget
                </Button>
              </div>
            }
          />
        ) : (
          <DashboardGrid
            layout={layout}
            items={gridItems(false)}
            editable
            dark={dark}
            onLayoutChange={saveLayout}
          />
        )}

        {/* Floating AI composer */}
        {sources.length > 0 && !builder && (
          <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 lg:left-[264px]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!composer.trim()) return;
                openAsk(composer.trim());
                setComposer("");
              }}
              className="pointer-events-auto w-full max-w-2xl animate-slide-up"
            >
              <div className="flex items-center gap-2 rounded-full border-[1.5px] border-[var(--input-border)] bg-surface p-2 pl-4 shadow-[var(--shadow-lg)] transition-shadow focus-within:shadow-[0_0_0_4px_var(--ring),var(--shadow-lg)]">
                <span className="clay-tile h-8 w-8 shrink-0 rounded-full bg-clay-lavender text-clay-lavender-ink"><Sparkles className="h-4 w-4" /></span>
                <input
                  ref={composerRef}
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm font-semibold text-ink outline-none placeholder:text-ink-3"
                  placeholder={prompts[0] ? `Ask AI about your data… e.g. “${prompts[0]}”` : "Ask AI about your data…"}
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  data-testid="ai-composer"
                />
                <span className="kbd hidden sm:inline-flex">⌘K</span>
                <button type="submit" disabled={!composer.trim()} className="clay-brand clay-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0" aria-label="Ask">
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Chart studio: add / edit / Ask AI */}
      <WidgetBuilder
        open={!!builder && (builder.mode !== "edit" || !!editing)}
        mode={builder?.mode ?? "add"}
        initialPrompt={builder?.mode === "ask" ? builder.prompt : null}
        initial={
          builder?.mode === "edit" && editing
            ? (() => {
                const l = layout.find((x) => x.i === editing._id);
                return { title: editing.title, subtitle: editing.subtitle, note: editing.note, config: editing.config, datasetId: editing.datasetId, box: l ? { w: l.w, h: l.h } : undefined };
              })()
            : builder?.mode === "ask"
              ? builder.initial
              : builder?.mode === "add"
                ? builder.initial ?? { title: "New chart", subtitle: "", note: "", config: { ...DEFAULT_CONFIG, palette: report.palette }, datasetId: primaryId ?? sources[0]?.id ?? null }
                : null
        }
        sources={sources}
        theme={theme}
        palette={report.palette}
        reportTitle={report.title}
        onEditData={(dsId, next) => void saveDataset(dsId, next)}
        getDataset={getDataset}
        createDataset={createDataset}
        onSave={saveWidget}
        onClose={() => setBuilder(null)}
      />


      {/* Data sources */}
      <Modal open={dataOpen} onClose={() => setDataOpen(false)} title={multiSource ? "Data sources" : primary?.name ?? "Data"} description="Edit cells, rename columns or change types. Widgets update as you go." size="xl">
        {multiSource && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {reportSources.map((s) => {
              const on = (dataTab ?? reportSources[0].id) === s.id;
              return (
                <button key={s.id} onClick={() => void getDataset(s.id).then(() => setDataTab(s.id))} className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors", on ? "clay-inset text-brand-ink" : "clay-sm clay-press text-ink-2")}>
                  <Database className="h-3 w-3" /> {s.name}
                </button>
              );
            })}
          </div>
        )}
        {(() => {
          const ds = datasets[dataTab ?? reportSources[0]?.id ?? ""] ?? primary;
          return ds ? <DataTable key={ds._id} columns={ds.columns} rows={ds.rows} editable onChange={(next) => saveDataset(ds._id, next)} maxHeight={480} /> : null;
        })()}
      </Modal>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share report" description="Publish a read-only link anyone can open, no login needed." size="sm">
        <div className="space-y-4">
          <button onClick={() => patchReport({ isPublic: !report.isPublic })} className="clay-sm clay-press flex w-full items-center justify-between rounded-[20px] p-3 text-left transition-colors" data-testid="toggle-public">
            <div className="flex items-center gap-3">
              <span className={clsx("flex h-9 w-9 items-center justify-center rounded-lg transition-colors", report.isPublic ? "clay-tile bg-clay-mint text-clay-mint-ink" : "clay-tile bg-surface-3 text-ink-3")}>
                <Globe className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-medium">{report.isPublic ? "Public link is on" : "Publish to the web"}</div>
                <div className="text-xs text-ink-3">{report.isPublic ? "Anyone with the link can view" : "Currently only you can see this report"}</div>
              </div>
            </div>
            <span className={clsx("relative h-6 w-11 rounded-full shadow-[var(--clay-inset)] transition-colors", report.isPublic ? "bg-brand" : "bg-surface-3")}>
              <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[var(--shadow-sm)] transition-transform", report.isPublic ? "translate-x-[22px]" : "translate-x-0.5")} />
            </span>
          </button>
          {report.isPublic && shareUrl && (
            <div className="flex items-center gap-2 animate-fade-up">
              <input readOnly className="input font-mono text-xs" value={shareUrl} data-testid="share-url" />
              <CopyButton text={shareUrl} />
            </div>
          )}
          <p className="text-xs text-ink-3">Tip: use Present (▶) for a clean full-screen view in meetings.</p>
        </div>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete === "report" ? "Delete this report?" : "Delete this widget?"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              data-testid="confirm-delete"
              onClick={() => {
                const target = confirmDelete;
                setConfirmDelete(null);
                if (target === "report") deleteReport();
                else if (target) deleteChart(target);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">{confirmDelete === "report" ? "All widgets in this report will be removed. Your datasets stay." : "This can't be undone."}</p>
      </Modal>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
      {done ? "Copied" : "Copy"}
    </Button>
  );
}
