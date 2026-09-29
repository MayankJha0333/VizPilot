"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ArrowUpRight, Copy, ExternalLink, Globe, LayoutGrid, MoreVertical, Trash2 } from "lucide-react";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { Menu } from "@/components/ui/Menu";
import { timeAgo } from "@/components/ui/misc";
import type { ChartRecord, ReportRecord, Row, Column } from "@/lib/charts/types";
import { getPalette } from "@/lib/charts/types";

export interface ReportListItem extends ReportRecord {
  dataset: { _id: string; name: string; rowCount: number } | null;
  preview: ChartRecord | null;
}

/** The dataset a card's preview chart reads from (widgets can use a different source than the report default). */
export function previewSource(r: ReportListItem): string {
  return r.preview?.datasetId || r.datasetId || "";
}

interface Props {
  report: ReportListItem;
  previewRows?: Row[];
  previewColumns?: Column[];
  onDuplicate: () => void;
  onDelete: () => void;
  compact?: boolean;
}

export function ReportCard({ report, previewRows, previewColumns, onDuplicate, onDelete, compact }: Props) {
  const router = useRouter();
  const colors = getPalette(report.palette);
  const dark = report.theme === "dark";
  const previewCfg = report.preview ? { ...report.preview.config, showLabels: false, showLegend: false } : null;
  return (
    <Link href={`/reports/${report._id}`} className="card card-hover group flex flex-col overflow-hidden" data-testid="report-card">
      <div data-theme={report.theme} className={clsx("relative overflow-hidden border-b p-3", compact ? "h-32" : "h-44")} style={{ background: dark ? `linear-gradient(135deg, #1b2140, #0d1017 65%)` : `linear-gradient(135deg, ${colors[0]}22, ${colors[1]}1a 60%, ${colors[2]}12)` }}>
        {previewCfg && previewRows && previewColumns ? (
          <div className="h-full rounded-xl border border-border bg-surface/95 p-2.5 shadow-[var(--card-shadow)] transition-transform duration-300 group-hover:scale-[1.02]">
            <div className="mb-1 truncate text-[10px] font-semibold text-ink">{report.preview!.title}</div>
            <div className="pointer-events-none">
              <ChartRenderer config={previewCfg} rows={previewRows} columns={previewColumns} theme={report.theme} height={compact ? 80 : 118} compact animate={false} text={report.preview!.note} />
            </div>
          </div>
        ) : previewCfg ? (
          <div className="h-full rounded-xl border border-border bg-surface/95 p-2.5 shadow-[var(--card-shadow)]" aria-hidden>
            <div className="skeleton mb-2 h-2.5 w-1/2" />
            <div className="flex h-[calc(100%-1.25rem)] items-end gap-1.5">
              {[35, 60, 45, 80, 55, 70, 40].map((h, i) => (
                <div key={i} className="skeleton flex-1 rounded-t-md" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-3">
            <div className="flex items-end gap-1">
              {[40, 65, 50, 80, 60].map((h, i) => (
                <span key={i} className="w-3 rounded-t-sm" style={{ height: h * 0.6, background: colors[i % colors.length], opacity: 0.6 }} />
              ))}
            </div>
            <span className="text-[11px]">{report.chartCount ? `${report.chartCount} widgets` : "No widgets yet"}</span>
          </div>
        )}
        {report.isPublic && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success-ink shadow-[var(--shadow-sm)]">
            <Globe className="h-3 w-3" /> Public
          </span>
        )}
        <span className="absolute bottom-2 right-2 flex h-8 w-8 translate-y-2 items-center justify-center rounded-full bg-inverse text-inverse-fg opacity-0 shadow-[var(--shadow-md)] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{report.title}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-3">
            <LayoutGrid className="h-3 w-3" /> {report.chartCount ?? 0} · {timeAgo(report.updatedAt)}
            {report.dataset ? ` · ${report.dataset.name}` : ""}
          </p>
        </div>
        <Menu
          trigger={
            <button className="rounded-lg p-1 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Report options">
              <MoreVertical className="h-4 w-4" />
            </button>
          }
          items={[
            { label: "Open", icon: <ExternalLink className="h-4 w-4" />, onClick: () => router.push(`/reports/${report._id}`) },
            { label: "Duplicate", icon: <Copy className="h-4 w-4" />, onClick: onDuplicate },
            { label: "Delete", icon: <Trash2 className="h-4 w-4" />, onClick: onDelete, danger: true },
          ]}
        />
      </div>
    </Link>
  );
}
