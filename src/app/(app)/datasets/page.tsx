"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Database, FilePlus2, MoreVertical, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DataUploader, type DataDraft } from "@/components/data/DataUploader";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { Badge, EmptyState, timeAgo } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { DatasetSummary } from "@/lib/charts/types";

export default function DatasetsPage() {
  const router = useRouter();
  const toast = useToast();
  const [datasets, setDatasets] = useState<DatasetSummary[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<DataDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<DatasetSummary | null>(null);

  const load = () =>
    api<{ datasets: DatasetSummary[] }>("/api/datasets")
      .then((d) => setDatasets(d.datasets))
      .catch((err) => toast.error(err.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await api("/api/datasets", { method: "POST", json: { name: draft.name.trim() || "Untitled data", source: draft.source, columns: draft.columns, rows: draft.rows } });
      toast.success("Dataset saved");
      setAddOpen(false);
      setDraft(null);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm) return;
    try {
      await api(`/api/datasets/${confirm._id}`, { method: "DELETE" });
      setDatasets((ds) => ds?.filter((d) => d._id !== confirm._id) ?? null);
      toast.success("Dataset deleted");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConfirm(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Datasets</h1>
            <p className="text-sm text-ink-2">Every dataset you&apos;ve added. One dataset can power many reports.</p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)} data-testid="add-dataset">
            <Upload className="h-4 w-4" /> Add data
          </Button>
        </div>

        {datasets === null ? (
          <div className="card divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="skeleton h-10 w-10" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : datasets.length === 0 ? (
          <EmptyState icon={<Database className="h-6 w-6" />} title="No data yet" description="Upload a CSV or Excel file, paste cells, or grab a sample dataset." action={<Button onClick={() => setAddOpen(true)}>Add data</Button>} />
        ) : (
          <div className="card divide-y stagger stagger-auto">
            {datasets.map((d) => (
              <div key={d._id} className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-2/60">
                <Link href={`/datasets/${d._id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="clay-tile h-11 w-11 shrink-0 bg-clay-sky text-clay-sky-ink">
                    <Database className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{d.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                      <span>{d.rowCount.toLocaleString()} rows</span>
                      <span>·</span>
                      <span>{d.columns.length} columns</span>
                      {d.columns.filter((c) => c.type === "number").length > 0 && <Badge tone="brand">{d.columns.filter((c) => c.type === "number").length} numeric</Badge>}
                      {d.columns.some((c) => c.type === "date") && <Badge tone="success">dates</Badge>}
                      <span>· updated {timeAgo(d.updatedAt)}</span>
                    </div>
                  </div>
                </Link>
                <Badge>{d.source}</Badge>
                <Menu
                  trigger={
                    <button className="rounded-full p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Dataset options">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  }
                  items={[
                    { label: "New report from this data", icon: <FilePlus2 className="h-4 w-4" />, onClick: () => router.push(`/reports/new?dataset=${d._id}`) },
                    { label: "Delete", icon: <Trash2 className="h-4 w-4" />, onClick: () => setConfirm(d), danger: true },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add data"
        description="Upload, paste, use a sample or type values in."
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft} loading={busy} data-testid="save-dataset">
              Save dataset
            </Button>
          </>
        }
      >
        <DataUploader draft={draft} onReady={setDraft} />
      </Modal>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Delete this dataset?"
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
        <p className="text-sm text-ink-2">“{confirm?.name}” will be removed. Reports that use it must be deleted first.</p>
      </Modal>
    </AppShell>
  );
}
