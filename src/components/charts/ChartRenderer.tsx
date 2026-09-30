"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { clsx } from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { COUNT_KEY, getPalette, type ChartConfig, type Column, type Row } from "@/lib/charts/types";
import { buildSeries, effectiveKeys, formatNumber, kpiStats, seriesLabel, toNumber } from "@/lib/data/transform";
import { entityWord } from "@/lib/charts/suggest";
import { CountUp } from "@/components/ui/misc";

/** Chart chrome colours, matched to the surface tokens in globals.css. */
// Chart chrome stays flat inside the clay card (data is never puffed up): hairline grid, quiet axes.
const CHART_LIGHT = { axis: "#5f6584", grid: "#e8eaf5", surface: "#fbfbff", text: "#21253f", cursor: "rgba(76, 95, 213, 0.07)" };
const CHART_DARK = { axis: "#9097b2", grid: "#2a2f45", surface: "#1c2032", text: "#eef0fa", cursor: "rgba(255, 255, 255, 0.05)" };

interface Props {
  config: ChartConfig;
  rows: Row[];
  columns: Column[];
  theme?: "light" | "dark";
  height?: number;
  compact?: boolean;
  animate?: boolean;
  /** Series hidden via the interactive legend. */
  hidden?: Set<string>;
  /** Text widgets render their note. */
  text?: string;
  /** Measured width of the widget body (dashboard). Enables size-aware layout. */
  width?: number;
  /**
   * Let the hover tooltip float outside a small widget instead of covering the
   * data: "right"/"left" of the cursor. Chosen by the widget on hover.
   */
  floatTooltip?: "right" | "left" | null;
  /** KPI: show the small caps label above the number (off when the widget title says it already). */
  showKpiLabel?: boolean;
}

export function ChartRenderer({ config, rows, columns, theme = "light", height = 280, compact = false, animate = true, hidden, text, width = 0, floatTooltip = null, showKpiLabel = true }: Props) {
  const uid = useId().replace(/:/g, "");
  const dark = theme === "dark";
  const colors = getPalette(config.palette, dark);
  const data = useMemo(() => buildSeries(rows, config, columns), [rows, config, columns]);
  const allKeys = effectiveKeys(config);
  const keys = allKeys.filter((k) => !hidden?.has(k));
  const colorOf = (k: string) => colors[Math.max(0, allKeys.indexOf(k)) % colors.length];
  // Chart chrome per theme (SVG attributes can't read CSS variables reliably).
  const T = dark ? CHART_DARK : CHART_LIGHT;
  const axisColor = T.axis;
  const gridColor = T.grid;
  const fmt = (v: number) => formatNumber(v, config.numberFormat);
  const anim = animate && !compact;
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const ent = useMemo(() => entityWord(columns, rows).plural, [columns, rows]);
  const countLabel = ent.charAt(0).toUpperCase() + ent.slice(1);
  const lbl = (k: string) => seriesLabel(k, countLabel);
  const tight = width > 0 && width < 320;
  const tooltip = (
    <Tooltip
      content={<ChartTooltip dark={dark} fmt={fmt} colorOf={colorOf} countLabel={countLabel} />}
      cursor={{ fill: T.cursor }}
      // In a small widget the tooltip floats beside it rather than on top of the bars.
      allowEscapeViewBox={floatTooltip ? { x: true, y: false } : { x: false, y: false }}
      reverseDirection={{ x: floatTooltip === "left", y: false }}
      offset={floatTooltip ? 18 : 12}
      wrapperStyle={{ zIndex: 60, pointerEvents: "none", outline: "none" }}
      isAnimationActive={false}
    />
  );

  if (config.type === "text") {
    return (
      <div className={clsx("prose-sm max-w-none whitespace-pre-wrap text-[14px] leading-relaxed", "text-ink-2")} style={{ minHeight: compact ? 40 : 80 }}>
        {text || <span className="text-ink-3">Add a note, a heading or a takeaway for readers…</span>}
      </div>
    );
  }
  if (!config.xKey && config.type !== "kpi" && config.type !== "table") {
    return <Placeholder text="Pick a column for the x-axis to see your chart." />;
  }
  if (allKeys.length === 0 && config.type !== "table") {
    return <Placeholder text="Pick a value column, or use “Count rows”." />;
  }
  if (keys.length === 0 && config.type !== "table" && config.type !== "kpi") {
    return <Placeholder text="All series are hidden — click a legend chip to show one." />;
  }

  switch (config.type) {
    case "kpi": {
      const key = config.yKeys[0];
      const stats = kpiStats(rows, config, columns);
      const label = !key ? `Total ${ent}` : config.aggregate === "avg" ? `Average ${key}` : config.aggregate === "count" ? `Count of ${key}` : config.aggregate === "max" ? `Max ${key}` : config.aggregate === "min" ? `Min ${key}` : `Total ${key}`;
      const up = (stats.delta?.pct ?? 0) >= 0;
      const flat = Math.abs(stats.delta?.pct ?? 0) < 0.5;
      const w = 200;
      const h = 48;
      const max = Math.max(...stats.series, 1);
      const min = Math.min(...stats.series, 0);
      const xy = stats.series.map((v, i) => [(i / Math.max(1, stats.series.length - 1)) * w, 4 + (h - 8) * (1 - (v - min) / (max - min || 1))] as const);
      const pts = xy.map(([x, y]) => `${x},${y}`).join(" ");
      const last = xy[xy.length - 1];
      // Number size follows the tile: big on wide tiles, never cramped on narrow ones.
      const numCls = compact || (width > 0 && width < 230) ? "text-[30px]" : width > 0 && width < 380 ? "text-[38px]" : "text-[46px]";
      const sparkH = Math.max(36, Math.min(76, height * 0.34));
      return (
        <div className="flex h-full flex-col" style={{ minHeight: compact ? 90 : 120 }}>
          <div>
            {showKpiLabel && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</div>}
            <div className={clsx("font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums", numCls)}>{anim ? <CountUp value={stats.value} format={fmt} /> : fmt(stats.value)}</div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {stats.delta ? (
                <>
                  <span className={clsx("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-bold tabular-nums", flat ? "bg-surface-3 text-ink-2" : up ? "bg-success-soft text-success-ink" : "bg-danger-soft text-danger-ink")}>
                    {flat ? <Minus className="h-3 w-3" /> : up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(stats.delta.pct).toFixed(1)}%
                  </span>
                  <span className="text-ink-3">vs {stats.delta.from}</span>
                </>
              ) : (
                <span className="text-ink-3">
                  {rows.length.toLocaleString()} {ent}
                  {config.xKey && stats.series.length ? ` · ${stats.series.length} ${config.xKey}` : ""}
                </span>
              )}
            </div>
          </div>
          {stats.series.length > 1 && !compact && (
            // The trend fills whatever height the tile has left, so tall tiles never show a dead gap.
            <div className="mt-auto flex min-h-0 flex-1 flex-col justify-end pt-3" style={{ minHeight: sparkH + 12, maxHeight: 220 }} title={config.xKey ? `Trend by ${config.xKey}` : undefined}>
              <div className="relative h-full min-h-[36px]">
                <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
                  <defs>
                    <linearGradient id={`${uid}-kpi`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor={colors[0]} stopOpacity="0.18" />
                      <stop offset="1" stopColor={colors[0]} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${uid}-kpi)`} />
                  <polyline points={pts} fill="none" stroke={colors[0]} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className={anim ? "animate-draw" : ""} />
                </svg>
                {last && (
                  <span
                    className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]"
                    style={{ left: `${(last[0] / w) * 100}%`, top: `${(last[1] / h) * 100}%`, background: colors[0] }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    case "table": {
      const cols = config.yKeys.length ? [config.xKey, ...config.yKeys].filter(Boolean) : columns.map((c) => c.name);
      const shown = (config.limit ? rows.slice(0, config.limit) : rows).slice(0, compact ? 8 : 200);
      return (
        <div className="clay-inset overflow-auto rounded-2xl scrollbar-thin" style={{ maxHeight: height }}>
          <table className="w-full text-left text-xs">
            <thead className={clsx("sticky top-0", "bg-surface-2 text-ink-2")}>
              <tr>
                {cols.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} className={clsx("border-t", "hover:bg-surface-2/70")}>
                  {cols.map((c) => (
                    <td key={c} className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                      {typeof r[c] === "number" ? fmt(r[c] as number) : String(r[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > shown.length && <div className="px-3 py-2 text-[11px] text-ink-3">Showing {shown.length} of {rows.length} rows</div>}
        </div>
      );
    }

    case "pie":
    case "donut": {
      const key = keys[0];
      const total = data.reduce((a, p) => a + toNumber(p[key]), 0);
      // Legend: pack items into at most 2 rows by their estimated width; the rest
      // collapse into a "+N more" chip that always has room on the last row.
      const showLegend = config.showLegend && !compact && !(width > 0 && width < 230) && height > 170;
      const avail = (width > 0 ? width : 560) - 8;
      const itemW = (p: { label: string }) => Math.min(140, 34 + p.label.length * 6.2) + 8 + 22;
      const MORE_W = 64;
      const legendItems: typeof data = [];
      let legendRows = 0;
      if (showLegend && data.length) {
        let row = 1;
        let used = 0;
        for (let i = 0; i < data.length; i++) {
          const w = itemW(data[i]);
          const reserve = row === 2 && i < data.length - 1 ? MORE_W : 0;
          if (used + w + reserve <= avail || used === 0) {
            legendItems.push(data[i]);
            used += w;
          } else if (row < 2) {
            row += 1;
            used = 0;
            i -= 1;
          } else break;
        }
        legendRows = row;
      }
      const legendMore = data.length - legendItems.length;
      const legendH = legendRows ? legendRows * 22 + 8 : 0;
      const active = activeIdx !== null ? data[activeIdx] : null;
      return (
        <div>
          <ResponsiveContainer width="100%" height={height - legendH}>
            <PieChart>
              {tooltip}
              <Pie
                data={data}
                dataKey={key}
                nameKey="label"
                innerRadius={config.type === "donut" ? "62%" : 0}
                outerRadius="88%"
                paddingAngle={config.type === "donut" ? 2.5 : 0.5}
                cornerRadius={config.type === "donut" ? 5 : 0}
                stroke={T.surface}
                strokeWidth={2}
                isAnimationActive={anim}
                animationDuration={800}
                animationEasing="ease-out"
                activeShape={(p: unknown) => {
                  const s = p as { cx: number; cy: number; innerRadius: number; outerRadius: number; startAngle: number; endAngle: number; fill: string };
                  return <Sector cx={s.cx} cy={s.cy} innerRadius={s.innerRadius} outerRadius={s.outerRadius + 6} startAngle={s.startAngle} endAngle={s.endAngle} fill={s.fill} cornerRadius={config.type === "donut" ? 5 : 0} />;
                }}
                onMouseEnter={(_, i) => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
                label={config.showLabels ? (p) => `${Math.round((toNumber(p.value) / (total || 1)) * 100)}%` : false}
                labelLine={config.showLabels}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} opacity={activeIdx === null || activeIdx === i ? 1 : 0.45} />
                ))}
              </Pie>
              {config.type === "donut" && (
                <>
                  <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fill={T.text} fontSize={compact || tight ? 15 : 22} fontWeight={600}>
                    {active ? fmt(toNumber(active[key])) : fmt(total)}
                  </text>
                  {!compact && !tight && (
                    <text x="50%" y="59%" textAnchor="middle" dominantBaseline="middle" fill="#8b90a8" fontSize={11}>
                      {active ? `${active.label} · ${Math.round((toNumber(active[key]) / (total || 1)) * 100)}%` : lbl(key)}
                    </text>
                  )}
                </>
              )}
            </PieChart>
          </ResponsiveContainer>
          {legendH > 0 && (
            <div className="mt-1 flex flex-wrap justify-center gap-x-2 gap-y-0.5 overflow-hidden" style={{ maxHeight: legendH }}>
              {legendItems.map((p, i) => (
                <button
                  key={p.label}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(null)}
                  title={`${p.label} · ${Math.round((toNumber(p[key]) / (total || 1)) * 100)}%`}
                  className={clsx("inline-flex max-w-[140px] items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors", "text-ink-2 hover:bg-surface-3", activeIdx === i && ("bg-surface-3"))}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
                  <span className="truncate">{p.label}</span>
                  <span className={clsx("shrink-0", "text-ink-3")}>{Math.round((toNumber(p[key]) / (total || 1)) * 100)}%</span>
                </button>
              ))}
              {legendMore > 0 && (
                <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", "text-ink-3")} title={data.slice(legendItems.length).map((p) => p.label).join(", ")}>
                  +{legendMore} more
                </span>
              )}
            </div>
          )}
        </div>
      );
    }

    case "scatter": {
      const [xk, yk] = config.yKeys;
      const points = data.map((p) => ({ label: p.label, x: toNumber(p[xk]), y: toNumber(p[yk ?? xk]) }));
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
            {config.showGrid && <CartesianGrid stroke={gridColor} />}
            <XAxis type="number" dataKey="x" name={xk} tick={{ fill: axisColor, fontSize: 11 }} tickFormatter={fmt} axisLine={false} tickLine={false} label={{ value: xk, position: "insideBottom", offset: -2, fill: axisColor, fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name={yk} tick={{ fill: axisColor, fontSize: 11 }} tickFormatter={fmt} axisLine={false} tickLine={false} width={48} />
            <ZAxis range={[70, 70]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as { label: string; x: number; y: number } | undefined;
                if (!p) return null;
                return (
                  <TooltipBox dark={dark}>
                    <div className="font-semibold">{p.label}</div>
                    <Rowline color={colors[0]} name={xk} value={fmt(p.x)} />
                    <Rowline color={colors[1]} name={yk} value={fmt(p.y)} />
                  </TooltipBox>
                );
              }}
            />
            <Scatter data={points} fill={colors[0]} fillOpacity={0.8} isAnimationActive={anim} animationDuration={700} />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    case "line":
    case "area": {
      const Comp = config.type === "line" ? LineChart : AreaChart;
      return (
        <ResponsiveContainer width="100%" height={height}>
          <Comp data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <defs>
              {allKeys.map((k) => (
                <linearGradient key={k} id={`${uid}-area-${allKeys.indexOf(k)}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorOf(k)} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={colorOf(k)} stopOpacity={0.01} />
                </linearGradient>
              ))}
            </defs>
            {config.showGrid && <CartesianGrid stroke={gridColor} vertical={false} />}
            <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickFormatter={fmt} axisLine={false} tickLine={false} width={48} />
            {tooltip}
            {keys.map((k) =>
              config.type === "line" ? (
                <Line
                  key={k}
                  type={config.smooth ? "monotone" : "linear"}
                  dataKey={k}
                  name={lbl(k)}
                  stroke={colorOf(k)}
                  strokeWidth={2}
                  dot={data.length <= 24 ? { r: 4, strokeWidth: 2, stroke: T.surface, fill: colorOf(k) } : false}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  isAnimationActive={anim}
                  animationDuration={900}
                  animationEasing="ease-out"
                >
                  {config.showLabels && <LabelList dataKey={k} position="top" formatter={(v: unknown) => fmt(Number(v))} fill={axisColor} fontSize={10} />}
                </Line>
              ) : (
                <Area
                  key={k}
                  type={config.smooth ? "monotone" : "linear"}
                  dataKey={k}
                  name={lbl(k)}
                  stroke={colorOf(k)}
                  fill={`url(#${uid}-area-${allKeys.indexOf(k)})`}
                  strokeWidth={2}
                  stackId={keys.length > 1 ? "a" : undefined}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  isAnimationActive={anim}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              )
            )}
          </Comp>
        </ResponsiveContainer>
      );
    }

    case "bar": {
      const rowH = 30;
      // In the dashboard the widget's height is fixed – bars get thinner instead of overflowing.
      const h = width > 0 ? height : Math.max(height, Math.min(data.length * rowH + 40, 640));
      const longest = Math.max(4, ...data.map((d) => d.label.length));
      const yAxisW = Math.round(Math.min(150, 8 + longest * 6.5, width > 0 ? Math.max(56, width * 0.36) : 150));
      const barLabels = config.showLabels || (!compact && data.length <= 12 && keys.length === 1 && (width === 0 || width >= 260) && h / Math.max(1, data.length) >= 16);
      return (
        <ResponsiveContainer width="100%" height={h}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 8 }} barCategoryGap="24%" onMouseMove={(s) => setActiveIdx(typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)} onMouseLeave={() => setActiveIdx(null)}>
            {config.showGrid && <CartesianGrid stroke={gridColor} horizontal={false} />}
            <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} tickFormatter={fmt} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" tick={<SideTick fill={axisColor} maxWidth={yAxisW - 8} />} axisLine={false} tickLine={false} width={yAxisW} interval={h / Math.max(1, data.length) < 14 ? "preserveStartEnd" : 0} />
            {tooltip}
            {keys.map((k) => (
              <Bar key={k} dataKey={k} name={lbl(k)} fill={colorOf(k)} radius={[0, 4, 4, 0]} isAnimationActive={anim} animationDuration={700} animationEasing="ease-out" maxBarSize={20}>
                {data.map((_, i) => (
                  <Cell key={i} fill={colorOf(k)} opacity={activeIdx === null || activeIdx === i ? 1 : 0.4} />
                ))}
                {barLabels && <LabelList dataKey={k} position="right" formatter={(v: unknown) => fmt(Number(v))} fill={axisColor} fontSize={10} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case "stackedColumn":
    case "column":
    default: {
      const stacked = config.type === "stackedColumn";
      // Room per category on the x-axis (0 = unknown / plenty).
      const slot = width > 0 ? (width - 56) / Math.max(1, data.length) : 0;
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 14, right: 8, bottom: 0, left: 0 }} barCategoryGap={keys.length > 1 ? "22%" : "30%"} barGap={2} onMouseMove={(s) => setActiveIdx(typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)} onMouseLeave={() => setActiveIdx(null)}>
            <defs>
              {allKeys.map((k) => (
                <linearGradient key={k} id={`${uid}-bar-${allKeys.indexOf(k)}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorOf(k)} stopOpacity={1} />
                  <stop offset="100%" stopColor={colorOf(k)} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>
            {config.showGrid && <CartesianGrid stroke={gridColor} vertical={false} />}
            <XAxis dataKey="label" tick={<CategoryTick fill={axisColor} />} axisLine={false} tickLine={false} interval={slot > 0 && slot < 26 ? "preserveStartEnd" : data.length > 14 ? "preserveStartEnd" : 0} minTickGap={6} height={22} />
            <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickFormatter={fmt} axisLine={false} tickLine={false} width={48} />
            {tooltip}
            {keys.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                name={lbl(k)}
                fill={colorOf(k)}
                stackId={stacked ? "a" : undefined}
                radius={stacked ? (i === keys.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
                stroke={stacked ? T.surface : undefined}
                strokeWidth={stacked ? 2 : 0}
                isAnimationActive={anim}
                animationDuration={700}
                animationEasing="ease-out"
                maxBarSize={28}
              >
                {data.map((_, j) => (
                  <Cell key={j} fill={colorOf(k)} opacity={activeIdx === null || activeIdx === j ? 1 : 0.4} />
                ))}
                {(config.showLabels || (!compact && data.length <= 8 && keys.length === 1 && !stacked && (slot === 0 || slot >= 34))) && <LabelList dataKey={k} position="top" formatter={(v: unknown) => fmt(Number(v))} fill={axisColor} fontSize={10} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }
  }
}

function TooltipBox({ children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-[150px] max-w-[240px] rounded-2xl bg-popover px-3.5 py-2.5 text-xs font-semibold text-ink shadow-[var(--shadow-md)]">{children}</div>
  );
}

function Rowline({ color, name, value }: { color: string; name: string; value: string }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-1.5 opacity-80">
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
        {name}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label, dark, fmt, colorOf, countLabel }: { active?: boolean; payload?: { name?: string; value?: unknown; dataKey?: string; color?: string; payload?: Record<string, unknown> }[]; label?: string; dark: boolean; fmt: (n: number) => string; colorOf: (k: string) => string; countLabel?: string }) {
  if (!active || !payload?.length) return null;
  const lbl = (k: string) => seriesLabel(k, countLabel);
  const title = label ?? (payload[0]?.payload?.label as string) ?? "";
  const total = payload.length > 1 ? payload.reduce((a, p) => a + Number(p.value ?? 0), 0) : null;
  return (
    <TooltipBox dark={dark}>
      <div className="font-semibold">{title}</div>
      {payload.map((p, i) => {
        const key = String(p.dataKey ?? p.name ?? "");
        return <Rowline key={i} color={colorOf(key)} name={lbl(key === COUNT_KEY ? COUNT_KEY : String(p.name ?? key))} value={fmt(Number(p.value))} />;
      })}
      {total !== null && (
        <div className={clsx("mt-1.5 flex items-center justify-between border-t pt-1.5", "border-border")}>
          <span className="opacity-70">Total</span>
          <span className="font-semibold tabular-nums">{fmt(total)}</span>
        </div>
      )}
    </TooltipBox>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="clay-inset flex h-full min-h-[180px] items-center justify-center rounded-2xl text-center text-sm font-semibold text-ink-3">
      <span className="max-w-[240px] px-4">{text}</span>
    </div>
  );
}

/** Interactive legend chips: click to hide/show a series. */
export function LegendChips({ config, dark = false, hidden, onToggle, countLabel }: { config: ChartConfig; dark?: boolean; hidden?: Set<string>; onToggle?: (k: string) => void; countLabel?: string }) {
  const lbl = (k: string) => seriesLabel(k, countLabel);
  if (!config.showLegend) return null;
  const keys = effectiveKeys(config);
  // A single series needs no legend – the title already names it.
  if (["kpi", "table", "pie", "donut", "scatter", "text"].includes(config.type) || keys.length < 2) return null;
  const colors = getPalette(config.palette, dark);
  return (
    <div className="flex flex-wrap gap-1.5">
      {keys.map((k, i) => {
        const off = hidden?.has(k);
        return (
          <button
            key={k}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(k);
            }}
            title={off ? "Show series" : "Hide series"}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all",
              "bg-surface-3 text-ink-2 hover:bg-border",
              off && "opacity-45 line-through"
            )}
          >
            <span className="h-2 w-2 rounded-sm" style={{ background: colors[i % colors.length] }} />
            {lbl(k)}
          </button>
        );
      })}
    </div>
  );
}

/** X-axis label that shortens itself (with …) to the space each category has. */
function CategoryTick(props: { x?: number; y?: number; payload?: { value: string }; width?: number; visibleTicksCount?: number; fill?: string }) {
  const { x = 0, y = 0, payload, width = 0, visibleTicksCount = 1, fill } = props;
  const full = String(payload?.value ?? "");
  const slot = width / Math.max(1, visibleTicksCount);
  const max = Math.max(3, Math.floor((slot - 6) / 6.2));
  const label = full.length > max ? `${full.slice(0, Math.max(1, max - 1)).trimEnd()}…` : full;
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={12} textAnchor="middle" fill={fill} fontSize={11}>
        <title>{full}</title>
        {label}
      </text>
    </g>
  );
}

/** Y-axis category label for horizontal bars, shortened to the axis width. */
function SideTick(props: { x?: number; y?: number; payload?: { value: string }; fill?: string; maxWidth?: number }) {
  const { x = 0, y = 0, payload, fill, maxWidth = 120 } = props;
  const full = String(payload?.value ?? "");
  const max = Math.max(3, Math.floor(maxWidth / 6.2));
  const label = full.length > max ? `${full.slice(0, Math.max(1, max - 1)).trimEnd()}…` : full;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={fill} fontSize={11}>
      <title>{full}</title>
      {label}
    </text>
  );
}
