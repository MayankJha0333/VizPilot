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
  /** Categorical colors in fixed order (never cycled) for light surfaces. */
  colors: string[];
  /** Same hues, stepped for dark surfaces. */
  dark: string[];
  hint?: string;
}

/**
 * Categorical palettes validated for colour-blind separation (adjacent ΔE ≥ 8
 * where possible, normal-vision ΔE ≥ 15) and lightness band, in light and dark.
 * The slot ORDER is part of the safety – don't reorder casually.
 */
export const PALETTES: Palette[] = [
  {
    id: "aurora",
    label: "VizPilot",
    hint: "Indigo-led, balanced",
    colors: ["#4C5FD5", "#EB6834", "#1BAF7A", "#EDA100", "#E87BA4", "#008300", "#7C4DCC", "#E34948"],
    dark: ["#6B7BF0", "#D95926", "#199E70", "#C98500", "#D55181", "#008300", "#9085E9", "#E66767"],
  },
  {
    id: "ocean",
    label: "Ocean",
    hint: "Blue-led, classic",
    colors: ["#2A78D6", "#EB6834", "#1BAF7A", "#EDA100", "#E87BA4", "#008300", "#4A3AA7", "#E34948"],
    dark: ["#3987E5", "#D95926", "#199E70", "#C98500", "#D55181", "#008300", "#9085E9", "#E66767"],
  },
  {
    id: "sunset",
    label: "Sunset",
    hint: "Warm-led",
    colors: ["#E4572E", "#2A78D6", "#EDA100", "#7C4DCC", "#1BAF7A", "#4C5FD5", "#E87BA4", "#008300"],
    dark: ["#E0592A", "#3987E5", "#C98500", "#9085E9", "#199E70", "#6B7BF0", "#D55181", "#2E9E3F"],
  },
  {
    id: "mono",
    label: "Mono",
    hint: "One hue – best for a single series",
    colors: ["#4C5FD5", "#7B8CE6", "#2F3E9E", "#A5B1F0", "#1E2A75", "#C6CEF6", "#5A6BDC", "#3949B8"],
    dark: ["#6B7BF0", "#95A2F4", "#4C5FD5", "#B7C0F7", "#3949B8", "#D2D8FA", "#7F8DF2", "#5A6BDC"],
  },
];

/** Legacy palette ids from earlier versions map onto the new set. */
const LEGACY: Record<string, string> = { forest: "aurora", pastel: "aurora", violet: "mono" };

export function getPalette(id: string, dark = false): string[] {
  const p = PALETTES.find((x) => x.id === (LEGACY[id] ?? id)) ?? PALETTES[0];
  return dark ? p.dark : p.colors;
}

export type WidgetSize = "sm" | "half" | "wide" | "full";

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
  /** Grid position in 12-column units. Missing = auto-placed. */
  layout?: WidgetLayout | null;
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
