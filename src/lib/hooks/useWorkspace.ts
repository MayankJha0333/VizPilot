"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReportListItem } from "@/components/reports/ReportCard";
import type { DatasetRecord, DatasetSummary } from "@/lib/charts/types";

/** Loads reports + datasets (and the datasets needed for report previews). */
export function useWorkspace(sort: "recent" | "title" = "recent") {
  const [reports, setReports] = useState<ReportListItem[] | null>(null);
  const [datasets, setDatasets] = useState<DatasetSummary[] | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, DatasetRecord>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, d] = await Promise.all([api<{ reports: ReportListItem[] }>(`/api/reports?sort=${sort}`), api<{ datasets: DatasetSummary[] }>("/api/datasets")]);
    await Promise.resolve();
    setReports(r.reports);
    setDatasets(d.datasets);
    const ids = [...new Set(r.reports.filter((x) => x.preview && x.datasetId).map((x) => x.datasetId as string))].slice(0, 12);
    const entries = await Promise.all(
      ids.map(async (id) => {
        try {
          const full = await api<{ dataset: DatasetRecord }>(`/api/datasets/${id}`);
          return [id, full.dataset] as const;
        } catch {
          return null;
        }
      })
    );
    const map: Record<string, DatasetRecord> = {};
    entries.forEach((e) => e && (map[e[0]] = e[1]));
    setPreviewData(map);
  }, [sort]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { reports, datasets, previewData, error, reload: load, setReports, setDatasets };
}
