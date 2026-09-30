"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { FilePlus2, LayoutGrid, List, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, Segmented, timeAgo } from "@/components/ui/misc";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { previewSource, ReportCard, type ReportListItem } from "@/components/reports/ReportCard";
import { useWorkspace } from "@/lib/hooks/useWorkspace";

export default function ReportsPage() {
  const router = useRouter();
  const toast = useToast();
  const [sort, setSort] = useState<"recent" | "title">("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<ReportListItem | null>(null);
  const { reports, previewData, setReports } = useWorkspace(sort);

  const filtered = useMemo(() => {
    if (!reports) return null;
    const s = q.trim().toLowerCase();
    return s ? reports.filter((r) => r.title.toLowerCase().includes(s) || r.description.toLowerCase().includes(s) || r.dataset?.name.toLowerCase().includes(s)) : reports;
  }, [reports, q]);

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
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
            <p className="text-sm text-ink-2">{reports ? `${reports.length} report${reports.length === 1 ? "" : "s"}` : "Loading…"}</p>
          </div>
          <Link href="/reports/new">
            <Button>
              <FilePlus2 className="h-4 w-4" /> New report
            </Button>
          </Link>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input className="input h-10 pl-9" placeholder="Search reports…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="search-reports" />
          </div>
          <select className="input h-10 w-auto" value={sort} onChange={(e) => setSort(e.target.value as "recent" | "title")} aria-label="Sort">
            <option value="recent">Recently edited</option>
            <option value="title">Title A → Z</option>
          </select>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: <LayoutGrid className="h-4 w-4" /> },
              { value: "list", label: <List className="h-4 w-4" /> },
            ]}
          />
        </div>

        {filtered === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton m-2 h-40 rounded-[20px]" />
                <div className="space-y-2 p-4">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search className="h-6 w-6" />} title={reports?.length ? "No reports match" : "No reports yet"} description={reports?.length ? `Nothing found for “${q}”.` : "Create your first report from a file, pasted table or sample."} action={!reports?.length ? <Link href="/reports/new"><Button>Create a report</Button></Link> : undefined} />
        ) : view === "grid" ? (
          <div className="stagger stagger-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <ReportCard key={r._id} report={r} previewRows={previewData[previewSource(r)]?.rows} previewColumns={previewData[previewSource(r)]?.columns} onDuplicate={() => duplicate(r)} onDelete={() => setConfirm(r)} />
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden animate-fade-up">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Report</th>
                  <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Dataset</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Widgets</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r._id} className="cursor-pointer border-t transition-colors hover:bg-surface-2/70" onClick={() => router.push(`/reports/${r._id}`)}>
                    <td className="px-4 py-3 font-semibold text-ink">{r.title}</td>
                    <td className="hidden px-4 py-3 text-ink-2 md:table-cell">{r.dataset?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.chartCount ?? 0}</td>
                    <td className={clsx("hidden px-4 py-3 sm:table-cell")}>{r.isPublic ? <Badge tone="success">Public</Badge> : <Badge>Private</Badge>}</td>
                    <td className="px-4 py-3 text-ink-3">{timeAgo(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
    </AppShell>
  );
}
