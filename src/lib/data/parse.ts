import Papa from "papaparse";
import type { Column, ColumnType, Row } from "@/lib/charts/types";
import { parseDateValue } from "@/lib/data/dates";

export const MAX_ROWS = 5000;

export interface ParsedTable {
  columns: Column[];
  rows: Row[];
  truncated: boolean;
}

/** Turn a 2D array of cells (first row = header) into typed rows. */
export function tableFromMatrix(matrix: unknown[][]): ParsedTable {
  const cleaned = matrix.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));
  if (cleaned.length === 0) return { columns: [], rows: [], truncated: false };

  const headerRaw = cleaned[0].map((h, i) => {
    const s = String(h ?? "").trim();
    return s || `Column ${i + 1}`;
  });
  const header = dedupe(headerRaw);
  const body = cleaned.slice(1);
  const truncated = body.length > MAX_ROWS;
  const limited = body.slice(0, MAX_ROWS);

  const columns: Column[] = header.map((name, i) => ({
    name,
    type: inferType(limited.map((r) => r[i])),
  }));

  const rows: Row[] = limited.map((r) => {
    const obj: Row = {};
    columns.forEach((col, i) => {
      obj[col.name] = coerce(r[i], col.type);
    });
    return obj;
  });

  return { columns, rows, truncated };
}

export function parseDelimitedText(text: string): ParsedTable {
  const trimmed = text.trim();
  if (!trimmed) return { columns: [], rows: [], truncated: false };
  const result = Papa.parse<string[]>(trimmed, {
    skipEmptyLines: true,
    delimiter: "", // auto-detect (comma, tab, semicolon, pipe)
  });
  return tableFromMatrix(result.data as unknown[][]);
}

export async function parseFile(file: File): Promise<ParsedTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
    return tableFromMatrix(matrix);
  }
  const text = await file.text();
  return parseDelimitedText(text);
}

function dedupe(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = seen.get(n) ?? 0;
    seen.set(n, count + 1);
    return count === 0 ? n : `${n} (${count + 1})`;
  });
}

const NUM_RE = /^-?\s*[$€£₹]?\s*-?\d[\d,]*(\.\d+)?\s*%?$/;
const DATE_RE =
  /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]{3,9}\s+\d{4}|\d{4}(-\d{2})?|Q[1-4]\s?\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})$/;

export function inferType(values: unknown[]): ColumnType {
  const sample = values.map((v) => String(v ?? "").trim()).filter((v) => v !== "");
  if (sample.length === 0) return "string";
  const isBool = sample.every((v) => /^(true|false|yes|no)$/i.test(v));
  if (isBool) return "boolean";
  const numCount = sample.filter((v) => NUM_RE.test(v)).length;
  if (numCount / sample.length >= 0.9) {
    // Years like "2021" are numbers but read better as labels when every value is a 4-digit year.
    const allYears = sample.every((v) => /^(19|20)\d{2}$/.test(v));
    if (allYears) return "date";
    return "number";
  }
  const dateCount = sample.filter((v) => /\d/.test(v) && (DATE_RE.test(v) || parseDateValue(v) !== null)).length;
  if (dateCount / sample.length >= 0.9) return "date";
  return "string";
}

export function coerce(value: unknown, type: ColumnType): string | number | boolean | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  if (type === "number") {
    const n = Number(s.replace(/[$€£₹,%\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (type === "boolean") return /^(true|yes)$/i.test(s);
  return s;
}

/** Recompute column types after manual edits. */
export function retype(columns: Column[], rows: Row[]): Column[] {
  return columns.map((c) => ({ ...c, type: inferType(rows.map((r) => r[c.name])) }));
}
