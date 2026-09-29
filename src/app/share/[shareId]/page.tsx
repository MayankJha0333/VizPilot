"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Widget } from "@/components/charts/Widget";
import { DashboardGrid } from "@/components/charts/DashboardGrid";
import { Logo } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { buildLayout } from "@/lib/layout/grid";
import type { ChartRecord, DatasetRecord, ReportRecord } from "@/lib/charts/types";

interface Payload {
  report: ReportRecord;
  charts: ChartRecord[];
  dataset: DatasetRecord | null;
  datasets?: DatasetRecord[];
  owner: { name: string } | null;
}

export default function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/share/${shareId}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Not found");
        setData(j);
      })
      .catch((err) => setError(err.message));
  }, [shareId]);

  const layout = useMemo(() => (data ? buildLayout(data.charts.map((c) => ({ i: c._id, box: c.layout, type: c.config.type, size: c.size }))) : []), [data]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Logo />
        <h1 className="text-xl font-semibold">This report isn&apos;t available</h1>
        <p className="max-w-sm text-sm text-ink-2">{error}. The owner may have unpublished it.</p>
        <Link href="/">
          <Button variant="outline">Go to VizPilot</Button>
        </Link>
      </div>
    );
  }
  if (!data) return <div className="p-10 text-center text-sm text-ink-3">Loading report…</div>;

  const { report, charts, dataset, owner } = data;
  const dark = report.theme === "dark";
  const byId = new Map((data.datasets ?? (dataset ? [dataset] : [])).map((d) => [d._id, d]));
  const multi = new Set(charts.map((c) => c.datasetId)).size > 1;
  const totalRows = [...byId.values()].reduce((n, d) => n + d.rowCount, 0);

  return (
    <div className={clsx("min-h-screen", dark ? "bg-[#0b0d1a] text-white" : "bg-bg")}>
      <header className={clsx("sticky top-0 z-40", dark ? "border-b border-white/10 bg-[#0b0d1a]/80 backdrop-blur" : "glass")}>
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <Logo dark={dark} />
          <Link href="/signup">
            <Button size="sm" variant={dark ? "outline" : "primary"}>
              Make your own
            </Button>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{report.title}</h1>
        {report.description && <p className={clsx("mt-2 max-w-2xl", dark ? "text-white/60" : "text-ink-2")}>{report.description}</p>}
        <p className={clsx("mt-1 text-xs", dark ? "text-white/40" : "text-ink-3")}>
          {owner ? `By ${owner.name} · ` : ""}
          {totalRows ? `${totalRows.toLocaleString()} rows${multi ? ` from ${byId.size} sources` : ""} · ` : ""}Updated {report.updatedAt ? new Date(report.updatedAt).toLocaleDateString() : ""}
        </p>
        <div className="mt-8">
          {charts.length === 0 ? (
            <p className="text-sm text-ink-3">This report has no widgets yet.</p>
          ) : (
            <DashboardGrid
              layout={layout}
              dark={dark}
              items={charts.map((c, i) => {
                const ds = byId.get(c.datasetId) ?? dataset;
                return { id: c._id, node: <Widget chart={c} rows={ds?.rows ?? []} columns={ds?.columns ?? []} theme={report.theme} readOnly fill index={i} sourceName={multi ? ds?.name : undefined} /> };
              })}
            />
          )}
        </div>
      </main>
      <footer className={clsx("py-8 text-center text-xs", dark ? "text-white/40" : "text-ink-3")}>Made with VizPilot</footer>
    </div>
  );
}
