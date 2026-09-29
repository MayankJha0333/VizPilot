import type { Aggregate, ChartConfig, Column, Filter, Row } from "@/lib/charts/types";
import { COUNT_KEY } from "@/lib/charts/types";
import { autoBucket, bucketDate, parseDateValue } from "@/lib/data/dates";

export interface SeriesPoint {
  label: string;
  [key: string]: string | number;
}

function agg(values: number[], mode: Aggregate): number {
  if (mode === "count") return values.length;
  if (values.length === 0) return 0;
  switch (mode) {
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "sum":
    case "none":
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

/** The measure keys a chart actually plots. Count-only charts use a virtual "Rows" key. */
export function effectiveKeys(config: Pick<ChartConfig, "yKeys" | "aggregate">): string[] {
  if (config.yKeys.length === 0 && config.aggregate === "count") return [COUNT_KEY];
  return config.yKeys;
}

export function isCountOnly(config: Pick<ChartConfig, "yKeys" | "aggregate">): boolean {
  return config.yKeys.length === 0 && config.aggregate === "count";
}

/**
 * Turns raw rows into chart-ready points: one point per distinct x value,
 * with each y column aggregated. With aggregate "count" and no yKeys, each
 * point is simply the number of rows in that group.
 */
export function buildSeries(allRows: Row[], config: ChartConfig, columns?: Column[]): SeriesPoint[] {
  const { xKey, aggregate, sort, limit } = config;
  const yKeys = effectiveKeys(config);
  if (!xKey) return [];
  const rows = applyFilters(allRows, config.filters);

  // Time bucketing: roll daily dates up to week/month/quarter when it helps.
  const xCol = columns?.find((c) => c.name === xKey);
  const looksLikeDate = xCol ? xCol.type === "date" : looksDateColumn(rows, xKey);
  let bucketOf: ((v: unknown) => { key: string; label: string } | null) | null = null;
  let chronological = false;
  if (looksLikeDate && aggregate !== "none" && config.timeBucket !== "none") {
    const parsed = rows.map((r) => parseDateValue(r[xKey])).filter((d): d is Date => !!d);
    if (parsed.length >= rows.length * 0.8 && parsed.length > 0) {
      const b = config.timeBucket && config.timeBucket !== "auto" ? config.timeBucket : autoBucket(parsed);
      chronological = true;
      if (b !== "none") {
        bucketOf = (v) => {
          const d = parseDateValue(v);
          return d ? bucketDate(d, b) : null;
        };
      } else {
        bucketOf = (v) => {
          const d = parseDateValue(v);
          return d ? { key: d.toISOString(), label: String(v ?? "") } : null;
        };
      }
    }
  }

  if (aggregate === "none") {
    let pts = rows.map((r) => {
      const p: SeriesPoint = { label: String(r[xKey] ?? "") };
      yKeys.forEach((k) => (p[k] = toNumber(r[k])));
      return p;
    });
    pts = applySort(pts, yKeys, sort);
    return limit > 0 ? pts.slice(0, limit) : pts;
  }

  const groups = new Map<string, Record<string, number[]>>();
  const labels = new Map<string, string>();
  const order: string[] = [];
  for (const r of rows) {
    const raw = String(r[xKey] ?? "").trim() || "(blank)";
    const b = bucketOf ? bucketOf(r[xKey]) : null;
    const key = b ? b.key : raw;
    if (!groups.has(key)) {
      groups.set(key, {});
      labels.set(key, b ? b.label : raw);
      order.push(key);
    }
    const g = groups.get(key)!;
    for (const k of yKeys) {
      if (!g[k]) g[k] = [];
      if (k === COUNT_KEY) {
        g[k].push(1);
        continue;
      }
      const v = r[k];
      if (aggregate === "count") {
        if (v !== null && v !== undefined && v !== "") g[k].push(1);
      } else if (typeof v === "number") {
        g[k].push(v);
      } else if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
        g[k].push(Number(v));
      }
    }
  }

  if (chronological) order.sort();
  let pts: SeriesPoint[] = order.map((key) => {
    const p: SeriesPoint = { label: labels.get(key) ?? key };
    const g = groups.get(key)!;
    yKeys.forEach((k) => (p[k] = round(agg(g[k] ?? [], k === COUNT_KEY ? "count" : aggregate))));
    return p;
  });

  // Time series stay chronological unless the user explicitly ranks them.
  pts = applySort(pts, yKeys, chronological && sort === "label" ? "none" : sort);
  return limit > 0 ? pts.slice(0, limit) : pts;
}

function looksDateColumn(rows: Row[], key: string): boolean {
  const sample = rows.slice(0, 50).map((r) => r[key]).filter((v) => v !== null && v !== undefined && v !== "");
  if (!sample.length) return false;
  const ok = sample.filter((v) => typeof v !== "number" && parseDateValue(v)).length;
  return ok / sample.length >= 0.8;
}

function applySort(pts: SeriesPoint[], yKeys: string[], sort: ChartConfig["sort"]) {
  if (sort === "none" || yKeys.length === 0) return pts;
  const key = yKeys[0];
  const copy = [...pts];
  if (sort === "label") return copy.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  copy.sort((a, b) => {
    const av = Number(a[key]) || 0;
    const bv = Number(b[key]) || 0;
    return sort === "asc" ? av - bv : bv - av;
  });
  return copy;
}

export function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[$€£₹,%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function numericColumns(columns: Column[]): Column[] {
  return columns.filter((c) => c.type === "number");
}

export function categoryColumns(columns: Column[]): Column[] {
  return columns.filter((c) => c.type !== "number");
}

/** Number of distinct values in a column. */
export function distinctCount(rows: Row[], key: string): number {
  return new Set(rows.map((r) => String(r[key] ?? ""))).size;
}

/** Apply row filters (case-insensitive for text). */
export function applyFilters(rows: Row[], filters?: Filter[]): Row[] {
  if (!filters || filters.length === 0) return rows;
  return rows.filter((r) =>
    filters.every((f) => {
      const v = r[f.column];
      if (f.op === "in") {
        const set = new Set((Array.isArray(f.value) ? f.value : [String(f.value)]).map((x) => String(x).toLowerCase()));
        return set.has(String(v ?? "").toLowerCase());
      }
      if (f.op === "contains") return String(v ?? "").toLowerCase().includes(String(f.value).toLowerCase());
      if (f.op === "eq") return String(v ?? "").toLowerCase() === String(f.value).toLowerCase();
      if (f.op === "neq") return String(v ?? "").toLowerCase() !== String(f.value).toLowerCase();
      const n = toNumber(v);
      const t = toNumber(f.value);
      if (f.op === "gt") return n > t;
      if (f.op === "gte") return n >= t;
      if (f.op === "lt") return n < t;
      if (f.op === "lte") return n <= t;
      return true;
    })
  );
}

/** KPI value = aggregate over a single measure (or total row count). */
export function kpiValue(allRows: Row[], key: string | undefined, aggregate: Aggregate, filters?: Filter[]): number {
  const rows = applyFilters(allRows, filters);
  if (!key || key === COUNT_KEY) return rows.length;
  const vals = rows.map((r) => r[key]).filter((v) => typeof v === "number") as number[];
  if (aggregate === "count") return rows.filter((r) => r[key] !== null && r[key] !== undefined && r[key] !== "").length;
  return round(agg(vals, aggregate === "none" ? "sum" : aggregate));
}

export function formatNumber(n: number, mode: ChartConfig["numberFormat"] = "auto"): string {
  if (!Number.isFinite(n)) return "–";
  switch (mode) {
    case "percent":
      return `${round(n)}%`;
    case "currency":
      return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    case "plain":
      return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    case "compact":
      return compact(n);
    case "auto":
    default:
      return Math.abs(n) >= 10000 ? compact(n) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
}

export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${round(n / 1e9)}B`;
  if (abs >= 1e6) return `${round(n / 1e6)}M`;
  if (abs >= 1e3) return `${round(n / 1e3)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Human label for a series key. */
export function seriesLabel(key: string, countLabel = "Rows"): string {
  return key === COUNT_KEY ? countLabel : key;
}

/** KPI details: value, a sparkline over the x-axis groups, and a period-over-period delta when the x column is a date. */
export function kpiStats(rows: Row[], config: ChartConfig, columns?: Column[]): { value: number; series: number[]; labels: string[]; delta: { pct: number; from: string; to: string } | null } {
  const filtered = applyFilters(rows, config.filters);
  const key = config.yKeys[0];
  const agg = config.aggregate === "none" ? "sum" : config.aggregate;
  const value = kpiValue(filtered, key, agg);
  if (!config.xKey) return { value, series: [], labels: [], delta: null };
  const seriesCfg: ChartConfig = { ...config, type: "line", sort: "none", limit: 0, filters: undefined };
  const pts = buildSeries(filtered, seriesCfg, columns);
  const k = effectiveKeys(config)[0];
  const series = pts.map((p) => Number(p[k]) || 0);
  const labels = pts.map((p) => p.label);
  const xCol = columns?.find((c) => c.name === config.xKey);
  let delta: { pct: number; from: string; to: string } | null = null;
  if (xCol?.type === "date" && series.length >= 2) {
    const a = series[series.length - 2];
    const b = series[series.length - 1];
    if (a) delta = { pct: ((b - a) / Math.abs(a)) * 100, from: labels[labels.length - 2], to: labels[labels.length - 1] };
  }
  return { value, series: series.slice(-24), labels: labels.slice(-24), delta };
}
