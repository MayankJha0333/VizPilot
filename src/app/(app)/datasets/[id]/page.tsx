"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/data/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, PageLoader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { Column, DatasetRecord, Row } from "@/lib/charts/types";

export default function DatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell>
      <DatasetView id={id} />
    </AppShell>
  );
}

function DatasetView({ id }: { id: string }) {
  const toast = useToast();
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [usedBy, setUsedBy] = useState<{ _id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ dataset: DatasetRecord; usedBy: { _id: string; title: string }[] }>(`/api/datasets/${id}`)
      .then((d) => {
        setDataset(d.dataset);
        setUsedBy(d.usedBy);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  const save = async (next: { columns: Column[]; rows: Row[] }) => {
    if (!dataset) return;
    setDataset({ ...dataset, ...next, rowCount: next.rows.length });
    setSaving(true);
    try {
      await api(`/api/datasets/${id}`, { method: "PATCH", json: next });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const rename = async (name: string) => {
    if (!dataset || !name.trim() || name === dataset.name) return;
    setDataset({ ...dataset, name });
    try {
      await api(`/api/datasets/${id}`, { method: "PATCH", json: { name } });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (error) return <EmptyState title="Couldn't open this dataset" description={error} action={<Link href="/datasets"><Button>Back to data</Button></Link>} />;
  if (!dataset) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/datasets" className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <input
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-xl font-semibold outline-none hover:bg-surface-2 focus:bg-surface-2 focus:ring-2 focus:ring-brand/30"
          defaultValue={dataset.name}
          onBlur={(e) => rename(e.target.value.trim())}
          aria-label="Dataset name"
        />
        <Badge>{dataset.source}</Badge>
        <span className="text-xs text-ink-3">{saving ? "Saving…" : ""}</span>
        <Link href={`/reports/new?dataset=${id}`}>
          <Button size="sm">
            <FilePlus2 className="h-4 w-4" /> New report
          </Button>
        </Link>
      </div>
      <p className="text-sm text-ink-2">
        {dataset.rowCount.toLocaleString()} rows · {dataset.columns.length} columns
        {usedBy.length > 0 && (
          <>
            {" "}
            · used in{" "}
            {usedBy.map((r, i) => (
              <span key={r._id}>
                <Link href={`/reports/${r._id}`} className="text-brand hover:underline">
                  {r.title}
                </Link>
                {i < usedBy.length - 1 ? ", " : ""}
              </span>
            ))}
          </>
        )}
      </p>
      <DataTable columns={dataset.columns} rows={dataset.rows} editable onChange={save} maxHeight={560} />
    </div>
  );
}
