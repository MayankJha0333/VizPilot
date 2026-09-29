"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ArrowLeft, ArrowUp, Check, Copy, Database, Globe, Link2, Moon, MoreHorizontal, Play, Plus, Share2, Sparkles, Sun, Trash2, Type, Wand2, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SIZE_CLASS, Widget } from "@/components/charts/Widget";
import { ChartEditor } from "@/components/charts/ChartEditor";
import { AskAI, suggestPrompts } from "@/components/ai/AskAI";
import { DataTable } from "@/components/data/DataTable";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, PageLoader, Tooltip, Wordmark, timeAgo } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { suggestCharts } from "@/lib/charts/suggest";
import { DEFAULT_CONFIG, type ChartConfig, type ChartRecord, type Column, type DatasetRecord, type ReportRecord, type Row, type WidgetSize } from "@/lib/charts/types";

type Panel = { kind: "none" } | { kind: "edit"; chartId: string } | { kind: "ai" };

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell wide>
      <ReportEditor id={id} />
    </AppShell>
  );
}

function ReportEditor({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [charts, setCharts] = useState<ChartRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>({ kind: "none" });
  const [dataOpen, setDataOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ChartRecord | "report" | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const chartsRef = useRef<ChartRecord[]>([]);
  const composerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    chartsRef.current = charts;
  }, [charts]);

  useEffect(() => {
    api<{ report: ReportRecord; charts: ChartRecord[]; dataset: DatasetRecord | null }>(`/api/reports/${id}`)
      .then((d) => {
        setReport(d.report);
        setCharts(d.charts);
        setDataset(d.dataset);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (panel.kind === "ai") return;
        setPanel({ kind: "none" });
        setTimeout(() => composerRef.current?.focus(), 30);
      }
      if (e.key === "Escape") {
        if (present) setPresent(false);
        else if (!dataOpen && !shareOpen && !confirmDelete) setPanel({ kind: "none" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel.kind, dataOpen, shareOpen, confirmDelete, present]);

  const columns: Column[] = useMemo(() => dataset?.columns ?? [], [dataset]);
  const rows: Row[] = useMemo(() => dataset?.rows ?? [], [dataset]);
  const theme = report?.theme ?? "light";
  const prompts = useMemo(() => suggestPrompts(columns, rows), [columns, rows]);

  // ---- persistence -----------------------------------------------------------
  const flag = (state: "saving" | "saved") => {
    setSaving(state);
    if (state === "saved") setTimeout(() => setSaving("idle"), 1500);
  };

  const patchReport = useCallback(
    async (patch: Partial<ReportRecord> & { chartOrder?: string[] }) => {
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

  const updateChart = useCallback(
    (chartId: string, patch: Partial<ChartRecord>) => {
      setCharts((cs) => cs.map((c) => (c._id === chartId ? { ...c, ...patch } : c)));
      clearTimeout(timers.current[chartId]);
      flag("saving");
      timers.current[chartId] = setTimeout(async () => {
        try {
          const { title, subtitle, note, config, size } = chartsRef.current.find((c) => c._id === chartId) as ChartRecord;
          await api(`/api/charts/${chartId}`, { method: "PATCH", json: { title, subtitle, note, config, size } });
          flag("saved");
        } catch (err) {
          toast.error((err as Error).message);
          setSaving("idle");
        }
      }, 500);
    },
    [toast]
  );

  const createChart = useCallback(
    async (input: { title: string; subtitle?: string; note?: string; config: ChartConfig; size?: WidgetSize }, select = true) => {
      try {
        const d = await api<{ chart: ChartRecord }>("/api/charts", {
          method: "POST",
          json: { reportId: id, title: input.title, subtitle: input.subtitle ?? "", note: input.note ?? "", config: input.config, size: input.size ?? (input.config.type === "kpi" ? "sm" : "half") },
        });
        setCharts((cs) => [...cs, d.chart]);
        setFlash(d.chart._id);
        setTimeout(() => setFlash(null), 1600);
        if (select) setPanel({ kind: "edit", chartId: d.chart._id });
        return d.chart;
      } catch (err) {
        toast.error((err as Error).message);
        return null;
      }
    },
    [id, toast]
  );

  const addBlankChart = () => {
    const numeric = columns.filter((c) => c.type === "number");
    const cat = columns.find((c) => c.type !== "number") ?? columns[0];
    createChart({
      title: "New chart",
      config: { ...DEFAULT_CONFIG, palette: report?.palette ?? "aurora", xKey: cat?.name ?? "", yKeys: numeric[0] ? [numeric[0].name] : [], aggregate: numeric[0] ? "sum" : "count" },
    });
  };
  const addText = () => createChart({ title: "Summary", note: "", config: { ...DEFAULT_CONFIG, type: "text", palette: report?.palette ?? "aurora" }, size: "full" });

  const addSuggested = async () => {
    const s = suggestCharts(columns, rows, report?.palette ?? "aurora");
    for (const [i, sug] of s.entries()) {
      await createChart({ title: sug.title, subtitle: sug.subtitle, config: sug.config, size: sug.config.type === "kpi" ? "sm" : i === 0 ? "wide" : "half" }, false);
    }
    toast.success(`Added ${s.length} suggested widgets`);
  };

  const duplicateChart = async (c: ChartRecord) => {
    try {
      const d = await api<{ chart: ChartRecord }>(`/api/charts/${c._id}`, { method: "POST" });
      setCharts((cs) => [...cs, d.chart]);
      toast.success("Widget duplicated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const deleteChart = async (c: ChartRecord) => {
    try {
      await api(`/api/charts/${c._id}`, { method: "DELETE" });
      setCharts((cs) => cs.filter((x) => x._id !== c._id));
      if (panel.kind === "edit" && panel.chartId === c._id) setPanel({ kind: "none" });
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

  const saveDataset = async (next: { columns: Column[]; rows: Row[] }) => {
    if (!dataset) return;
    setDataset({ ...dataset, ...next, rowCount: next.rows.length });
    flag("saving");
    try {
      await api(`/api/datasets/${dataset._id}`, { method: "PATCH", json: next });
      flag("saved");
    } catch (err) {
      toast.error((err as Error).message);
      setSaving("idle");
    }
  };

  // ---- drag & drop reorder ----------------------------------------------------
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = charts.findIndex((c) => c._id === dragId);
    const to = charts.findIndex((c) => c._id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...charts];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setCharts(next);
    setDragId(null);
    setOverId(null);
    patchReport({ chartOrder: next.map((x) => x._id) });
  };

  const askFromComposer = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setComposer("");
    setAiPrompt(t);
    setPanel({ kind: "ai" });
  };

  const addAIChart = async (c: { title: string; subtitle: string; config: ChartConfig }) => {
    await createChart({ title: c.title, subtitle: c.subtitle, note: "", config: c.config }, false);
    toast.success("Added to report");
  };

  // ---- render ------------------------------------------------------------------
  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20">
        <EmptyState title="Couldn't open this report" description={error} action={<Link href="/dashboard"><Button>Back to home</Button></Link>} />
      </div>
    );
  }
  if (!report) return <PageLoader label="Opening report…" />;

  const selected = panel.kind === "edit" ? charts.find((c) => c._id === panel.chartId) ?? null : null;
  const dark = theme === "dark";
  const shareUrl = report.shareId && typeof window !== "undefined" ? `${window.location.origin}/share/${report.shareId}` : "";

  const panelContent =
    panel.kind === "edit" && selected ? (
      <ChartEditor chart={selected} columns={columns} rows={rows} onChange={(p) => updateChart(selected._id, p)} onClose={() => setPanel({ kind: "none" })} />
    ) : panel.kind === "ai" && dataset ? (
      <AskAI datasetId={dataset._id} datasetName={dataset.name} columns={columns} rows={rows} palette={report.palette} initialPrompt={aiPrompt} onConsumePrompt={() => setAiPrompt(null)} onClose={() => setPanel({ kind: "none" })} onAddChart={addAIChart} />
    ) : null;

  const grid = (readOnly: boolean) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12" data-testid="chart-grid">
      {charts.map((c, i) => (
        <div
          key={c._id}
          className={clsx("relative min-w-0", SIZE_CLASS[c.size] ?? SIZE_CLASS.half, flash === c._id && "animate-flash rounded-[18px]", dragId === c._id && "dragging", overId === c._id && dragId !== c._id && "drop-target")}
          draggable={!readOnly}
          onDragStart={(e) => {
            if (readOnly) return;
            setDragId(c._id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (readOnly || !dragId) return;
            e.preventDefault();
            setOverId(c._id);
          }}
          onDragLeave={() => setOverId((o) => (o === c._id ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            onDrop(c._id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
        >
          <Widget
            chart={c}
            rows={rows}
            columns={columns}
            theme={theme}
            index={i}
            readOnly={readOnly}
            draggable={!readOnly}
            selected={!readOnly && selected?._id === c._id}
            onSelect={readOnly ? undefined : () => setPanel({ kind: "edit", chartId: c._id })}
            onDuplicate={() => duplicateChart(c)}
            onDelete={() => setConfirmDelete(c)}
            onResize={(size) => updateChart(c._id, { size })}
          />
        </div>
      ))}
      {!readOnly && (
        <button
          onClick={addBlankChart}
          className={clsx(
            "group flex h-[200px] flex-col items-center justify-center rounded-[18px] border-2 border-dashed text-sm font-medium transition-all duration-200 md:col-span-6 xl:col-span-4",
            dark ? "border-white/15 text-white/50 hover:border-white/40 hover:text-white" : "border-border-strong text-ink-2 hover:border-brand hover:bg-brand-soft/30 hover:text-brand"
          )}
        >
          <span className={clsx("flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110", dark ? "bg-white/10" : "bg-surface shadow-[var(--shadow-sm)]")}>
            <Plus className="h-5 w-5" />
          </span>
          <span className="mt-2">Add widget</span>
        </button>
      )}
    </div>
  );

  if (present) {
    return (
      <div className={clsx("fixed inset-0 z-[85] overflow-y-auto animate-fade-in", dark ? "bg-[#0b0d1a] text-white" : "bg-bg")}>
        <div className={clsx("sticky top-0 z-10 flex items-center justify-between px-6 py-3", dark ? "bg-[#0b0d1a]/80 backdrop-blur" : "glass")}>
          <Wordmark dark={dark} size={24} />
          <div className="flex items-center gap-2">
            <span className={clsx("text-xs", dark ? "text-white/50" : "text-ink-3")}>Press Esc to exit</span>
            <Button size="sm" variant={dark ? "outline" : "ghost"} onClick={() => setPresent(false)}>
              <X className="h-4 w-4" /> Exit
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          <h1 className="text-3xl font-semibold tracking-tight">{report.title}</h1>
          {report.description && <p className={clsx("mt-2 max-w-2xl", dark ? "text-white/60" : "text-ink-2")}>{report.description}</p>}
          <div className="mt-8">{grid(true)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col lg:min-h-screen">
      {/* Top bar */}
      <div className="glass sticky top-14 z-20 flex flex-wrap items-center gap-2 px-3 py-2 sm:h-14 sm:flex-nowrap sm:px-5 sm:py-0 lg:top-0">
        <Tooltip label="Back to home" side="bottom">
          <Link href="/dashboard" className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Tooltip>
        <div className="flex min-w-0 flex-1 flex-col">
          <input
            className="min-w-0 rounded-lg bg-transparent px-2 py-0.5 text-base font-semibold text-ink outline-none transition-colors hover:bg-surface-3/70 focus:bg-surface focus:ring-2 focus:ring-brand/30 sm:text-lg"
            value={report.title}
            onChange={(e) => setReport({ ...report, title: e.target.value })}
            onBlur={(e) => e.target.value.trim() && e.target.value !== report.title && patchReport({ title: e.target.value.trim() })}
            aria-label="Report title"
            data-testid="report-title-input"
          />
          <div className="hidden items-center gap-2 px-2 text-[11px] text-ink-3 sm:flex">
            {dataset && (
              <button onClick={() => setDataOpen(true)} className="inline-flex items-center gap-1 hover:text-ink">
                <Database className="h-3 w-3" /> {dataset.name} · {dataset.rowCount.toLocaleString()} rows
              </button>
            )}
            <span>·</span>
            <span>{charts.length} widget{charts.length === 1 ? "" : "s"}</span>
            <span>·</span>
            <span className={clsx("inline-flex items-center gap-1 transition-colors", saving === "saved" ? "text-success" : "")} data-testid="save-state">
              {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : `Edited ${timeAgo(report.updatedAt)}`}
            </span>
          </div>
        </div>
        <div className="flex w-full items-center justify-end gap-1.5 sm:ml-auto sm:w-auto">
          <Tooltip label={dark ? "Light theme" : "Dark theme"} side="bottom">
            <Button size="sm" variant="ghost" onClick={() => patchReport({ theme: dark ? "light" : "dark" })} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </Tooltip>
          <Tooltip label="Present" side="bottom">
            <Button size="sm" variant="ghost" onClick={() => setPresent(true)} aria-label="Present" disabled={charts.length === 0}>
              <Play className="h-4 w-4" />
            </Button>
          </Tooltip>
          {dataset && (
            <Button size="sm" variant={panel.kind === "ai" ? "secondary" : "soft"} onClick={() => setPanel(panel.kind === "ai" ? { kind: "none" } : { kind: "ai" })} data-testid="ask-ai">
              <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Ask AI</span>
            </Button>
          )}
          {dataset && (
            <Menu
              trigger={
                <Button size="sm" data-testid="add-chart">
                  <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add</span>
                </Button>
              }
              items={[
                { label: "Chart", icon: <Plus className="h-4 w-4" />, onClick: addBlankChart },
                { label: "Text block", icon: <Type className="h-4 w-4" />, onClick: addText },
                { label: "Suggested widgets", icon: <Wand2 className="h-4 w-4" />, onClick: addSuggested },
              ]}
            />
          )}
          <Button size="sm" variant="outline" onClick={() => setShareOpen(true)} data-testid="share">
            <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Share</span>
          </Button>
          <Menu
            trigger={
              <button className="rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="More">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
            items={[
              { label: "View & edit data", icon: <Database className="h-4 w-4" />, onClick: () => setDataOpen(true), disabled: !dataset },
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

      <div className="flex flex-1">
        {/* Canvas */}
        <div className={clsx("relative min-w-0 flex-1 px-3 pb-32 pt-5 transition-colors duration-300 sm:px-6", dark ? "bg-[#0f1122]" : "bg-bg")}>
          {report.description && <p className={clsx("mb-4 max-w-2xl text-sm animate-fade-up", dark ? "text-white/60" : "text-ink-2")}>{report.description}</p>}

          {!dataset ? (
            <EmptyState icon={<Database className="h-6 w-6" />} title="This report has no data yet" description="Attach a dataset to start adding widgets." action={<Link href="/reports/new"><Button>Create a report with data</Button></Link>} />
          ) : charts.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="Start building your report"
              description={`${dataset.name} has ${dataset.rowCount.toLocaleString()} rows and ${columns.length} columns. Ask AI, let us suggest widgets, or add one yourself.`}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setPanel({ kind: "ai" })}>
                    <Sparkles className="h-4 w-4" /> Ask AI
                  </Button>
                  <Button variant="outline" onClick={addSuggested} data-testid="suggest-charts">
                    <Wand2 className="h-4 w-4" /> Suggest widgets
                  </Button>
                  <Button variant="outline" onClick={addBlankChart}>
                    <Plus className="h-4 w-4" /> Blank chart
                  </Button>
                </div>
              }
            />
          ) : (
            grid(false)
          )}

          {/* Floating AI composer */}
          {dataset && panel.kind !== "ai" && (
            <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 lg:left-[248px]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  askFromComposer(composer);
                }}
                className="pointer-events-auto w-full max-w-2xl animate-slide-up"
              >
                <div className="gradient-border flex items-center gap-2 rounded-2xl bg-surface/95 p-1.5 pl-3 shadow-[var(--shadow-lg)] backdrop-blur transition-shadow focus-within:shadow-[0_0_0_3px_var(--ring),var(--shadow-lg)]">
                  <Sparkles className="h-4 w-4 shrink-0 text-brand" />
                  <input
                    ref={composerRef}
                    className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink-3"
                    placeholder={prompts[0] ? `Ask AI about your data… e.g. “${prompts[0]}”` : "Ask AI about your data…"}
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    data-testid="ai-composer"
                  />
                  <span className="kbd hidden sm:inline-flex">⌘K</span>
                  <button type="submit" disabled={!composer.trim()} className="gradient-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-[var(--shadow-glow)] transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100" aria-label="Ask">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {panel.kind !== "none" && (
          <aside className="hidden w-[400px] shrink-0 border-l bg-surface lg:block animate-slide-in-right">
            <div className="sticky top-14 h-[calc(100vh-56px)]">{panelContent}</div>
          </aside>
        )}
      </div>

      {panel.kind !== "none" && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-ink/40 animate-fade-in" onClick={() => setPanel({ kind: "none" })} />
          <div className="absolute inset-x-0 bottom-0 h-[82vh] rounded-t-3xl bg-surface shadow-[var(--shadow-lg)] animate-slide-up">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong" />
            <div className="h-[calc(82vh-12px)]">{panelContent}</div>
          </div>
        </div>
      )}

      <Modal open={dataOpen} onClose={() => setDataOpen(false)} title={dataset?.name ?? "Data"} description="Edit cells, rename columns or change types. Widgets update as you go." size="xl">
        {dataset && <DataTable columns={columns} rows={rows} editable onChange={saveDataset} maxHeight={480} />}
      </Modal>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share report" description="Publish a read-only link anyone can open, no login needed." size="sm">
        <div className="space-y-4">
          <button onClick={() => patchReport({ isPublic: !report.isPublic })} className="flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors hover:bg-surface-2" data-testid="toggle-public">
            <div className="flex items-center gap-3">
              <span className={clsx("flex h-9 w-9 items-center justify-center rounded-lg transition-colors", report.isPublic ? "bg-green-50 text-green-600" : "bg-surface-3 text-ink-3")}>
                <Globe className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-medium">{report.isPublic ? "Public link is on" : "Publish to the web"}</div>
                <div className="text-xs text-ink-3">{report.isPublic ? "Anyone with the link can view" : "Currently only you can see this report"}</div>
              </div>
            </div>
            <span className={clsx("relative h-5 w-9 rounded-full transition-colors", report.isPublic ? "bg-brand" : "bg-border-strong")}>
              <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", report.isPublic ? "translate-x-4" : "translate-x-0.5")} />
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
        <p className="text-sm text-ink-2">{confirmDelete === "report" ? "All widgets in this report will be removed. Your dataset stays." : "This can't be undone."}</p>
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
