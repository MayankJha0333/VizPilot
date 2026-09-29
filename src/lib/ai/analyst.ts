import "server-only";
import { completeJSON, hasAIProvider } from "@/lib/ai/client";
import { ChartConfigSchema } from "@/lib/validation";
import { buildChartFromPrompt, isFollowUp, titleFor } from "@/lib/charts/intent";
import { entityWord, groupableColumns, isIdLike, measureAggregate, rankMeasures } from "@/lib/charts/suggest";
import { applyFilters, buildSeries, distinctCount, effectiveKeys, formatNumber, kpiValue } from "@/lib/data/transform";
import { DEFAULT_CONFIG, type ChartConfig, type Column, type Filter, type Row } from "@/lib/charts/types";

/**
 * The "analyst": turns a natural-language question about a dataset into a
 * structured answer – a chart, a number, or insights – with the steps used to
 * build it (so the user can trust it, Graphy-style). Uses the model when one
 * is available and validates/repairs everything it returns; otherwise falls
 * back to the rules engine. Either way the output shape is identical.
 */

export type AskKind = "chart" | "answer" | "insights";

export interface AskResult {
  kind: AskKind;
  /** Short conversational reply. */
  message: string;
  /** "Here's how I built this" steps (deterministic, computed from the config). */
  steps: string[];
  chart?: { title: string; subtitle: string; config: ChartConfig };
  answer?: { label: string; value: string; detail?: string };
  insights?: string[];
  /** Facts about the plotted data, for the reply and for the user. */
  facts?: string;
  followUps: string[];
  provider: string;
  model?: string;
}

export interface HistoryItem {
  role: "user" | "assistant";
  text: string;
}

const SYSTEM = `You are VizPilot's data analyst. The user asks questions about ONE dataset in plain English. You answer with a JSON object only – no prose outside the JSON.

You can do three things:
1. "chart" – build a visualization. Give a "config".
2. "answer" – answer a factual question with a single number (e.g. "what's the total revenue?", "which region sold the most?"). Still give a "config" (usually type "kpi" or a ranked "bar") so the app can compute the exact number from the data – never invent numbers yourself.
3. "insights" – when the user asks for a summary, what's interesting, trends, anomalies, or "tell me about this data". Give 3-5 "insights" grounded in the stats provided.

JSON shape:
{
  "kind": "chart" | "answer" | "insights",
  "message": "one or two friendly sentences (mention what to notice; no numbers you did not get from the stats)",
  "title": "short chart title",
  "subtitle": "one line",
  "config": {
    "type": "column|bar|stackedColumn|line|area|pie|donut|scatter|kpi|table",
    "xKey": "<exact column name>",
    "yKeys": ["<exact numeric column name>"],
    "aggregate": "sum|avg|count|min|max|none",
    "sort": "none|asc|desc|label",
    "limit": 0,
    "timeBucket": "auto|none|day|week|month|quarter|year",
    "filters": [{"column": "<exact column>", "op": "eq|neq|in|gt|gte|lt|lte|contains", "value": "<exact value from the column's values>"}]
  },
  "insights": ["..."],
  "followUps": ["3 short follow-up questions the user might ask next"]
}

Rules:
- Column names and filter values must match the dataset EXACTLY (case-sensitive) – use the values listed.
- To count rows per category ("how many orders per channel") use "aggregate":"count" and "yKeys":[]. Do the same whenever the dataset has no numeric columns.
- Never group by id-like columns (ids, tokens, emails). Use the "good grouping columns".
- "line"/"area" for dates (set timeBucket "month" for daily data spanning months); "bar" for >8 categories or long labels; "column" for ≤8; "donut"/"pie" for share/split with ≤8 categories and one measure; "kpi" for a single number; "scatter" for two numeric measures with aggregate "none".
- "sum" for additive measures (revenue, units, spend); "avg" for measures that cannot be added up (hours, scores, ratings, rates, %, prices, ages) and whenever the user says average/typical; "count" for how many; "max"/"min" when asked.
- "top N" → sort "desc", limit N. "bottom N" → sort "asc", limit N.
- Filters: "for Electronics", "in Europe", "Q3 only", "orders over 500" → filters. Multiple values → op "in" with an array.
- When the user refines the previous chart ("make it a bar", "top 5", "only Europe", "monthly"), start from the previous config and change only what they asked.
- Keep "message" short. Do not describe the JSON.`;

export interface DatasetBrief {
  text: string;
  columns: Column[];
}

/** A compact description of the dataset for the model: columns, types, distinct values, stats. */
export function datasetBrief(name: string, columns: Column[], rows: Row[]): DatasetBrief {
  const lines: string[] = [`Dataset "${name}": ${rows.length.toLocaleString()} rows.`, "Columns:"];
  for (const c of columns) {
    const vals = rows.map((r) => r[c.name]).filter((v) => v !== null && v !== undefined && v !== "");
    const d = new Set(vals.map((v) => String(v))).size;
    if (c.type === "number") {
      const nums = vals.filter((v): v is number => typeof v === "number");
      const sum = nums.reduce((a, b) => a + b, 0);
      const min = nums.length ? Math.min(...nums) : 0;
      const max = nums.length ? Math.max(...nums) : 0;
      lines.push(`- ${c.name} (number): sum ${formatNumber(sum)}, avg ${formatNumber(nums.length ? sum / nums.length : 0)}, min ${formatNumber(min)}, max ${formatNumber(max)}, ${nums.length} filled`);
    } else if (c.type === "date") {
      const sorted = vals.map(String).sort();
      lines.push(`- ${c.name} (date): ${d} distinct, from ${sorted[0]} to ${sorted[sorted.length - 1]}`);
    } else if (isIdLike(rows, c)) {
      lines.push(`- ${c.name} (id-like text, ${d} distinct) – do NOT group by this`);
    } else {
      const counts = new Map<string, number>();
      vals.forEach((v) => counts.set(String(v), (counts.get(String(v)) ?? 0) + 1));
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
      lines.push(`- ${c.name} (category, ${d} distinct): ${top.map(([k, n]) => `"${k}" (${n})`).join(", ")}${d > 12 ? ", …" : ""}`);
    }
  }
  const groupable = groupableColumns(columns, rows).map((c) => c.name);
  lines.push(`Good grouping columns: ${groupable.join(", ") || "none"}`);
  const measures = rankMeasures(columns).map((c) => c.name);
  lines.push(`Numeric measures (best first): ${measures.join(", ") || "none – count rows instead"}`);
  lines.push(`Sample rows: ${JSON.stringify(rows.slice(0, 5))}`);
  return { text: lines.join("\n"), columns };
}

interface ModelPlan {
  kind?: string;
  message?: string;
  title?: string;
  subtitle?: string;
  config?: Partial<ChartConfig> & { filters?: Partial<Filter>[] };
  insights?: string[];
  followUps?: string[];
}

export async function ask(params: {
  datasetName: string;
  columns: Column[];
  rows: Row[];
  prompt: string;
  palette: string;
  history: HistoryItem[];
  lastConfig: ChartConfig | null;
}): Promise<AskResult> {
  const { datasetName, columns, rows, prompt, palette, history, lastConfig } = params;
  const brief = datasetBrief(datasetName, columns, rows);
  const wantsInsights = looksLikeInsightQuestion(prompt);

  if (hasAIProvider()) {
    try {
      const user = [
        brief.text,
        history.length ? `Conversation so far:\n${history.slice(-8).map((h) => `${h.role}: ${h.text}`).join("\n")}` : "",
        lastConfig ? `Previous chart config: ${JSON.stringify(lastConfig)}` : "",
        `User question: ${prompt}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      const { data, result } = await completeJSON<ModelPlan>(SYSTEM, user, { temperature: 0.15, maxTokens: 900 });
      const built = fromModelPlan(data, columns, rows, palette, lastConfig, wantsInsights);
      if (built) return { ...built, provider: result.provider, model: result.model };
      console.warn("[ai/ask] model plan could not be validated, using rules");
    } catch (err) {
      console.warn("[ai/ask] model failed, using rules:", (err as Error).message);
    }
  }
  return { ...fromRules(columns, rows, prompt, palette, lastConfig, wantsInsights), provider: "rules" };
}

// ---------------------------------------------------------------------------

function looksLikeInsightQuestion(p: string) {
  const s = p.toLowerCase();
  return (
    /\b(insight|summar|overview|interesting|stand out|anomal|unusual|tell me about|describe|explain the data|key takeaway|what should i know|analy[sz]e|highlights?|findings?)/.test(s) &&
    !/\b(chart|graph|plot|show me|visuali|bar|line|pie|donut|kpi|scatter|area|table|top \d|by )\b/.test(s)
  );
}

function fromModelPlan(plan: ModelPlan, columns: Column[], rows: Row[], palette: string, last: ChartConfig | null, wantsInsights: boolean): Omit<AskResult, "provider"> | null {
  const kind: AskKind = plan.kind === "insights" || (wantsInsights && !plan.config) ? "insights" : plan.kind === "answer" ? "answer" : "chart";
  const followUps = (plan.followUps ?? []).filter((f) => typeof f === "string").slice(0, 3);

  if (kind === "insights") {
    const insights = (plan.insights ?? []).filter((x) => typeof x === "string" && x.trim()).slice(0, 6);
    if (!insights.length) return null;
    return { kind, message: plan.message || "Here's what stands out:", steps: ["Scanned every column", `Read ${rows.length.toLocaleString()} rows`], insights, followUps: followUps.length ? followUps : defaultFollowUps(columns, rows) };
  }

  if (!plan.config) return null;
  const merged = { ...DEFAULT_CONFIG, ...(last ?? {}), palette: last?.palette ?? palette, ...plan.config, filters: normalizeFilters(plan.config.filters, columns, rows) };
  // "Which X has the most…" – the answer tile names the winner; the chart should show the whole ranking.
  if (kind === "answer" && merged.limit === 1 && merged.type !== "kpi") merged.limit = 0;
  const parsed = ChartConfigSchema.safeParse(merged);
  if (!parsed.success) return null;
  const config = repairConfig(parsed.data, columns, rows);
  if (!config) return null;

  const titled = titleFor(config, columns, config.limit, entityWord(columns, rows).plural);
  const facts = describeFacts(config, rows, columns);
  const steps = describeSteps(config, columns, rows);
  const base = {
    steps,
    chart: { title: plan.title || titled.title, subtitle: plan.subtitle || titled.subtitle, config },
    facts,
    followUps: followUps.length ? followUps : refineFollowUps(config),
  };
  if (kind === "answer") {
    const answer = computeAnswer(config, rows, columns);
    // Numbers in the reply come from our own computation, never from the model's prose.
    return { kind, message: answer.detail || plan.message || "Here's the answer.", answer, ...base };
  }
  return { kind: "chart", message: plan.message || `Here's ${titled.title.toLowerCase()}.`, ...base };
}

function fromRules(columns: Column[], rows: Row[], prompt: string, palette: string, last: ChartConfig | null, wantsInsights: boolean): Omit<AskResult, "provider"> {
  if (wantsInsights) {
    const ins = ruleInsights(columns, rows);
    return { kind: "insights", message: ins.headline, steps: ["Scanned every column", `Read ${rows.length.toLocaleString()} rows`], insights: ins.insights, followUps: defaultFollowUps(columns, rows) };
  }
  const r = buildChartFromPrompt(columns, rows, prompt, last?.palette ?? palette, last);
  const filters = parseFilters(prompt, columns, rows);
  const config: ChartConfig = { ...r.config, filters: filters.length ? filters : r.followUp ? r.config.filters : undefined };
  const steps = describeSteps(config, columns, rows);
  const facts = describeFacts(config, rows, columns);
  const isQuestion = /^(what|which|how much|how many|who)\b/i.test(prompt.trim()) && !/\b(chart|graph|plot|show)\b/i.test(prompt);
  const chart = { title: r.title, subtitle: r.subtitle, config };
  if (isQuestion && (config.type === "kpi" || config.type === "bar" || config.type === "column")) {
    const answer = computeAnswer(config, rows, columns);
    return { kind: "answer", message: answer.detail || r.explanation, steps, chart, answer, facts, followUps: refineFollowUps(config) };
  }
  return { kind: "chart", message: r.explanation, steps, chart, facts, followUps: refineFollowUps(config) };
}

// ---- validation / repair ---------------------------------------------------

function normalizeFilters(raw: Partial<Filter>[] | undefined, columns: Column[], rows: Row[]): Filter[] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  const names = new Map(columns.map((c) => [c.name.toLowerCase(), c.name]));
  const out: Filter[] = [];
  for (const f of raw) {
    if (!f || typeof f.column !== "string") continue;
    const col = names.get(f.column.toLowerCase());
    if (!col) continue;
    const op = (["eq", "neq", "in", "gt", "gte", "lt", "lte", "contains"] as const).includes(f.op as Filter["op"]) ? (f.op as Filter["op"]) : "eq";
    let value = f.value as Filter["value"];
    if (value === undefined || value === null) continue;
    // Snap text values to the real casing in the data.
    if (typeof value === "string" || Array.isArray(value)) {
      const distinct = new Map(rows.map((r) => [String(r[col] ?? "").toLowerCase(), String(r[col] ?? "")]));
      const snap = (v: string) => distinct.get(v.toLowerCase()) ?? v;
      value = Array.isArray(value) ? value.map((v) => snap(String(v))) : snap(value);
    }
    out.push({ column: col, op: Array.isArray(value) ? "in" : op, value });
  }
  return out.length ? out : undefined;
}

export function repairConfig(cfg: ChartConfig, columns: Column[], rows: Row[]): ChartConfig | null {
  const names = new Map(columns.map((c) => [c.name.toLowerCase(), c.name]));
  const fix = (k: string) => names.get(k.toLowerCase()) ?? names.get(k.toLowerCase().replace(/_/g, " ")) ?? null;
  const out: ChartConfig = { ...cfg };
  if (out.xKey) {
    const x = fix(out.xKey);
    if (!x) return null;
    out.xKey = x;
  }
  out.yKeys = out.yKeys.map(fix).filter((k): k is string => Boolean(k));
  const numeric = new Set(columns.filter((c) => c.type === "number").map((c) => c.name));
  if (out.type !== "table") out.yKeys = out.yKeys.filter((k) => numeric.has(k));
  if (out.yKeys.length === 0 && out.aggregate !== "count" && out.type !== "table" && out.type !== "text") {
    if (numeric.size === 0) out.aggregate = "count";
    else return null;
  }
  if (out.type === "scatter" && out.yKeys.length < 2) return null;
  if (["pie", "donut", "kpi"].includes(out.type) && out.yKeys.length > 1) out.yKeys = [out.yKeys[0]];
  if (out.type !== "kpi" && out.type !== "table" && out.type !== "text" && !out.xKey) return null;
  if (out.xKey && out.type !== "table" && out.type !== "scatter") {
    const col = columns.find((c) => c.name === out.xKey)!;
    if (isIdLike(rows, col)) {
      const alt = groupableColumns(columns, rows)[0];
      if (!alt) return null;
      out.xKey = alt.name;
    }
  }
  if (["pie", "donut"].includes(out.type) && out.xKey && distinctCount(rows, out.xKey) > 12 && !out.limit) {
    out.limit = 8;
    out.sort = "desc";
  }
  return out;
}

// ---- explanations ------------------------------------------------------------

/** Deterministic "how I built this" steps – never hallucinated. */
export function describeSteps(config: ChartConfig, columns: Column[], rows: Row[]): string[] {
  const steps: string[] = [];
  const ent = entityWord(columns, rows).plural;
  const filtered = applyFilters(rows, config.filters);
  for (const f of config.filters ?? []) {
    const val = Array.isArray(f.value) ? f.value.join(", ") : String(f.value);
    const opWord = { eq: "is", neq: "is not", in: "is one of", gt: ">", gte: "≥", lt: "<", lte: "≤", contains: "contains" }[f.op];
    steps.push(`Kept rows where ${f.column} ${opWord} ${val} (${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} rows)`);
  }
  if (config.type === "table") {
    steps.push(`Listed ${config.yKeys.length + 1} columns`);
    return steps;
  }
  const xCol = columns.find((c) => c.name === config.xKey);
  const isDate = xCol?.type === "date";
  if (config.type === "kpi") {
    steps.push(config.yKeys.length ? `Took the ${aggName(config.aggregate)} of ${config.yKeys[0]} across all ${ent}` : `Counted all ${ent}`);
    return steps;
  }
  if (config.type === "scatter") {
    steps.push(`Plotted ${config.yKeys[0]} against ${config.yKeys[1]} – one point per ${config.xKey || "row"}`);
    return steps;
  }
  if (config.xKey) {
    const groups = new Set(filtered.map((r) => String(r[config.xKey] ?? ""))).size;
    if (isDate) {
      const b = config.timeBucket && config.timeBucket !== "auto" && config.timeBucket !== "none" ? config.timeBucket : "period";
      steps.push(`Grouped by ${config.xKey}${b !== "period" ? ` (by ${b})` : ""}`);
    } else steps.push(`Grouped by ${config.xKey} (${groups} values)`);
  }
  if (config.yKeys.length) steps.push(`Took the ${aggName(config.aggregate)} of ${config.yKeys.join(" and ")}`);
  else steps.push(`Counted ${ent} in each group`);
  if (config.sort === "desc" || config.sort === "asc") steps.push(`Sorted ${config.sort === "desc" ? "largest first" : "smallest first"}`);
  if (config.limit) steps.push(`Kept the ${config.sort === "asc" ? "bottom" : "top"} ${config.limit}`);
  return steps;
}

function aggName(a: ChartConfig["aggregate"]) {
  return a === "avg" ? "average" : a === "count" ? "count" : a === "max" ? "maximum" : a === "min" ? "minimum" : a === "none" ? "value" : "sum";
}

/** A one-line factual summary of the plotted data. */
export function describeFacts(config: ChartConfig, rows: Row[], columns: Column[]): string {
  try {
    if (config.type === "table" || config.type === "text") return "";
    const keys = effectiveKeys(config);
    const key = keys[0];
    if (!key) return "";
    if (config.type === "kpi") {
      const v = kpiValue(rows, config.yKeys[0], config.aggregate === "none" ? "sum" : config.aggregate, config.filters);
      return `${formatNumber(v)} across ${applyFilters(rows, config.filters).length.toLocaleString()} rows`;
    }
    const pts = buildSeries(rows, config, columns);
    if (!pts.length) return "";
    const sorted = [...pts].sort((a, b) => Number(b[key]) - Number(a[key]));
    const total = pts.reduce((a, p) => a + Number(p[key]), 0);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    const share = total ? Math.round((Number(top[key]) / total) * 100) : 0;
    if (config.type === "line" || config.type === "area") {
      const first = Number(pts[0][key]);
      const lastV = Number(pts[pts.length - 1][key]);
      const change = first ? Math.round(((lastV - first) / Math.abs(first)) * 100) : 0;
      return `${change >= 0 ? "Up" : "Down"} ${Math.abs(change)}% from ${pts[0].label} to ${pts[pts.length - 1].label}; peak ${top.label} (${formatNumber(Number(top[key]))})`;
    }
    if (config.type === "scatter") return `${pts.length} points`;
    return `${top.label} leads with ${formatNumber(Number(top[key]))} (${share}% of total); ${bottom.label} is lowest at ${formatNumber(Number(bottom[key]))}`;
  } catch {
    return "";
  }
}

export function computeAnswer(config: ChartConfig, rows: Row[], columns: Column[]): { label: string; value: string; detail?: string } {
  const keys = effectiveKeys(config);
  const key = keys[0];
  const measure = config.yKeys[0];
  const ent = entityWord(columns, rows).plural;
  if (config.type === "kpi" || !config.xKey) {
    const v = kpiValue(rows, measure, config.aggregate === "none" ? "sum" : config.aggregate, config.filters);
    const label = measure ? `${aggName(config.aggregate)} of ${measure}` : `Total ${ent}`;
    return { label, value: formatNumber(v, config.numberFormat), detail: `The ${label} is ${formatNumber(v, config.numberFormat)}.` };
  }
  const pts = buildSeries(rows, config, columns);
  if (!pts.length || !key) return { label: "Result", value: "–" };
  const sorted = [...pts].sort((a, b) => Number(b[key]) - Number(a[key]));
  const top = config.sort === "asc" ? sorted[sorted.length - 1] : sorted[0];
  const label = measure ? `${config.sort === "asc" ? "Lowest" : "Highest"} ${aggName(config.aggregate)} of ${measure} by ${config.xKey}` : `${config.sort === "asc" ? "Fewest" : "Most"} ${ent} by ${config.xKey}`;
  const unit = measure ? "" : ` ${ent}`;
  return { label, value: `${top.label}`, detail: `${top.label} is ${config.sort === "asc" ? "lowest" : "highest"} with ${formatNumber(Number(top[key]), config.numberFormat)}${unit}.` };
}

function refineFollowUps(config: ChartConfig): string[] {
  const out: string[] = [];
  if (config.type !== "bar" && config.type !== "kpi" && config.type !== "table") out.push("Make it a bar chart");
  if (config.type !== "donut" && config.type !== "kpi" && config.type !== "line" && config.type !== "area") out.push("Show it as a donut");
  if (!config.limit && config.type !== "kpi") out.push("Only the top 5");
  if (config.type === "line" || config.type === "area") out.push("Group by month");
  if (!config.showLabels && config.type !== "kpi") out.push("Add value labels");
  return out.slice(0, 3);
}

function defaultFollowUps(columns: Column[], rows: Row[]): string[] {
  const numeric = rankMeasures(columns).map((c) => c.name);
  const cats = groupableColumns(columns, rows).map((c) => c.name);
  const dates = columns.filter((c) => c.type === "date").map((c) => c.name);
  const ent = entityWord(columns, rows);
  const m0 = numeric[0];
  const measure = m0 ? (measureAggregate(m0) === "sum" ? m0 : `Average ${m0.toLowerCase()}`) : "";
  const out: string[] = [];
  if (m0 && cats[0]) out.push(`${measure} by ${cats[0]}`);
  if (m0 && dates[0]) out.push(`${measure} over time`);
  if (!m0 && cats[0]) out.push(`How many ${ent.plural} per ${cats[0]}?`);
  if (cats[1]) out.push(`Top 5 ${cats[1]}`);
  return out.slice(0, 3);
}

// ---- rules-only helpers ------------------------------------------------------

/** "for Electronics", "in Europe", "only Card", "where status is Returned", "over 500" */
export function parseFilters(prompt: string, columns: Column[], rows: Row[]): Filter[] {
  const p = prompt.toLowerCase();
  const out: Filter[] = [];
  const cats = columns.filter((c) => c.type !== "number" && c.type !== "date" && !isIdLike(rows, c));
  const used = new Set<string>();
  for (const c of cats) {
    const values = [...new Set(rows.map((r) => String(r[c.name] ?? "")).filter(Boolean))];
    if (values.length > 60) continue;
    const hits = values.filter((v) => v.length >= 3 && new RegExp(`(^|[^a-z0-9])${escapeRe(v.toLowerCase())}([^a-z0-9]|$)`).test(p));
    // Avoid treating the column name itself or a grouping intent as a filter ("revenue by region")
    const filtered = hits.filter((v) => !new RegExp(`\\bby\\s+${escapeRe(v.toLowerCase())}`).test(p));
    if (filtered.length && !used.has(c.name)) {
      used.add(c.name);
      out.push(filtered.length === 1 ? { column: c.name, op: "eq", value: filtered[0] } : { column: c.name, op: "in", value: filtered });
    }
  }
  // numeric thresholds: "revenue over 500", "units above 3", "below 100"
  const m = p.match(/\b([a-z %]+?)\s+(over|above|greater than|more than|below|under|less than|at least|at most)\s+(\d+(?:\.\d+)?)/);
  if (m) {
    const col = columns.find((c) => c.type === "number" && m[1].trim().endsWith(c.name.toLowerCase().replace(/[^a-z0-9 %]/g, "").trim()));
    if (col) {
      const op: Filter["op"] = /over|above|greater|more/.test(m[2]) ? "gt" : /at least/.test(m[2]) ? "gte" : /at most/.test(m[2]) ? "lte" : "lt";
      out.push({ column: col.name, op, value: Number(m[3]) });
    }
  }
  return out;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function ruleInsights(columns: Column[], rows: Row[]): { headline: string; insights: string[] } {
  const insights: string[] = [];
  const numeric = rankMeasures(columns);
  const cats = groupableColumns(columns, rows);
  const dates = columns.filter((c) => c.type === "date");
  for (const col of numeric.slice(0, 3)) {
    const vals = rows.map((r) => r[col.name]).filter((v): v is number => typeof v === "number");
    if (!vals.length) continue;
    const sum = vals.reduce((a, b) => a + b, 0);
    const additive = measureAggregate(col) === "sum";
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    insights.push(
      additive
        ? `${col.name} adds up to ${formatNumber(sum)} across ${vals.length.toLocaleString()} rows — about ${formatNumber(sum / vals.length)} per row.`
        : `${col.name} averages ${formatNumber(sum / vals.length)} across ${vals.length.toLocaleString()} rows, ranging from ${formatNumber(min)} to ${formatNumber(max)}.`
    );
    if (cats[0]) {
      const groups = new Map<string, { sum: number; n: number }>();
      rows.forEach((r) => {
        const k = String(r[cats[0].name] ?? "");
        const v = typeof r[col.name] === "number" ? (r[col.name] as number) : null;
        const g = groups.get(k) ?? { sum: 0, n: 0 };
        if (v !== null) {
          g.sum += v;
          g.n += 1;
        }
        groups.set(k, g);
      });
      const ranked = [...groups.entries()].map(([k, g]) => [k, additive ? g.sum : g.n ? g.sum / g.n : 0] as const).sort((a, b) => b[1] - a[1]);
      if (ranked.length > 1) {
        const lastR = ranked[ranked.length - 1];
        insights.push(
          additive
            ? `${ranked[0][0]} leads ${col.name} with ${formatNumber(ranked[0][1])} (${Math.round((ranked[0][1] / (sum || 1)) * 100)}%); ${lastR[0]} is last with ${formatNumber(lastR[1])}.`
            : `${ranked[0][0]} has the highest average ${col.name.toLowerCase()} at ${formatNumber(ranked[0][1])}; ${lastR[0]} the lowest at ${formatNumber(lastR[1])}.`
        );
      }
    }
    if (dates[0]) {
      const cfg: ChartConfig = { ...DEFAULT_CONFIG, type: "line", xKey: dates[0].name, yKeys: [col.name], aggregate: additive ? "sum" : "avg" };
      const pts = buildSeries(rows, cfg, columns);
      if (pts.length >= 3) {
        const first = Number(pts[0][col.name]);
        const last = Number(pts[pts.length - 1][col.name]);
        if (first) insights.push(`Over time, ${col.name} ${last >= first ? "grew" : "fell"} ${Math.abs(Math.round(((last - first) / Math.abs(first)) * 100))}% from ${pts[0].label} to ${pts[pts.length - 1].label}.`);
      }
    }
  }
  for (const col of cats.slice(0, 2)) {
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(String(r[col.name] ?? ""), (counts.get(String(r[col.name] ?? "")) ?? 0) + 1));
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length > 1) insights.push(`${col.name} has ${counts.size} values; "${ranked[0][0]}" is most common with ${ranked[0][1].toLocaleString()} rows (${Math.round((ranked[0][1] / rows.length) * 100)}%).`);
  }
  const headline = numeric.length
    ? `${rows.length.toLocaleString()} rows with ${numeric.length} numeric measure${numeric.length > 1 ? "s" : ""} and ${cats.length} categor${cats.length === 1 ? "y" : "ies"} to slice by.`
    : `${rows.length.toLocaleString()} rows of mostly text data — count rows by ${cats.map((c) => c.name).join(", ") || "a column"} to see the distribution.`;
  return { headline, insights: insights.slice(0, 6) };
}

export { isFollowUp };
