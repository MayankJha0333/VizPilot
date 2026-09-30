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
import { previewSource, ReportCard, type ReportListItem } from "@/components/reports/ReportCard";
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
  { id: "ecommerce-orders", title: "Sales overview", body: "Revenue trend, top categories, regions and channels.", tone: "bg-clay-lavender" },
  { id: "saas-metrics", title: "SaaS growth", body: "MRR, customers, churn and NPS over time.", tone: "bg-clay-mint" },
  { id: "support-tickets", title: "Support operations", body: "Ticket volume, priority mix, agents and CSAT.", tone: "bg-clay-peach" },
  { id: "marketing-campaigns", title: "Marketing performance", body: "Spend, conversions and ROAS by platform.", tone: "bg-clay-sky" },
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
          <p className="text-sm font-bold text-ink-3">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-0.5 text-[32px] font-extrabold tracking-tight">
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
        <div className="clay-tile relative block overflow-hidden rounded-[28px] bg-clay-lavender px-7 py-6 text-clay-lavender-ink animate-scale-in">
          <div className="orb -right-10 -top-16 h-56 w-56 bg-clay-sky" />
          <div className="orb -bottom-20 left-1/3 h-48 w-48 bg-clay-peach [animation-delay:-6s]" />
          <button onClick={() => setWelcome(false)} className="clay-sm clay-press absolute right-4 top-4 rounded-full p-1.5 text-ink-3 hover:text-ink" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
          <h2 className="relative text-2xl font-extrabold">Welcome to VizPilot 👋</h2>
          <p className="relative mt-1 max-w-lg text-sm font-semibold">Bring a CSV, paste a table, or pick a template below. Then ask AI questions about your data and it builds the widgets for you.</p>
        </div>
      )}

      {/* Start */}
      <section>
        <SectionTitle title="Start" />
        <div className="stagger stagger-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StartCard href="/reports/new?mode=upload" tone="lavender" icon={<Upload className="h-5 w-5" />} title="Upload a file" body="CSV, TSV or Excel — we detect the columns." />
          <StartCard href="/reports/new?mode=paste" tone="sky" icon={<ClipboardPaste className="h-5 w-5" />} title="Paste a table" body="Copy cells from Sheets or Excel." />
          <StartCard href="/reports/new?mode=sample" tone="peach" icon={<Sparkles className="h-5 w-5" />} title="Try a sample" body="Six realistic datasets to explore." />
          <StartCard href="/datasets" tone="mint" icon={<Database className="h-5 w-5" />} title="Reuse a dataset" body={datasets ? `${datasets.length} dataset${datasets.length === 1 ? "" : "s"} in your workspace` : "Your saved data"} />
        </div>
      </section>

      {/* Recent reports */}
      <section>
        <SectionTitle title="Recent reports" action={reports && reports.length > 0 ? { label: "View all", href: "/reports" } : undefined} />
        {recent === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton m-2 h-40 rounded-[20px]" />
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
              <ReportCard key={r._id} report={r} previewRows={previewData[previewSource(r)]?.rows} previewColumns={previewData[previewSource(r)]?.columns} onDuplicate={() => duplicate(r)} onDelete={() => setConfirm(r)} />
            ))}
          </div>
        )}
      </section>

      {/* Templates */}
      <section>
        <SectionTitle title="Templates" subtitle="A full report in one click, built from a sample dataset. Swap in your own data any time." />
        <div className="stagger stagger-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => {
            const sample = SAMPLE_DATASETS.find((s) => s.id === t.id);
            return (
              <Link key={t.id} href={`/reports/new?mode=sample&sample=${t.id}&title=${encodeURIComponent(t.title)}&auto=1`} className="card card-hover group overflow-hidden">
                <div className={clsx("relative m-2 mb-0 h-24 rounded-[20px] px-4 pb-3 pt-4 shadow-[var(--clay-inset)]", t.tone)}>
                  <div className="relative flex h-full items-end gap-1.5">
                    {[35, 60, 45, 80, 55, 90, 70].map((h, i) => (
                      <span key={i} className="w-3 rounded-full bg-surface shadow-[var(--shadow-sm)] transition-transform duration-300 group-hover:scale-y-110" style={{ height: `${h}%`, transformOrigin: "bottom", transitionDelay: `${i * 30}ms` }} />
                    ))}
                  </div>
                </div>
                <div className="p-4 pt-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-extrabold">{t.title}</h3>
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
          <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="clay-tile h-12 w-12 bg-clay-mint text-clay-mint-ink"><Database className="h-5 w-5" /></span>
            <p className="text-sm text-ink-2">No datasets yet. Creating a report adds one automatically.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-5 pb-2 pt-4 font-bold">Dataset</th>
                  <th className="hidden px-4 pb-2 pt-4 font-bold md:table-cell">Columns</th>
                  <th className="px-4 pb-2 pt-4 text-right font-bold">Rows</th>
                  <th className="hidden px-4 pb-2 pt-4 font-bold sm:table-cell">Used in</th>
                  <th className="hidden px-4 pb-2 pt-4 font-bold lg:table-cell">Updated</th>
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
                          <span className="clay-tile h-10 w-10 shrink-0 bg-clay-sky text-clay-sky-ink">
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
                        <Link href={`/reports/new?dataset=${d._id}`} className="clay-sm clay-press inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-brand-ink">
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
        <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="clay-sm clay-press rounded-full px-3.5 py-1.5 text-sm font-bold text-brand-ink">
          {action.label} →
        </Link>
      )}
    </div>
  );
}

const TONES = {
  lavender: "bg-clay-lavender text-clay-lavender-ink",
  sky: "bg-clay-sky text-clay-sky-ink",
  mint: "bg-clay-mint text-clay-mint-ink",
  peach: "bg-clay-peach text-clay-peach-ink",
} as const;

function StartCard({ href, icon, title, body, tone }: { href: string; icon: React.ReactNode; title: string; body: string; tone: keyof typeof TONES }) {
  return (
    <Link href={href} className="card card-hover group flex items-start gap-4 p-5">
      <span className={clsx("clay-tile h-12 w-12 shrink-0 rounded-[16px] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-0.5 group-hover:-rotate-6", TONES[tone])}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[15px] font-extrabold text-ink">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-ink-2">{body}</div>
      </div>
    </Link>
  );
}
