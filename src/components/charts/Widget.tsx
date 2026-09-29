"use client";

import { useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Copy, Download, FileDown, GripVertical, Maximize2, MoreHorizontal, Pencil, Trash2, Filter as FilterIcon } from "lucide-react";
import { ChartRenderer, LegendChips } from "@/components/charts/ChartRenderer";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import type { ChartRecord, Column, Row, WidgetSize } from "@/lib/charts/types";
import { buildSeries, effectiveKeys, formatNumber, seriesLabel } from "@/lib/data/transform";
import { entityWord } from "@/lib/charts/suggest";

interface Props {
  chart: ChartRecord;
  rows: Row[];
  columns: Column[];
  theme: "light" | "dark";
  selected?: boolean;
  readOnly?: boolean;
  index?: number;
  draggable?: boolean;
  onSelect?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onResize?: (size: WidgetSize) => void;
}

export const SIZE_LABEL: Record<WidgetSize, string> = { sm: "Small", half: "Half", wide: "Wide", full: "Full" };
export const SIZE_CLASS: Record<WidgetSize, string> = {
  sm: "md:col-span-6 xl:col-span-4",
  half: "md:col-span-6",
  wide: "md:col-span-12 xl:col-span-8",
  full: "md:col-span-12",
};

export function widgetHeight(chart: ChartRecord): number {
  const t = chart.config.type;
  if (t === "kpi") return 150;
  if (t === "text") return 0;
  if (chart.size === "full") return 360;
  if (chart.size === "wide") return 320;
  if (chart.size === "sm") return 220;
  return 270;
}

export function Widget({ chart, rows, columns, theme, selected, readOnly, index = 0, draggable, onSelect, onDuplicate, onDelete, onResize }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const dark = theme === "dark";
  const isKpi = chart.config.type === "kpi";
  const isText = chart.config.type === "text";
  const filtered = useMemo(() => (chart.config.filters?.length ? chart.config.filters : []), [chart.config.filters]);
  const countLabel = useCountLabel(columns, rows);

  const toggle = (k: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const downloadPng = async () => {
    if (!ref.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, backgroundColor: dark ? "#13162a" : "#ffffff", filter: (n) => !(n instanceof HTMLElement && n.dataset.exportIgnore === "1") });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${chart.title || "chart"}.png`.replace(/[^\w.-]+/g, "_");
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  const downloadCsv = () => {
    const keys = effectiveKeys(chart.config);
    const pts = buildSeries(rows, chart.config, columns);
    const header = [chart.config.xKey || "label", ...keys.map((k) => seriesLabel(k, countLabel))];
    const lines = [header.join(","), ...pts.map((p) => [p.label, ...keys.map((k) => p[k])].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${chart.title || "chart"}.csv`.replace(/[^\w.-]+/g, "_");
    a.click();
  };

  const iconBtn = clsx("flex h-7 w-7 items-center justify-center rounded-md transition-colors", dark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-ink-2 hover:bg-surface-3 hover:text-ink");

  return (
    <>
      <div
        className={clsx(
          "group relative flex h-full flex-col rounded-[18px] border transition-[box-shadow,transform,border-color] duration-300 animate-fade-up",
          dark ? "chart-dark border-[#272b47] bg-[#13162a] text-white" : "border-border bg-surface",
          selected ? "border-brand shadow-[0_0_0_3px_var(--ring),var(--shadow-md)]" : "shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
          !readOnly && "cursor-pointer"
        )}
        style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
        onClick={onSelect}
        data-chart-card
      >
        <div ref={ref} className={clsx("flex flex-1 flex-col p-4 sm:p-5", dark ? "bg-[#13162a]" : "bg-surface")}>
          <div className={clsx("flex items-start justify-between gap-3", !isText && "mb-3")}>
            <div className="flex min-w-0 items-start gap-2">
              {draggable && !readOnly && (
                <span data-export-ignore="1" className={clsx("mt-0.5 hidden cursor-grab opacity-0 transition-opacity group-hover:opacity-100 sm:block", dark ? "text-white/40" : "text-ink-3")} title="Drag to reorder">
                  <GripVertical className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0">
                <h3 className={clsx("line-clamp-2 font-semibold leading-snug", isText ? "text-base" : "text-[15px]", dark ? "text-white" : "text-ink")} title={chart.title}>{chart.title || (isText ? "" : "Untitled chart")}</h3>
                {chart.subtitle && <p className={clsx("mt-0.5 truncate text-xs", dark ? "text-white/60" : "text-ink-2")}>{chart.subtitle}</p>}
                {filtered.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {filtered.map((f, i) => (
                      <span key={i} className={clsx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium", dark ? "bg-white/10 text-white/70" : "bg-brand-soft text-brand-ink")}>
                        <FilterIcon className="h-2.5 w-2.5" />
                        {f.column} {f.op === "in" ? "in" : f.op === "eq" ? "=" : f.op === "neq" ? "≠" : f.op === "contains" ? "∋" : f.op.replace("gte", "≥").replace("lte", "≤").replace("gt", ">").replace("lt", "<")} {Array.isArray(f.value) ? f.value.join(", ") : String(f.value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {!readOnly ? (
              <div
                data-export-ignore="1"
                onClick={(e) => e.stopPropagation()}
                className={clsx("flex shrink-0 items-center gap-0.5 rounded-lg border p-0.5 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100", selected && "sm:opacity-100", dark ? "border-white/10 bg-white/5" : "border-border bg-surface")}
              >
                <Tooltip label="Edit" side="bottom">
                  <button className={iconBtn} onClick={() => onSelect?.()} aria-label="Edit widget">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
                {!isText && (
                  <Tooltip label="Expand" side="bottom">
                    <button className={iconBtn} onClick={() => setExpanded(true)} aria-label="Expand widget">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                )}
                <Menu
                  trigger={
                    <button className={iconBtn} aria-label="Widget options">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  }
                  items={[
                    ...(["sm", "half", "wide", "full"] as WidgetSize[]).map((s) => ({ label: `${SIZE_LABEL[s]} width${chart.size === s ? " ✓" : ""}`, onClick: () => onResize?.(s) })),
                    { label: "Duplicate", icon: <Copy className="h-4 w-4" />, onClick: () => onDuplicate?.() },
                    { label: "Download PNG", icon: <Download className="h-4 w-4" />, onClick: downloadPng },
                    { label: "Download CSV", icon: <FileDown className="h-4 w-4" />, onClick: downloadCsv, disabled: isText },
                    { label: "Delete", icon: <Trash2 className="h-4 w-4" />, onClick: () => onDelete?.(), danger: true },
                  ]}
                />
              </div>
            ) : (
              !isText && (
                <div data-export-ignore="1" className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => setExpanded(true)} className={iconBtn} aria-label="Expand">
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <button onClick={downloadPng} className={clsx(iconBtn, downloading && "animate-pulse-soft")} aria-label="Download PNG">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              )
            )}
          </div>
          {!isKpi && !isText && (
            <div className="mb-2" data-export-ignore="1">
              <LegendChips config={chart.config} dark={dark} hidden={hidden} onToggle={toggle} countLabel={countLabel} />
            </div>
          )}
          <div className="flex-1">
            <ChartRenderer config={chart.config} rows={rows} columns={columns} theme={theme} height={widgetHeight(chart)} hidden={hidden} text={chart.note} />
          </div>
          {chart.note && !isText && <p className={clsx("mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed", dark ? "bg-white/5 text-white/70" : "bg-surface-2 text-ink-2")}>{chart.note}</p>}
        </div>
      </div>

      <Modal open={expanded} onClose={() => setExpanded(false)} title={chart.title} description={chart.subtitle || undefined} size="xl">
        <div className={clsx("rounded-2xl border p-4", dark && "chart-dark border-[#272b47] bg-[#13162a]")}>
          <div className="mb-2">
            <LegendChips config={chart.config} dark={dark} hidden={hidden} onToggle={toggle} countLabel={countLabel} />
          </div>
          <ChartRenderer config={chart.config} rows={rows} columns={columns} theme={theme} height={420} hidden={hidden} text={chart.note} />
        </div>
        {!isText && !isKpi && <SeriesTable chart={chart} rows={rows} columns={columns} />}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <FileDown className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPng}>
            <Download className="h-4 w-4" /> PNG
          </Button>
        </div>
      </Modal>
    </>
  );
}

function useCountLabel(columns: Column[], rows: Row[]) {
  return useMemo(() => {
    const e = entityWord(columns, rows).plural;
    return e.charAt(0).toUpperCase() + e.slice(1);
  }, [columns, rows]);
}

function SeriesTable({ chart, rows, columns }: { chart: ChartRecord; rows: Row[]; columns: Column[] }) {
  const keys = effectiveKeys(chart.config);
  const countLabel = useCountLabel(columns, rows);
  const pts = useMemo(() => buildSeries(rows, chart.config, columns), [rows, chart.config, columns]);
  if (!pts.length) return null;
  return (
    <div className="mt-4 overflow-auto rounded-xl border scrollbar-thin" style={{ maxHeight: 260 }}>
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-surface-2 text-ink-2">
          <tr>
            <th className="px-3 py-2 font-semibold">{chart.config.xKey || "Label"}</th>
            {keys.map((k) => (
              <th key={k} className="px-3 py-2 text-right font-semibold">
                {seriesLabel(k, countLabel)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pts.map((p, i) => (
            <tr key={i} className="border-t hover:bg-surface-2/70">
              <td className="px-3 py-1.5">{p.label}</td>
              {keys.map((k) => (
                <td key={k} className="px-3 py-1.5 text-right tabular-nums">
                  {formatNumber(Number(p[k]), chart.config.numberFormat)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
