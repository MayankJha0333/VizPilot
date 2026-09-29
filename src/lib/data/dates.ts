import type { TimeBucket } from "@/lib/charts/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_IDX: Record<string, number> = {};
MONTHS.forEach((m, i) => {
  MONTH_IDX[m.toLowerCase()] = i;
});
const LONG = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
LONG.forEach((m, i) => (MONTH_IDX[m] = i));

/** Parse the date-ish strings we see in spreadsheets. Returns null if unsure. */
export function parseDateValue(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    if (v >= 1900 && v <= 2100 && Number.isInteger(v)) return new Date(Date.UTC(v, 0, 1));
    return null;
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m: RegExpMatchArray | null;
  // 2025-01-15 / 2025/01/15 / 2025-01
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/))) return new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1));
  // 15/01/2025 or 01/15/2025 (assume d/m/y when first > 12)
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) {
    const a = +m[1];
    const b = +m[2];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const [d, mo] = a > 12 ? [a, b] : b > 12 ? [b, a] : [b, a]; // default m/d/y
    return new Date(Date.UTC(y, mo - 1, d));
  }
  // Jan 2025 / January 2025 / Jan 5, 2025 / 5 Jan 2025
  if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/)) && MONTH_IDX[m[1].toLowerCase()] !== undefined) return new Date(Date.UTC(+m[2], MONTH_IDX[m[1].toLowerCase()], 1));
  if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/)) && MONTH_IDX[m[1].toLowerCase()] !== undefined) return new Date(Date.UTC(+m[3], MONTH_IDX[m[1].toLowerCase()], +m[2]));
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/)) && MONTH_IDX[m[2].toLowerCase()] !== undefined) return new Date(Date.UTC(+m[3], MONTH_IDX[m[2].toLowerCase()], +m[1]));
  // Q1 2025 / 2025 Q1
  if ((m = s.match(/^Q([1-4])\s*(\d{4})$/i))) return new Date(Date.UTC(+m[2], (+m[1] - 1) * 3, 1));
  if ((m = s.match(/^(\d{4})\s*Q([1-4])$/i))) return new Date(Date.UTC(+m[1], (+m[2] - 1) * 3, 1));
  // 2025
  if ((m = s.match(/^(19|20)\d{2}$/))) return new Date(Date.UTC(+s, 0, 1));
  // Last resort: only trust Date.parse for strings that look like real dates
  // (a 4-digit year plus a separator or month name) – V8 accepts junk like "Pre GIF 1".
  if (/\d{4}/.test(s) && (/[-/,:]/.test(s) || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s))) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : new Date(t);
  }
  return null;
}

export interface Bucketed {
  key: string; // sortable
  label: string; // display
}

export function bucketDate(d: Date, bucket: Exclude<TimeBucket, "auto" | "none">): Bucketed {
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  switch (bucket) {
    case "year":
      return { key: `${y}`, label: `${y}` };
    case "quarter": {
      const q = Math.floor(mo / 3) + 1;
      return { key: `${y}-Q${q}`, label: `Q${q} ${y}` };
    }
    case "month":
      return { key: `${y}-${String(mo + 1).padStart(2, "0")}`, label: `${MONTHS[mo]} ${y}` };
    case "week": {
      const start = new Date(Date.UTC(y, mo, day));
      const dow = (start.getUTCDay() + 6) % 7; // Monday = 0
      start.setUTCDate(start.getUTCDate() - dow);
      const k = start.toISOString().slice(0, 10);
      return { key: k, label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}` };
    }
    case "day":
    default:
      return { key: d.toISOString().slice(0, 10), label: `${MONTHS[mo]} ${day}${y !== new Date().getUTCFullYear() ? ` ${String(y).slice(2)}` : ""}` };
  }
}

/** Choose a bucket for "auto" given how many distinct dates there are and the span. */
export function autoBucket(dates: Date[]): Exclude<TimeBucket, "auto"> {
  if (dates.length < 2) return "none";
  const min = Math.min(...dates.map((d) => d.getTime()));
  const max = Math.max(...dates.map((d) => d.getTime()));
  const days = (max - min) / 86400000;
  const distinct = new Set(dates.map((d) => d.toISOString().slice(0, 10))).size;
  if (distinct <= 31) return "none";
  if (days > 365 * 3) return "quarter";
  if (days > 120) return "month";
  if (days > 40) return "week";
  return "none";
}

/**
 * How much of the period containing `d` has elapsed (0–1), measured to the
 * end of that day. Used to avoid comparing a partial period to a full one.
 */
export function periodCoverage(d: Date, bucket: Exclude<TimeBucket, "auto" | "none">): number {
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  const DAY = 86400000;
  let start: number;
  let end: number;
  switch (bucket) {
    case "year":
      start = Date.UTC(y, 0, 1);
      end = Date.UTC(y + 1, 0, 1);
      break;
    case "quarter": {
      const q0 = Math.floor(mo / 3) * 3;
      start = Date.UTC(y, q0, 1);
      end = Date.UTC(y, q0 + 3, 1);
      break;
    }
    case "month":
      start = Date.UTC(y, mo, 1);
      end = Date.UTC(y, mo + 1, 1);
      break;
    case "week": {
      const dow = (new Date(Date.UTC(y, mo, day)).getUTCDay() + 6) % 7;
      start = Date.UTC(y, mo, day - dow);
      end = start + 7 * DAY;
      break;
    }
    default:
      return 1;
  }
  return Math.min(1, (Date.UTC(y, mo, day) + DAY - start) / (end - start));
}
