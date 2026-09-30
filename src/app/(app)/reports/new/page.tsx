"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { ArrowLeft, ArrowRight, Check, Database, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DataUploader, type DataDraft } from "@/components/data/DataUploader";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { Button } from "@/components/ui/Button";
import { Field, PageLoader, timeAgo } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { suggestCharts } from "@/lib/charts/suggest";
import { PALETTES, type DatasetRecord, type DatasetSummary } from "@/lib/charts/types";
import { SAMPLE_DATASETS } from "@/lib/data/samples";

export default function NewReportPage() {
  return (
    <AppShell>
      <Suspense>
        <NewReportWizard />
      </Suspense>
    </AppShell>
  );
}

type Step = 1 | 2;

function NewReportWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<DataDraft | null>(null);
  const [existing, setExisting] = useState<DatasetSummary[]>([]);
  const [existingFull, setExistingFull] = useState<DatasetRecord | null>(null);
  const [tab, setTab] = useState<"new" | "existing">(params.get("dataset") ? "existing" : "new");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [palette, setPalette] = useState("aurora");
  const [autoCharts, setAutoCharts] = useState(true);
  const [busy, setBusy] = useState(false);

  const autoRan = useRef(false);
  useEffect(() => {
    const sampleId = params.get("sample");
    const sample = sampleId ? SAMPLE_DATASETS.find((s) => s.id === sampleId) : null;
    if (sample && !autoRan.current) {
      autoRan.current = true;
      const t = params.get("title");
      queueMicrotask(() => {
        setDraft({ name: sample.name, source: "sample", columns: sample.columns, rows: sample.rows });
        if (t) setTitle(t);
        if (params.get("auto") !== "1") setStep(2);
        else setBusy(true);
      });
      if (params.get("auto") === "1") {
        // Template: create the report straight away with suggested widgets.
        (async () => {
          try {
            const d = await api<{ dataset: { _id: string } }>("/api/datasets", { method: "POST", json: { name: sample.name, source: "sample", columns: sample.columns, rows: sample.rows } });
            const r = await api<{ report: { _id: string } }>("/api/reports", { method: "POST", json: { title: t || `${sample.name} report`, description: "", datasetId: d.dataset._id, autoCharts: true, palette: "aurora" } });
            toast.success("Report created from template");
            router.replace(`/reports/${r.report._id}`);
          } catch (err) {
            toast.error((err as Error).message);
            setBusy(false);
          }
        })();
      }
    }
    api<{ datasets: DatasetSummary[] }>("/api/datasets")
      .then((d) => setExisting(d.datasets))
      .catch(() => {});
    const pre = params.get("dataset");
    if (pre) {
      api<{ dataset: DatasetRecord }>(`/api/datasets/${pre}`)
        .then((d) => setExistingFull(d.dataset))
        .catch(() => {});
    }
  }, [params, router, toast]);

  const active = useMemo(() => {
    if (tab === "existing" && existingFull) return { name: existingFull.name, columns: existingFull.columns, rows: existingFull.rows };
    if (tab === "new" && draft) return { name: draft.name, columns: draft.columns, rows: draft.rows };
    return null;
  }, [tab, draft, existingFull]);

  const suggestions = useMemo(() => (active ? suggestCharts(active.columns, active.rows, palette) : []), [active, palette]);

  const goStep2 = () => {
    if (!active) return toast.error("Add some data first.");
    if (!title) setTitle(`${active.name} report`);
    setStep(2);
  };

  const create = async () => {
    if (!active) return;
    setBusy(true);
    try {
      let datasetId = tab === "existing" ? existingFull?._id : undefined;
      if (!datasetId && draft) {
        const d = await api<{ dataset: { _id: string } }>("/api/datasets", {
          method: "POST",
          json: { name: draft.name.trim() || "Untitled data", source: draft.source, columns: draft.columns, rows: draft.rows },
        });
        datasetId = d.dataset._id;
      }
      const r = await api<{ report: { _id: string }; chartsCreated: number }>("/api/reports", {
        method: "POST",
        json: { title: title.trim() || `${active.name} report`, description, datasetId, autoCharts, palette },
      });
      toast.success(autoCharts && r.chartsCreated ? `Report created with ${r.chartsCreated} charts` : "Report created");
      router.push(`/reports/${r.report._id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  if (busy && params.get("auto") === "1") return <PageLoader label="Building your report from the template…" />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => (step === 2 ? setStep(1) : router.push("/dashboard"))} className="clay-sm clay-press rounded-[14px] p-2 text-ink-3 hover:text-ink" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create a report</h1>
          <p className="text-sm text-ink-2">{step === 1 ? "Step 1 of 2 · Add your data" : "Step 2 of 2 · Set up the report"}</p>
        </div>
        <ol className="ml-auto hidden items-center gap-2 text-xs sm:flex">
          {[1, 2].map((s) => (
            <li key={s} className={clsx("flex items-center gap-2", s <= step ? "text-brand" : "text-ink-3")}>
              <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold", s < step ? "clay-brand border-transparent" : s === step ? "border-brand text-brand-ink" : "")}>
                {s < step ? <Check className="h-3 w-3" /> : s}
              </span>
              {s === 1 ? "Data" : "Report"}
              {s === 1 && <span className="mx-1 h-px w-8 bg-border" />}
            </li>
          ))}
        </ol>
      </div>

      {step === 1 && (
        <div key="step1" className="space-y-5 animate-fade-up">
          {existing.length > 0 && (
            <div className="clay-inset inline-flex rounded-full p-1">
              {(["new", "existing"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={clsx("rounded-full px-3.5 py-1.5 text-[13px] font-bold", tab === t ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-2")}>
                  {t === "new" ? "Add new data" : `Use existing (${existing.length})`}
                </button>
              ))}
            </div>
          )}

          {tab === "new" ? (
            <DataUploader draft={draft} onReady={setDraft} initialMode={(["sample", "upload", "paste", "manual"].includes(params.get("mode") ?? "") ? (params.get("mode") as "sample" | "upload" | "paste" | "manual") : undefined)} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {existing.map((d) => (
                <button
                  key={d._id}
                  onClick={async () => {
                    try {
                      const full = await api<{ dataset: DatasetRecord }>(`/api/datasets/${d._id}`);
                      setExistingFull(full.dataset);
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                  className={clsx("flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors hover:bg-surface-2", existingFull?._id === d._id ? "border-transparent clay-inset" : "bg-surface")}
                >
                  <Database className="mt-0.5 h-5 w-5 text-brand" />
                  <div>
                    <div className="text-sm font-semibold">{d.name}</div>
                    <div className="text-xs text-ink-3">
                      {d.rowCount} rows · {d.columns.length} columns · {timeAgo(d.updatedAt)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={goStep2} disabled={!active} data-testid="next-step">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && active && (
        <div key="step2" className="grid gap-6 animate-fade-up lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <div className="card space-y-4 p-5">
              <Field label="Report title">
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q3 growth review" data-testid="report-title" />
              </Field>
              <Field label="Description (optional)">
                <textarea className="input min-h-[72px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this report for, and who is it for?" />
              </Field>
              <div>
                <div className="label">Colour palette</div>
                <div className="flex flex-wrap gap-2">
                  {PALETTES.map((p) => (
                    <button key={p.id} onClick={() => setPalette(p.id)} className={clsx("flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold", palette === p.id ? "border-transparent clay-inset text-brand-ink" : "text-ink-2 hover:bg-surface-2")}>
                      <span className="flex gap-0.5">
                        {p.colors.slice(0, 4).map((c) => (
                          <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
                        ))}
                      </span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="card p-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--brand)]" checked={autoCharts} onChange={(e) => setAutoCharts(e.target.checked)} />
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-brand" /> Auto-build {suggestions.length} suggested charts
                  </div>
                  <p className="text-xs text-ink-2">Based on your columns. You can edit or delete any of them afterwards.</p>
                </div>
              </label>
              {autoCharts && (
                <div className="mt-4 grid gap-3 stagger stagger-auto sm:grid-cols-2">
                  {suggestions.map((s, i) => (
                    <div key={i} className="card-hover rounded-[20px] bg-surface p-3 shadow-[var(--shadow-sm)]">
                      <div className="truncate text-xs font-semibold">{s.title}</div>
                      <div className="mb-2 truncate text-[11px] text-ink-3">{s.reason}</div>
                      <div className="pointer-events-none">
                        <ChartRenderer config={s.config} rows={active.rows} columns={active.columns} height={120} compact animate={false} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Data</div>
              <div className="mt-1 text-sm font-semibold">{active.name}</div>
              <div className="text-xs text-ink-2">
                {active.rows.length.toLocaleString()} rows · {active.columns.length} columns
              </div>
              <ul className="mt-3 space-y-1 text-xs">
                {active.columns.slice(0, 8).map((c) => (
                  <li key={c.name} className="flex justify-between gap-2">
                    <span className="truncate text-ink">{c.name}</span>
                    <span className="text-ink-3">{c.type}</span>
                  </li>
                ))}
                {active.columns.length > 8 && <li className="text-ink-3">+{active.columns.length - 8} more</li>}
              </ul>
            </div>
            <Button className="w-full" size="lg" onClick={create} loading={busy} data-testid="create-report">
              Create report <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep(1)}>
              Back to data
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
