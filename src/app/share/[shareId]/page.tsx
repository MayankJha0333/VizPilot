"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { SIZE_CLASS, Widget } from "@/components/charts/Widget";
import { Logo } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import type { ChartRecord, DatasetRecord, ReportRecord } from "@/lib/charts/types";

interface Payload {
  report: ReportRecord;
  charts: ChartRecord[];
  dataset: DatasetRecord | null;
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

  return (
    <div className={clsx("min-h-screen", dark ? "bg-[#0b0d1a] text-white" : "bg-bg")}>
      <header className={clsx("sticky top-0 z-20", dark ? "border-b border-white/10 bg-[#0b0d1a]/80 backdrop-blur" : "glass")}>
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
          {dataset ? `${dataset.rowCount.toLocaleString()} rows` : ""} · Updated {report.updatedAt ? new Date(report.updatedAt).toLocaleDateString() : ""}
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-12">
          {charts.map((c, i) => (
            <div key={c._id} className={clsx("min-w-0", SIZE_CLASS[c.size] ?? SIZE_CLASS.half)}>
              <Widget chart={c} rows={dataset?.rows ?? []} columns={dataset?.columns ?? []} theme={report.theme} readOnly index={i} />
            </div>
          ))}
          {charts.length === 0 && <p className="text-sm text-ink-3">This report has no widgets yet.</p>}
        </div>
      </main>
      <footer className={clsx("py-8 text-center text-xs", dark ? "text-white/40" : "text-ink-3")}>Made with VizPilot</footer>
    </div>
  );
}
