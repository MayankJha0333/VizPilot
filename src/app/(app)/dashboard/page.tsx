"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { ArrowRight, BarChart3, ClipboardPaste, Database, FilePlus2, LayoutGrid, Sparkles, Upload, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, greeting, timeAgo } from "@/components/ui/misc";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ReportCard, type ReportListItem } from "@/components/reports/ReportCard";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { SAMPLE_DATASETS } from "@/lib/data/samples";

export default function DashboardPage() {
  return (
    <AppShell>
      <Suspense>
        <Home />
      </Suspense>
    </AppShell>
  );
}

const TEMPLATES = [
  { id: "ecommerce-orders", title: "Sales overview", body: "Revenue trend, top categories, regions and channels.", tone: "from-[#6d5cff] to-[#b56bff]" },
  { id: "saas-metrics", title: "SaaS growth", body: "MRR, customers, churn and NPS over time.", tone: "from-[#14b8a6] to-[#38bdf8]" },
  { id: "support-tickets", title: "Support operations", body: "Ticket volume, priority mix, agents and CSAT.", tone: "from-[#ff6b8a] to-[#f5a524]" },
  { id: "marketing-campaigns", title: "Marketing performance", body: "Spend, conversions and ROAS by platform.", tone: "from-[#f97316] to-[#facc15]" },
];

function Home() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { reports, datasets, previewData, setReports } = useWorkspace("recent");
  const [confirm, setConfirm] = useState<ReportListItem | null>(null);
  const [welcome, setWelcome] = useState(params.get("welcome") === "1");

  const firstName = (profile?.name || user?.displayName || "there").split(" ")[0];
  const recent = reports?.slice(0, 6) ?? null;
  const usedBy = (dsId: string) => reports?.filter((r) => r.datasetId === dsId).length ?? 0;

  const duplicate = async (r: ReportListItem) => {
    try {
      const data = await api<{ report: { _id: string } }>(`/api/reports/${r._id}/duplicate`, { method: "POST" });
      router.push(`/reports/${data.report._id}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  const remove = async () => {
    if (!confirm) return;
    try {
      await api(`/api/reports/${confirm._id}`, { method: "DELETE" });
      setReports((rs) => rs?.filter((r) => r._id !== confirm._id) ?? null);
      toast.success("Report deleted");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConfirm(null);
    }
  };

  return (
    <div className="space-y-9">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
        <div>
          <p className="text-sm text-ink-3">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">
            {greeting()}, {firstName}
          </h1>
        </div>
        <Link href="/reports/new">
          <Button>
            <FilePlus2 className="h-4 w-4" /> New report
          </Button>
        </Link>
      </div>

      {welcome && (
        <div className="noise relative overflow-hidden rounded-3xl bg-nav px-6 py-6 text-white animate-scale-in">
          <div className="orb -right-10 -top-16 h-56 w-56 bg-brand" />
          <div className="orb -bottom-20 left-1/3 h-48 w-48 bg-brand-3 [animation-delay:-6s]" />
          <button onClick={() => setWelcome(false)} className="absolute right-3 top-3 rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
          <h2 className="relative text-xl font-semibold">Welcome to VizPilot 👋</h2>
          <p className="relative mt-1 max-w-lg text-sm text-white/70">Bring a CSV, paste a table, or pick a template below. Then ask AI questions about your data and it builds the widgets for you.</p>
        </div>
      )}

      {/* Start */}
      <section>
        <SectionTitle title="Start" />
        <div className="stagger stagger-auto grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StartCard href="/reports/new?mode=upload" icon={<Upload className="h-5 w-5" />} title="Upload a file" body="CSV, TSV or Excel — we detect the columns." />
          <StartCard href="/reports/new?mode=paste" icon={<ClipboardPaste className="h-5 w-5" />} title="Paste a table" body="Copy cells from Sheets or Excel." />
          <StartCard href="/reports/new?mode=sample" icon={<Sparkles className="h-5 w-5" />} title="Try a sample" body="Six realistic datasets to explore." />
          <StartCard href="/datasets" icon={<Database className="h-5 w-5" />} title="Reuse a dataset" body={datasets ? `${datasets.length} dataset${datasets.length === 1 ? "" : "s"} in your workspace` : "Your saved data"} />
        </div>
      </section>

      {/* Recent reports */}
      <section>
        <SectionTitle title="Recent reports" action={reports && reports.length > 0 ? { label: "View all", href: "/reports" } : undefined} />
        {recent === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton h-44 rounded-none" />
                <div className="space-y-2 p-4">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid className="h-6 w-6" />}
            title="No reports yet"
            description="A report is a page of widgets built from one dataset. Pick a template below or start from your own data — it takes about a minute."
            action={
              <Link href="/reports/new">
                <Button size="lg">
                  <FilePlus2 className="h-4 w-4" /> Create your first report
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="stagger stagger-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((r) => (
              <ReportCard key={r._id} report={r} previewRows={r.datasetId ? previewData[r.datasetId]?.rows : undefined} previewColumns={r.datasetId ? previewData[r.datasetId]?.columns : undefined} onDuplicate={() => duplicate(r)} onDelete={() => setConfirm(r)} />
            ))}
          </div>
        )}
      </section>

      {/* Templates */}
      <section>
        <SectionTitle title="Templates" subtitle="A full report in one click, built from a sample dataset. Swap in your own data any time." />
        <div className="stagger stagger-auto grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => {
            const sample = SAMPLE_DATASETS.find((s) => s.id === t.id);
            return (
              <Link key={t.id} href={`/reports/new?mode=sample&sample=${t.id}&title=${encodeURIComponent(t.title)}&auto=1`} className="card card-hover group overflow-hidden">
                <div className={clsx("relative h-24 bg-gradient-to-br p-3", t.tone)}>
                  <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:14px_14px]" />
                  <div className="relative flex h-full items-end gap-1">
                    {[35, 60, 45, 80, 55, 90, 70].map((h, i) => (
                      <span key={i} className="w-2.5 rounded-t-sm bg-white/80 transition-transform duration-300 group-hover:scale-y-110" style={{ height: `${h}%`, transformOrigin: "bottom" }} />
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{t.title}</h3>
                    <ArrowRight className="h-4 w-4 text-ink-3 transition-transform group-hover:translate-x-1 group-hover:text-brand" />
                  </div>
                  <p className="mt-1 text-xs text-ink-2">{t.body}</p>
                  {sample && <p className="mt-2 text-[11px] text-ink-3">{sample.rows.length} rows · {sample.columns.length} columns</p>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Datasets */}
      <section>
        <SectionTitle title="Your datasets" action={datasets && datasets.length > 0 ? { label: "Manage", href: "/datasets" } : undefined} />
        {datasets === null ? (
          <div className="card divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="skeleton h-9 w-9" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : datasets.length === 0 ? (
          <div className="card bg-dots flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Database className="h-6 w-6 text-brand" />
            <p className="text-sm text-ink-2">No datasets yet. Creating a report adds one automatically.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Dataset</th>
                  <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Columns</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Rows</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Used in</th>
                  <th className="hidden px-4 py-2.5 font-semibold lg:table-cell">Updated</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {datasets.slice(0, 6).map((d) => {
                  const nums = d.columns.filter((c) => c.type === "number").length;
                  const dates = d.columns.filter((c) => c.type === "date").length;
                  return (
                    <tr key={d._id} className="border-t transition-colors hover:bg-surface-2/70">
                      <td className="px-4 py-3">
                        <Link href={`/datasets/${d._id}`} className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                            <Database className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink">{d.name}</div>
                            <div className="text-[11px] text-ink-3">{d.source}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          <Badge>{d.columns.length} cols</Badge>
                          {nums > 0 && <Badge tone="brand">{nums} numeric</Badge>}
                          {dates > 0 && <Badge tone="success">{dates} date</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{d.rowCount.toLocaleString()}</td>
                      <td className="hidden px-4 py-3 text-ink-2 sm:table-cell">{usedBy(d._id)} report{usedBy(d._id) === 1 ? "" : "s"}</td>
                      <td className="hidden px-4 py-3 text-ink-3 lg:table-cell">{timeAgo(d.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/reports/new?dataset=${d._id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft">
                          <BarChart3 className="h-3.5 w-3.5" /> New report
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Delete this report?"
        description={`“${confirm?.title}” and its widgets will be removed. The dataset stays.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} data-testid="confirm-delete">
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">This can&apos;t be undone.</p>
      </Modal>
    </div>
  );
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: { label: string; href: string } }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="text-sm font-medium text-brand hover:underline">
          {action.label} →
        </Link>
      )}
    </div>
  );
}

function StartCard({ href, icon, title, body }: { href: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link href={href} className="card card-hover group flex items-start gap-3.5 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-ink-2">{body}</div>
      </div>
    </Link>
  );
}
