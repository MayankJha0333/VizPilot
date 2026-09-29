import { DEFAULT_CONFIG, type ChartConfig, type Column, type Row } from "@/lib/charts/types";
import { distinctCount } from "@/lib/data/transform";

export interface Suggestion {
  title: string;
  subtitle: string;
  config: ChartConfig;
  reason: string;
}

/** Numeric columns ordered by how good they are as a headline measure. */
export function rankMeasures(columns: Column[]): Column[] {
  const score = (c: Column) => {
    const n = c.name.toLowerCase();
    let s = 0;
    if (/(revenue|sales|amount|income|gmv|mrr|arr|profit)/.test(n)) s += 4;
    else if (/(total|value|spend|cost|units|quantity|orders|sessions|users|visitors|customers|count|tickets|clicks|impressions|views|signups)/.test(n)) s += 3;
    if (/(%|percent|rate|ratio|share|avg|average|score|nps|csat|index|per )/.test(n)) s -= 2;
    if (/(id|code|zip|postal|year|phone|number)$/.test(n)) s -= 4;
    if (/discount|tax|fee/.test(n)) s -= 1;
    return s;
  };
  return columns.filter((c) => c.type === "number").sort((a, b) => score(b) - score(a));
}

/**
 * The aggregate that makes sense for a measure. Adding up hours, scores,
 * rates, prices or ages is meaningless – average them instead.
 */
export function measureAggregate(col: Column | string): "sum" | "avg" {
  const n = (typeof col === "string" ? col : col.name).toLowerCase();
  const avgLike = /(%|percent|\brate\b|\bratio\b|\bavg\b|average|\bmean\b|\bscore\b|\bnps\b|\bcsat\b|\brating\b|\bindex\b|\bper\b|\bhours?\b|\bmins?\b|\bminutes?\b|\bdays?\b|duration|time to|latency|\bage\b|\bprice\b|unit cost|temperature|\bweight\b|\bheight\b|\bdistance\b|\bspeed\b)/;
  const sumLike = /(total|\bsum\b|count|number of|revenue|sales|amount)/;
  return avgLike.test(n) && !sumLike.test(n) ? "avg" : "sum";
}

/** Columns that look like IDs / free text: too many distinct values to chart. */
export function isIdLike(rows: Row[], col: Column): boolean {
  if (col.type === "number" || col.type === "date") return false;
  const n = distinctCount(rows, col.name);
  if (/(^|[ _-])(id|token|uuid|key|hash|email|url)$/i.test(col.name) && n > 1) return true;
  if (/(^|[ _-])name$/i.test(col.name) && n > 8) return true;
  return rows.length > 0 && (n > 40 || (rows.length >= 30 && n / rows.length > 0.6));
}

/** "Ticket ID" → "tickets"; used to name count charts ("Tickets by Agent"). */
export function entityWord(columns: Column[], rows: Row[]): { singular: string; plural: string } {
  const idCol = columns.find((c) => /(^|[ _-])(id|token|uuid|key)$/i.test(c.name)) ?? columns.find((c) => isIdLike(rows, c));
  const base = idCol ? idCol.name.replace(/[ _-]?(id|token|uuid|key|hash)$/i, "").trim().toLowerCase() : "";
  if (!base) return { singular: "row", plural: "rows" };
  return { singular: base, plural: pluralize(base) };
}

/** Text/boolean columns that can be grouped nicely (2–40 distinct values). */
export function groupableColumns(columns: Column[], rows: Row[]): Column[] {
  return columns
    .filter((c) => (c.type === "string" || c.type === "boolean") && !isIdLike(rows, c))
    .filter((c) => {
      const n = distinctCount(rows, c.name);
      return n >= 2 && n <= 40;
    })
    .sort((a, b) => catScore(distinctCount(rows, b.name)) - catScore(distinctCount(rows, a.name)));
}

/** Prefer 3–8 categories (readable), then more, then 2. */
function catScore(n: number): number {
  if (n >= 3 && n <= 8) return 3;
  if (n > 8 && n <= 15) return 2;
  if (n === 2) return 1;
  return 0;
}

/**
 * Rule-based chart suggestions. Used to auto-build a first report and as the
 * fallback when no AI provider is configured. Works for numeric datasets and
 * for text-only datasets (count-based charts).
 */
export function suggestCharts(columns: Column[], rows: Row[], palette = "aurora"): Suggestion[] {
  const numeric = rankMeasures(columns);
  const dates = columns.filter((c) => c.type === "date");
  const cats = groupableColumns(columns, rows);
  const out: Suggestion[] = [];
  const base = { ...DEFAULT_CONFIG, palette };
  const n = (name: string) => distinctCount(rows, name);

  // ---- Numeric datasets ----------------------------------------------------
  if (numeric.length) {
    const y = numeric[0].name;
    const yAgg = measureAggregate(numeric[0]);
    const additive = yAgg === "sum";
    const ent = entityWord(columns, rows);
    const hasEntity = ent.plural !== "rows";
    const Ents = capitalize(ent.plural);
    // For record-style data (tickets, orders…) whose headline measure can't be
    // summed (hours, scores), lead with volume (counts) and average the measure.
    const leadWithCount = !additive && hasEntity;
    const avgTitle = (m: string) => `Average ${m.toLowerCase()}`;
    const barType = (k: number): ChartConfig["type"] => (k > 8 ? "bar" : "column");

    if (dates.length) {
      const x = dates[0].name;
      const many = n(x) > 40;
      const type: ChartConfig["type"] = many ? "area" : "line";
      if (leadWithCount) {
        out.push({
          title: `${Ents} over time`,
          subtitle: `Number of ${ent.plural} per period, by ${x}`,
          reason: `${x} looks like a date, so counting ${ent.plural} per period shows the trend.`,
          config: { ...base, type, xKey: x, yKeys: [], aggregate: "count", sort: "none" },
        });
      } else {
        out.push({
          title: `${additive ? y : avgTitle(y)} over time`,
          subtitle: many ? `By ${x}, rolled up by period` : `By ${x}`,
          reason: `${x} looks like a date, so a ${type} chart shows the trend clearly.`,
          config: { ...base, type, xKey: x, yKeys: [y], aggregate: yAgg, sort: "none" },
        });
      }
    }
    if (cats.length) {
      const x = cats[0].name;
      const k = n(x);
      if (leadWithCount) {
        out.push({
          title: `${Ents} by ${x}`,
          subtitle: `Number of ${ent.plural} per ${x}`,
          reason: `Counting ${ent.plural} per ${x} shows where the volume is.`,
          config: { ...base, type: barType(k), xKey: x, yKeys: [], aggregate: "count", sort: "desc", limit: k > 12 ? 12 : 0 },
        });
        if (k <= 8) {
          out.push({
            title: `Share of ${ent.plural}`,
            subtitle: `Split by ${x}`,
            reason: `With only ${k} categories, a donut shows each one's share of all ${ent.plural}.`,
            config: { ...base, type: "donut", xKey: x, yKeys: [], aggregate: "count", sort: "desc" },
          });
        }
        out.push({
          title: `${avgTitle(y)} by ${x}`,
          subtitle: `Mean ${y.toLowerCase()} per ${x}`,
          reason: `${y} can't be added up, so the average per ${x} is the fair comparison.`,
          config: { ...base, type: barType(k), xKey: x, yKeys: [y], aggregate: "avg", sort: "desc", limit: k > 12 ? 12 : 0 },
        });
      } else {
        out.push({
          title: `${additive ? y : avgTitle(y)} by ${x}`,
          subtitle: k > 8 ? "Top values, sorted" : "Compared across categories",
          reason: `${x} has ${k} categories – bars make them easy to compare.`,
          config: { ...base, type: barType(k), xKey: x, yKeys: [y], aggregate: yAgg, sort: "desc", limit: k > 12 ? 12 : 0 },
        });
        if (k <= 8 && additive) {
          out.push({
            title: `Share of ${y}`,
            subtitle: `Split by ${x}`,
            reason: `With only ${k} categories, a donut shows each one's share of the total.`,
            config: { ...base, type: "donut", xKey: x, yKeys: [y], aggregate: "sum", sort: "desc" },
          });
        }
      }
      if (cats.length > 1) {
        const x2 = cats[1].name;
        const y2 = leadWithCount ? y : numeric[1]?.name ?? y;
        const agg2 = leadWithCount ? "avg" : measureAggregate(y2);
        out.push({
          title: `${agg2 === "avg" ? avgTitle(y2) : y2} by ${x2}`,
          subtitle: "Another way to slice it",
          reason: `${x2} is a second category worth comparing.`,
          config: { ...base, type: barType(n(x2)), xKey: x2, yKeys: [y2], aggregate: agg2, sort: "desc", limit: n(x2) > 12 ? 12 : 0 },
        });
      }
    }
    if (hasEntity && !leadWithCount && cats.length) {
      const c = cats[0];
      out.push({
        title: `${Ents} by ${c.name}`,
        subtitle: `Number of ${ent.plural} per ${c.name}`,
        reason: `Counting ${ent.plural} per ${c.name} shows where the volume is.`,
        config: { ...base, type: barType(n(c.name)), xKey: c.name, yKeys: [], aggregate: "count", sort: "desc", limit: n(c.name) > 12 ? 12 : 0 },
      });
    }
    const spread = (c: Column) => distinctCount(rows, c.name) >= Math.min(12, rows.length / 2);
    const scatterPair = numeric.filter(spread).slice(0, 2);
    if (scatterPair.length >= 2 && rows.length >= 6 && rows.length <= 2000) {
      const labelCol = (cats[0] ?? dates[0] ?? columns[0]).name;
      out.push({
        title: `${scatterPair[0].name} vs ${scatterPair[1].name}`,
        subtitle: "Is there a relationship?",
        reason: "Two numeric measures can be compared on a scatter plot.",
        config: { ...base, type: "scatter", xKey: labelCol, yKeys: [scatterPair[0].name, scatterPair[1].name], aggregate: "none", sort: "none", showLegend: false },
      });
    }
    const kpiX = (dates[0] ?? cats[0] ?? columns[0])?.name ?? "";
    if (leadWithCount) {
      out.push({
        title: `Total ${ent.plural}`,
        subtitle: `${rows.length.toLocaleString()} ${ent.plural} in the dataset`,
        reason: "A headline count anchors the report.",
        config: { ...base, type: "kpi", xKey: kpiX, yKeys: [], aggregate: "count" },
      });
    } else {
      out.push({
        title: additive ? `Total ${y}` : avgTitle(y),
        subtitle: "Across all rows",
        reason: "A headline number anchors the report.",
        config: { ...base, type: "kpi", xKey: kpiX, yKeys: [y], aggregate: yAgg },
      });
    }
    return out.slice(0, 6);
  }

  // ---- Text-only datasets: count rows per category ------------------------
  const idCol = columns.find((c) => isIdLike(rows, c));
  const what = idCol ? pluralize(idCol.name.replace(/[ _-]?(id|token|uuid|key)$/i, "").trim() || "rows") : "rows";

  out.push({
    title: `Total ${what}`,
    subtitle: `${rows.length.toLocaleString()} rows in the dataset`,
    reason: "A headline count anchors the report.",
    config: { ...base, type: "kpi", xKey: (dates[0] ?? cats[0])?.name ?? "", yKeys: [], aggregate: "count" },
  });
  cats.slice(0, 3).forEach((c, i) => {
    const k = n(c.name);
    out.push({
      title: `${capitalize(what)} by ${c.name}`,
      subtitle: `How many rows fall into each ${c.name}`,
      reason: `${c.name} has ${k} values – counting rows per value shows the distribution.`,
      config: {
        ...base,
        type: i === 1 && k <= 8 ? "donut" : k > 8 ? "bar" : "column",
        xKey: c.name,
        yKeys: [],
        aggregate: "count",
        sort: "desc",
        limit: k > 12 ? 12 : 0,
      },
    });
  });
  if (dates.length) {
    out.push({
      title: `${capitalize(what)} over time`,
      subtitle: `Rows per ${dates[0].name}`,
      reason: `${dates[0].name} is a date, so counting rows per period shows activity over time.`,
      config: { ...base, type: "area", xKey: dates[0].name, yKeys: [], aggregate: "count", sort: "label" },
    });
  }
  if (out.length <= 1) {
    out.push({
      title: "Data table",
      subtitle: "All rows",
      reason: "No numeric or category columns were found, so a table is the clearest view.",
      config: { ...base, type: "table", xKey: columns[0]?.name ?? "", yKeys: columns.slice(1, 5).map((c) => c.name), aggregate: "none" },
    });
  }
  return out.slice(0, 5);
}

function pluralize(w: string) {
  if (!w) return "rows";
  const lower = w.toLowerCase();
  if (/(s|x|ch|sh)$/.test(lower)) return `${lower}es`;
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  return `${lower}s`;
}
function capitalize(w: string) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}
