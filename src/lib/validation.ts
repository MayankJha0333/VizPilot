import { z } from "zod";
import { MAX_ROWS } from "@/lib/data/parse";

export const SESSION_COOKIE = "vp_session";

export const ColumnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["number", "string", "date", "boolean"]),
});

export const RowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const DatasetInput = z.object({
  name: z.string().trim().min(1).max(120),
  source: z.enum(["csv", "excel", "paste", "manual", "sample", "ai"]).default("manual"),
  columns: z.array(ColumnSchema).min(1).max(100),
  rows: z.array(RowSchema).max(MAX_ROWS),
});

export const FilterSchema = z.object({
  column: z.string().min(1),
  op: z.enum(["eq", "neq", "in", "gt", "gte", "lt", "lte", "contains"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export const ChartConfigSchema = z.object({
  type: z.enum(["column", "bar", "stackedColumn", "line", "area", "pie", "donut", "scatter", "kpi", "table", "text"]),
  xKey: z.string().default(""),
  yKeys: z.array(z.string()).default([]),
  aggregate: z.enum(["sum", "avg", "count", "min", "max", "none"]).default("sum"),
  sort: z.enum(["none", "asc", "desc", "label"]).default("none"),
  limit: z.number().int().min(0).max(1000).default(0),
  palette: z.string().default("aurora"),
  showLegend: z.boolean().default(true),
  showGrid: z.boolean().default(true),
  showLabels: z.boolean().default(false),
  smooth: z.boolean().default(true),
  numberFormat: z.enum(["auto", "plain", "compact", "percent", "currency"]).default("auto"),
  timeBucket: z.enum(["auto", "none", "day", "week", "month", "quarter", "year"]).optional(),
  filters: z.array(FilterSchema).max(10).optional(),
});

export const ChartInput = z.object({
  reportId: z.string().min(1),
  title: z.string().trim().max(160).default("Untitled chart"),
  subtitle: z.string().trim().max(240).default(""),
  note: z.string().trim().max(2000).default(""),
  config: ChartConfigSchema,
  size: z.enum(["sm", "half", "wide", "full"]).default("half"),
});

export const ChartPatch = z.object({
  title: z.string().trim().max(160).optional(),
  subtitle: z.string().trim().max(240).optional(),
  note: z.string().trim().max(2000).optional(),
  config: ChartConfigSchema.optional(),
  size: z.enum(["sm", "half", "wide", "full"]).optional(),
  order: z.number().int().optional(),
});

export const ReportInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).default(""),
  datasetId: z.string().min(1).nullable().default(null),
  autoCharts: z.boolean().default(false),
  palette: z.string().default("aurora"),
});

export const ReportPatch = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  datasetId: z.string().min(1).nullable().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  palette: z.string().optional(),
  layout: z.enum(["grid", "single"]).optional(),
  isPublic: z.boolean().optional(),
  chartOrder: z.array(z.string()).optional(),
});
