export type ColumnType = "number" | "string" | "date" | "boolean";

export interface Column {
  name: string;
  type: ColumnType;
}

export type Row = Record<string, string | number | boolean | null>;

export type ChartType =
  | "column"
  | "bar"
  | "stackedColumn"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "scatter"
  | "kpi"
  | "table"
  | "text";

export type Aggregate = "sum" | "avg" | "count" | "min" | "max" | "none";

/** Virtual measure used when a chart counts rows instead of summing a column. */
export const COUNT_KEY = "__count";
export type SortMode = "none" | "asc" | "desc" | "label";

export interface ChartConfig {
  type: ChartType;
  xKey: string;
  yKeys: string[];
  aggregate: Aggregate;
  sort: SortMode;
  limit: number; // 0 = no limit
  palette: string;
  showLegend: boolean;
  showGrid: boolean;
  showLabels: boolean;
  smooth: boolean;
  numberFormat: "auto" | "plain" | "compact" | "percent" | "currency";
  /** How to roll up a date x-axis. "auto" picks month for long daily series. */
  timeBucket?: TimeBucket;
  /** Row filters applied before aggregation. */
  filters?: Filter[];
}

export type TimeBucket = "auto" | "none" | "day" | "week" | "month" | "quarter" | "year";

export type FilterOp = "eq" | "neq" | "in" | "gt" | "gte" | "lt" | "lte" | "contains";
export interface Filter {
  column: string;
  op: FilterOp;
  value: string | number | string[];
}

export const DEFAULT_CONFIG: ChartConfig = {
  type: "column",
  xKey: "",
  yKeys: [],
  aggregate: "sum",
  sort: "none",
  limit: 0,
  palette: "aurora",
  showLegend: true,
  showGrid: true,
  showLabels: false,
  smooth: true,
  numberFormat: "auto",
  timeBucket: "auto",
};

export const CHART_TYPES: { id: ChartType; label: string; hint: string }[] = [
  { id: "column", label: "Column", hint: "Compare categories" },
  { id: "bar", label: "Bar", hint: "Long labels, rankings" },
  { id: "stackedColumn", label: "Stacked", hint: "Parts of a total" },
  { id: "line", label: "Line", hint: "Trends over time" },
  { id: "area", label: "Area", hint: "Volume over time" },
  { id: "pie", label: "Pie", hint: "Share of total" },
  { id: "donut", label: "Donut", hint: "Share, with a KPI" },
  { id: "scatter", label: "Scatter", hint: "Two measures" },
  { id: "kpi", label: "KPI", hint: "One big number" },
  { id: "table", label: "Table", hint: "Raw rows" },
  { id: "text", label: "Text", hint: "A note or heading" },
];

export interface Palette {
  id: string;
  label: string;
  colors: string[];
}

export const PALETTES: Palette[] = [
  {
    id: "aurora",
    label: "Aurora",
    colors: ["#6D5CFF", "#FF6B8A", "#14B8A6", "#F5A524", "#38BDF8", "#A78BFA", "#F97316", "#84CC16"],
  },
  {
    id: "ocean",
    label: "Ocean",
    colors: ["#0EA5E9", "#2563EB", "#14B8A6", "#6366F1", "#38BDF8", "#0F766E", "#818CF8", "#22D3EE"],
  },
  {
    id: "sunset",
    label: "Sunset",
    colors: ["#F97316", "#EF4444", "#F59E0B", "#EC4899", "#FB7185", "#FBBF24", "#DC2626", "#F472B6"],
  },
  {
    id: "forest",
    label: "Forest",
    colors: ["#16A34A", "#65A30D", "#0D9488", "#22C55E", "#84CC16", "#059669", "#4ADE80", "#A3E635"],
  },
  {
    id: "pastel",
    label: "Pastel",
    colors: ["#A5B4FC", "#F9A8D4", "#86EFAC", "#FCD34D", "#67E8F9", "#D8B4FE", "#FCA5A5", "#BEF264"],
  },
  {
    id: "mono",
    label: "Mono",
    colors: ["#111827", "#4B5563", "#9CA3AF", "#D1D5DB", "#374151", "#6B7280", "#E5E7EB", "#1F2937"],
  },
  {
    id: "violet",
    label: "Violet",
    colors: ["#7C3AED", "#A78BFA", "#C4B5FD", "#5B21B6", "#8B5CF6", "#DDD6FE", "#4C1D95", "#9F7AEA"],
  },
];

export function getPalette(id: string): string[] {
  return (PALETTES.find((p) => p.id === id) ?? PALETTES[0]).colors;
}

export type WidgetSize = "sm" | "half" | "wide" | "full";

export interface ChartRecord {
  _id: string;
  reportId: string;
  datasetId: string;
  title: string;
  subtitle: string;
  note: string;
  config: ChartConfig;
  size: WidgetSize;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DatasetRecord {
  _id: string;
  name: string;
  source: string;
  columns: Column[];
  rows: Row[];
  rowCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DatasetSummary {
  _id: string;
  name: string;
  source: string;
  columns: Column[];
  rowCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportRecord {
  _id: string;
  title: string;
  description: string;
  datasetId: string | null;
  theme: "light" | "dark";
  palette: string;
  layout: "grid" | "single";
  isPublic: boolean;
  shareId?: string;
  chartCount?: number;
  createdAt?: string;
  updatedAt?: string;
  lastOpenedAt?: string;
}
