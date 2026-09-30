"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Copy, Download, FileDown, GripVertical, Maximize2, MoreHorizontal, Pencil, Trash2, Filter as FilterIcon } from "lucide-react";
import { ChartRenderer, LegendChips } from "@/components/charts/ChartRenderer";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import type { ChartRecord, Column, Row, WidgetSize } from "@/lib/charts/types";
import { Database } from "lucide-react";
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
  /** @deprecated widths are set by dragging the resize handle now. */
  onResize?: (size: WidgetSize) => void;
  /** Name of the data source, shown when a report mixes several. */
  sourceName?: string;
  /** Fill the parent's height (grid cell) instead of a fixed chart height. */
  fill?: boolean;
  /** Hide the hover actions (used for previews). */
  hideActions?: boolean;
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

/** Measure an element's height (for charts that must fit their grid cell). */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function Widget({ chart, rows, columns, theme, selected, readOnly, index = 0, draggable, onSelect, onDuplicate, onDelete, sourceName, fill, hideActions }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [bodyRef, body] = useSize<HTMLDivElement>();
  const [cardRef, card] = useSize<HTMLDivElement>();
  const bodyH = body.h;
  // Small widgets drop secondary text so the chart keeps its room. Decided from the
  // card's outer size (stable), never from the body – hiding text changes the body.
  const narrow = fill && card.w > 0 && card.w < 290;
  const short = fill && card.h > 0 && card.h < 240;
  // Small widgets: let the hover tooltip float beside the widget, toward the side with room.
  const [floatTip, setFloatTip] = useState<"right" | "left" | null>(null);
  const pickTooltipSide = (el: HTMLElement) => {
    if (!fill || body.w >= 420) return setFloatTip(null);
    const r = el.getBoundingClientRect();
    setFloatTip(window.innerWidth - r.right >= 210 ? "right" : "left");
  };
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
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, backgroundColor: dark ? "#1c2032" : "#fbfbff", filter: (n) => !(n instanceof HTMLElement && n.dataset.exportIgnore === "1") });
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

  const iconBtn = clsx("flex h-7 w-7 items-center justify-center rounded-full transition-colors", "text-ink-2 hover:bg-surface-3 hover:text-ink");

  return (
    <>
      <div
        className={clsx(
          "widget-card group relative flex h-full flex-col text-ink animate-fade-up",
          selected && "!shadow-[0_0_0_3px_var(--ring),var(--card-shadow)]"
        )}
        style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
        onDoubleClick={readOnly ? undefined : onSelect}
        ref={cardRef}
        data-chart-card
      >
        <div ref={ref} className={clsx("flex min-h-0 flex-1 flex-col rounded-[24px]", narrow || short ? "p-3" : "px-[18px] pb-4 pt-4")}>
          <div data-drag-handle className={clsx("flex items-start justify-between gap-3", !isText && "mb-3", draggable && !readOnly && "cursor-grab active:cursor-grabbing")}>
            <div className="flex min-w-0 items-start gap-2">
              {/* Drag hint floats in the corner so it never pushes the title. */}
              {draggable && !readOnly && (
                <span data-export-ignore="1" className="absolute left-1 top-[18px] hidden cursor-grab text-ink-3 opacity-0 transition-opacity group-hover:opacity-60 sm:block" title="Drag to move">
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
              )}
              <div className="min-w-0">
                <h3 className={clsx("line-clamp-2 font-semibold leading-snug tracking-[-0.01em] text-ink", isText ? "text-base" : "text-[14px]")} title={chart.title}>{chart.title || (isText ? "" : "Untitled chart")}</h3>
                {chart.subtitle && !narrow && !short && <p className="mt-0.5 truncate text-xs text-ink-3">{chart.subtitle}</p>}
                {sourceName && !narrow && !short && (
                  <span className={clsx("mt-1 inline-flex max-w-full items-center gap-1 truncate text-[10px] font-medium", "text-ink-3")} title={`Data: ${sourceName}`}>
                    <Database className="h-2.5 w-2.5 shrink-0" /> {sourceName}
                  </span>
                )}
                {filtered.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {filtered.map((f, i) => (
                      <span key={i} className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", "bg-brand-soft text-brand-ink")}>
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
                className={clsx(
                  "absolute right-3 top-3 z-20 flex items-center gap-0.5 rounded-full p-1 shadow-[var(--shadow-sm)] transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100",
                  selected && "sm:opacity-100",
                  "bg-surface"
                )}
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
                    { label: "Duplicate", icon: <Copy className="h-4 w-4" />, onClick: () => onDuplicate?.() },
                    { label: "Download PNG", icon: <Download className="h-4 w-4" />, onClick: downloadPng },
                    { label: "Download CSV", icon: <FileDown className="h-4 w-4" />, onClick: downloadCsv, disabled: isText },
                    { label: "Delete", icon: <Trash2 className="h-4 w-4" />, onClick: () => onDelete?.(), danger: true },
                  ]}
                />
              </div>
            ) : (
              !isText &&
              !hideActions && (
                <div data-export-ignore="1" className={clsx("absolute right-3 top-3 z-20 flex items-center gap-0.5 rounded-full p-1 opacity-0 shadow-[var(--shadow-sm)] transition-opacity group-hover:opacity-100", "bg-surface")}>
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
          {!isKpi && !isText && !short && (
            <div className="mb-2" data-export-ignore="1">
              <LegendChips config={chart.config} dark={dark} hidden={hidden} onToggle={toggle} countLabel={countLabel} />
            </div>
          )}
          <div ref={bodyRef} onMouseEnter={(e) => pickTooltipSide(e.currentTarget)} className={clsx("relative min-h-0 flex-1", fill && (chart.config.type === "text" || chart.config.type === "table" ? "overflow-y-auto scrollbar-thin" : chart.config.type === "kpi" ? "overflow-hidden" : "overflow-y-clip"))}>
            {(!fill || bodyH > 0) && (
              <ChartRenderer
                config={chart.config}
                rows={rows}
                columns={columns}
                theme={theme}
                height={fill ? Math.max(60, bodyH) : widgetHeight(chart)}
                width={fill ? body.w : undefined}
                floatTooltip={floatTip}
                showKpiLabel={!chart.title}
                hidden={hidden}
                text={chart.note}
              />
            )}
          </div>
          {chart.note && !isText && !short && !narrow && <p className={clsx("mt-3 line-clamp-3 shrink-0 rounded-2xl px-3 py-2 text-xs leading-relaxed", "clay-inset text-ink-2")}>{chart.note}</p>}
        </div>
      </div>

      <Modal open={expanded} onClose={() => setExpanded(false)} title={chart.title} description={chart.subtitle || undefined} size="xl">
        <div className="clay rounded-[24px] p-4" data-theme={theme}>
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
    <div className="clay-inset mt-4 overflow-auto rounded-2xl scrollbar-thin" style={{ maxHeight: 260 }}>
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
