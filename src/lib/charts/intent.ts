import { DEFAULT_CONFIG, type ChartConfig, type ChartType, type Column, type Row } from "@/lib/charts/types";
import { entityWord, groupableColumns, isIdLike, measureAggregate, rankMeasures, suggestCharts } from "@/lib/charts/suggest";
import { distinctCount } from "@/lib/data/transform";

/**
 * Rule-based natural-language → chart. Used as the fallback when no AI
 * provider is configured, and to validate/repair AI output. Understands
 * "revenue by region", "top 5 …", "how many orders per channel", "as a donut",
 * and follow-ups like "make it a bar" / "show top 3" applied to the last chart.
 */

export interface ChartIntentResult {
  title: string;
  subtitle: string;
  explanation: string;
  config: ChartConfig;
  followUp: boolean;
}

const TYPE_WORDS: [RegExp, ChartType][] = [
  [/\b(line|trend|over time|timeline|growth)\b/, "line"],
  [/\barea\b/, "area"],
  [/\bpie\b/, "pie"],
  [/\b(donut|doughnut|share|split|proportion|percentage|breakdown|distribution)\b/, "donut"],
  [/\b(scatter|correlat|relationship|against|vs\.?|versus)\b/, "scatter"],
  [/\bstack/, "stackedColumn"],
  [/\b(kpi|total|headline|big number|single number|how much in total|sum of)\b/, "kpi"],
  [/\b(table|raw|list the rows|show rows)\b/, "table"],
  [/\b(bar|bars|horizontal|ranking|rank|leaderboard)\b/, "bar"],
  [/\b(column|columns|vertical)\b/, "column"],
];

function findColumns(prompt: string, columns: Column[]): Column[] {
  const p = prompt.toLowerCase();
  const pos = (c: Column) => {
    const name = c.name.toLowerCase();
    const alt = name.replace(/[_-]/g, " ");
    if (p.includes(name)) return p.indexOf(name);
    if (p.includes(alt)) return p.indexOf(alt);
    // Word-level match: "discount" ↔ "Discount %", "order date" ↔ "Order date", "channels" ↔ "Channel"
    const words = alt.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !["the", "and", "per", "avg", "total"].includes(w));
    if (!words.length) return -1;
    const hits = words.map((w) => {
      const stem = w.replace(/(ies|es|s)$/, (m) => (m === "ies" ? "y" : ""));
      const re = new RegExp(`\\b${escape(stem)}(s|es|ies)?\\b`);
      const m = re.exec(p);
      return m ? m.index : -1;
    });
    const matched = hits.filter((h) => h >= 0).length;
    if (matched === words.length) return Math.min(...hits.filter((h) => h >= 0));
    return -1;
  };
  return columns
    .map((c) => ({ c, i: pos(c) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.c);
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Is this prompt only tweaking the previous chart (no new columns mentioned)? */
export function isFollowUp(prompt: string, columns: Column[], last?: ChartConfig | null): boolean {
  if (!last) return false;
  const mentioned = findColumns(prompt, columns);
  const p = prompt.toLowerCase();
  const modifier = /\b(make it|change|switch|instead|same but|as a|turn it|convert|show (only )?top|limit|sort|order|palette|colou?r|bigger|label|legend|grid|title|rename|call it|only|just|without|remove|hide|stack|smooth|daily|weekly|monthly|quarterly|yearly|by (day|week|month|quarter|year)|show it)\b/.test(p);
  return modifier && mentioned.length === 0;
}

export function buildChartFromPrompt(columns: Column[], rows: Row[], prompt: string, palette: string, last?: ChartConfig | null): ChartIntentResult {
  const p = prompt.toLowerCase().trim();
  const numeric = rankMeasures(columns);
  const dates = columns.filter((c) => c.type === "date");
  const cats = groupableColumns(columns, rows);
  const mentioned = findColumns(prompt, columns);
  const mentionedY = mentioned.filter((c) => c.type === "number");
  const mentionedX = mentioned.filter((c) => c.type !== "number");
  const followUp = isFollowUp(prompt, columns, last);

  // ---- Type ---------------------------------------------------------------
  let type: ChartType | null = null;
  for (const [re, t] of TYPE_WORDS) {
    if (re.test(p)) {
      type = t;
      break;
    }
  }

  // ---- Aggregate ----------------------------------------------------------
  let ent = entityWord(columns, rows);
  if (ent.plural === "rows") {
    // "how many orders per channel" → call the rows "orders"
    const m = p.match(/\b(?:how many|number of|count(?: of)?|share of|distribution of)\s+([a-z]+)\b/);
    const word = m?.[1];
    if (word && !["rows", "the", "each", "all", "values", "items"].includes(word) && !columns.some((c) => c.type !== "date" && c.type !== "number" && c.name.toLowerCase().replace(/s$/, "") === word.replace(/s$/, "")))
      ent = { singular: word.replace(/s$/, ""), plural: word.endsWith("s") ? word : `${word}s` };
  }
  const mentionsEntity = ent.plural !== "rows" && new RegExp(`\\b(${escape(ent.singular)}|${escape(ent.plural)}|rows|records|entries)\\b`).test(p);
  let aggregate: ChartConfig["aggregate"] | null = null;
  if (/\b(avg|average|mean|typical)\b/.test(p)) aggregate = "avg";
  else if ((/\b(count|how many|number of|no\. of|volume|frequency|occurrences|distribution)\b/.test(p) || mentionsEntity) && !mentionedY.length) aggregate = "count";
  else if (/\b(max|maximum|highest|peak|largest|biggest)\b/.test(p) && /\b(per|by|each)\b/.test(p)) aggregate = "max";
  else if (/\b(min|minimum|lowest|smallest)\b/.test(p) && /\b(per|by|each)\b/.test(p)) aggregate = "min";

  const topMatch = p.match(/\b(top|first|best|largest|biggest|highest)\s+(\d+)/) || p.match(/\b(\d+)\s+(top|largest|biggest|highest)\b/);
  const bottomMatch = p.match(/\b(bottom|lowest|smallest|worst)\s+(\d+)/);
  const limit = topMatch ? Number(topMatch[2] ?? topMatch[1]) : bottomMatch ? Number(bottomMatch[2]) : null;
  let sort: ChartConfig["sort"] | null = null;
  if (bottomMatch || /\b(ascending|smallest first|lowest first)\b/.test(p)) sort = "asc";
  else if (topMatch || /\b(rank|sorted|descending|largest first|highest first|biggest)\b/.test(p)) sort = "desc";
  else if (/\b(alphabetical|a to z|a-z)\b/.test(p)) sort = "label";

  // ---- Follow-up: patch the previous config ------------------------------
  if (followUp && last) {
    const config: ChartConfig = { ...last };
    const changes: string[] = [];
    if (type) {
      config.type = type;
      changes.push(`changed it to a ${label(type)}`);
      if (["pie", "donut", "kpi"].includes(type) && config.yKeys.length > 1) config.yKeys = [config.yKeys[0]];
      if (type === "scatter" && config.yKeys.length < 2) config.yKeys = numeric.slice(0, 2).map((c) => c.name);
      if (type === "scatter") config.aggregate = "none";
      else if (config.aggregate === "none") config.aggregate = config.yKeys.length ? "sum" : "count";
    }
    if (aggregate && aggregate !== "count") {
      config.aggregate = aggregate;
      changes.push(`used the ${aggregate === "avg" ? "average" : aggregate}`);
    }
    if (limit !== null) {
      config.limit = limit;
      config.sort = sort ?? "desc";
      changes.push(`kept the ${sort === "asc" ? "bottom" : "top"} ${limit}`);
    } else if (sort) {
      config.sort = sort;
      changes.push(`sorted ${sort === "label" ? "alphabetically" : sort === "asc" ? "smallest first" : "largest first"}`);
    }
    if (/\b(remove|without|hide|no)\b.*\blimit\b|\ball of them\b|\bshow all\b/.test(p)) {
      config.limit = 0;
      changes.push("showed all values");
    }
    if (/\b(hide|remove|without)\b.*\blegend\b/.test(p)) config.showLegend = false;
    if (/\b(show|add)\b.*\blegend\b/.test(p)) config.showLegend = true;
    if (/\b(hide|remove|without)\b.*\bgrid\b/.test(p)) config.showGrid = false;
    if (/\b(show|add)\b.*\b(labels|values)\b/.test(p)) {
      config.showLabels = true;
      changes.push("added value labels");
    }
    if (/\b(hide|remove)\b.*\b(labels|values)\b/.test(p)) config.showLabels = false;
    const pal = p.match(/\b(aurora|ocean|sunset|forest|pastel|mono|violet)\b/);
    if (pal) {
      config.palette = pal[1];
      changes.push(`switched to the ${pal[1]} palette`);
    }
    const bucket = p.match(/\b(daily|weekly|monthly|quarterly|yearly|by (day|week|month|quarter|year)|per (day|week|month|quarter|year))\b/);
    if (bucket) {
      const w = bucket[0].replace(/^(by|per)\s+/, "").replace(/ly$/, "").replace("dai", "day");
      const map: Record<string, ChartConfig["timeBucket"]> = { day: "day", week: "week", month: "month", quarter: "quarter", year: "year" };
      config.timeBucket = map[w] ?? "auto";
      changes.push(`grouped it by ${w}`);
    }
    if (/\b(percent|percentage|%)\b/.test(p)) config.numberFormat = "percent";
    if (/\b(currency|dollars|\$|usd)\b/.test(p)) config.numberFormat = "currency";
    const titled = titleFor(config, columns, limit ?? config.limit, ent.plural);
    return {
      title: titled.title,
      subtitle: titled.subtitle,
      explanation: changes.length ? `Done — I ${changes.join(" and ")}.` : "I kept the chart but applied your tweak.",
      config,
      followUp: true,
    };
  }

  // ---- New chart ------------------------------------------------------------
  const wantsCount = aggregate === "count" || (numeric.length === 0 && type !== "table");

  // Pick X: mentioned category → date (for trends) → first groupable → first column
  const xKey =
    mentionedX.find((c) => !isIdLike(rows, c))?.name ??
    (type === "line" || type === "area" || /\bover time|by (month|day|week|year|date)\b/.test(p) ? dates[0]?.name : undefined) ??
    (type === "kpi" ? (dates[0] ?? cats[0])?.name : undefined) ??
    cats[0]?.name ??
    dates[0]?.name ??
    mentionedX[0]?.name ??
    columns.find((c) => !isIdLike(rows, c))?.name ??
    columns[0]?.name ??
    "";

  // Pick Y
  let yKeys: string[];
  if (type === "scatter") {
    yKeys = (mentionedY.length >= 2 ? mentionedY : numeric).slice(0, 2).map((c) => c.name);
  } else if (type === "table") {
    yKeys = (mentioned.length ? mentioned : columns.slice(0, 6)).map((c) => c.name).filter((k) => k !== xKey);
  } else if (wantsCount) {
    yKeys = [];
  } else {
    const single = type === "pie" || type === "donut" || type === "kpi";
    yKeys = (mentionedY.length ? mentionedY : numeric).slice(0, single ? 1 : /\b(and|&|vs|with)\b/.test(p) ? 3 : 1).map((c) => c.name);
  }

  // Sensible default type
  if (!type) {
    if (xKey && dates.some((d) => d.name === xKey)) type = distinctCount(rows, xKey) > 40 ? "area" : "line";
    else if (xKey) type = distinctCount(rows, xKey) > 8 ? "bar" : "column";
    else type = "kpi";
  }
  if (type === "kpi" && !yKeys.length && !wantsCount) yKeys = numeric[0] ? [numeric[0].name] : [];
  if ((type === "pie" || type === "donut") && xKey && distinctCount(rows, xKey) > 12) {
    // too many slices – rank instead
    if (sort === null) sort = "desc";
  }

  if (!xKey && type !== "kpi") {
    const s = suggestCharts(columns, rows, palette)[0];
    return { title: s.title, subtitle: s.subtitle, explanation: s.reason, config: s.config, followUp: false };
  }

  const bucketWord = p.match(/\b(daily|weekly|monthly|quarterly|yearly|by (day|week|month|quarter|year)|per (day|week|month|quarter|year))\b/);
  const bucketMap: Record<string, ChartConfig["timeBucket"]> = { day: "day", week: "week", month: "month", quarter: "quarter", year: "year" };
  const timeBucket = bucketWord ? bucketMap[bucketWord[0].replace(/^(by|per)\s+/, "").replace(/ly$/, "").replace("dai", "day")] ?? "auto" : "auto";
  const config: ChartConfig = {
    ...DEFAULT_CONFIG,
    palette,
    timeBucket,
    type,
    xKey: type === "kpi" && !xKey ? "" : xKey,
    yKeys,
    aggregate: type === "scatter" ? "none" : wantsCount ? "count" : aggregate ?? (yKeys[0] ? measureAggregate(yKeys[0]) : "sum"),
    sort: sort ?? (type === "line" || type === "area" ? "none" : yKeys.length || wantsCount ? "desc" : "none"),
    limit: limit ?? (xKey && distinctCount(rows, xKey) > 15 && type !== "line" && type !== "area" && type !== "table" ? 12 : 0),
  };
  if (["pie", "donut"].includes(config.type) && config.limit === 0 && xKey && distinctCount(rows, xKey) > 8) config.limit = 8;

  const titled = titleFor(config, columns, config.limit, ent.plural);
  const yDesc = config.yKeys.length ? `${aggWord(config.aggregate)}${config.yKeys.join(", ")}` : `the number of ${ent.plural}`;
  return {
    title: titled.title,
    subtitle: titled.subtitle,
    explanation: `I grouped by ${config.xKey || "nothing"} and plotted ${yDesc}${config.limit ? `, keeping the ${config.sort === "asc" ? "bottom" : "top"} ${config.limit}` : ""}.`,
    config,
    followUp: false,
  };
}

export function titleFor(config: ChartConfig, columns: Column[], limit: number, entity = "rows"): { title: string; subtitle: string } {
  const Ent = entity.charAt(0).toUpperCase() + entity.slice(1);
  const y = config.yKeys.length ? config.yKeys.join(" & ") : Ent;
  const aggPrefix = config.yKeys.length ? aggWord(config.aggregate) : "Count of ";
  const pre = limit ? `Top ${limit} ` : "";
  if (config.type === "kpi") return { title: config.yKeys.length ? `${aggPrefix}${y}` : `Total ${entity}`, subtitle: `Across all ${entity}` };
  if (config.type === "scatter") return { title: `${config.yKeys[0]} vs ${config.yKeys[1] ?? ""}`.trim(), subtitle: `Each point is one ${config.xKey || "row"}` };
  if (config.type === "table") return { title: "Data table", subtitle: `${config.yKeys.length + 1} columns` };
  const byCol = columns.find((c) => c.name === config.xKey);
  const isTime = byCol?.type === "date";
  const titleY = config.yKeys.length && config.aggregate !== "sum" && config.aggregate !== "none" ? `${aggPrefix}${y.toLowerCase()}` : y;
  return {
    title: `${pre}${titleY} ${isTime ? "over" : "by"} ${config.xKey}`,
    subtitle: config.yKeys.length ? `${aggPrefix}${y}${isTime ? " per period" : " per " + config.xKey}` : `Number of ${entity}${isTime ? " per period" : " per " + config.xKey}`,
  };
}

function aggWord(a: ChartConfig["aggregate"]) {
  switch (a) {
    case "avg":
      return "Average ";
    case "count":
      return "Count of ";
    case "max":
      return "Max ";
    case "min":
      return "Min ";
    default:
      return "";
  }
}

function label(t: ChartType) {
  return t === "stackedColumn" ? "stacked column chart" : t === "kpi" ? "KPI tile" : `${t} chart`;
}
