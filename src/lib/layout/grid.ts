/**
 * Dashboard grid layout engine (framework-free, unit-testable).
 *
 * 12 columns, fixed row height. Every widget has {x, y, w, h} in grid units.
 * Moving or resizing a widget pushes others out of the way, then everything
 * "falls up" (vertical compaction) so there are never gaps.
 */

export const COLS = 12;
export const ROW_H = 24; // px per row unit
export const GAP = 16; // px between cells

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface LayoutItem extends Box {
  i: string;
}

export const MIN_W = 2;
export const MIN_H = 3;
export const MAX_H = 40;

/** Pixel size of h rows / w columns. */
export const rowsToPx = (h: number) => h * ROW_H + (h - 1) * GAP;
export const colsToPx = (w: number, colW: number) => w * colW + (w - 1) * GAP;

/** Smallest size a widget can be resized to before its content stops being readable. */
export function minBox(type: string): { w: number; h: number } {
  switch (type) {
    case "kpi":
      return { w: 2, h: 5 };
    case "text":
      return { w: 2, h: 3 };
    case "table":
      return { w: 3, h: 6 };
    case "pie":
    case "donut":
      return { w: 3, h: 8 };
    default:
      return { w: 3, h: 7 };
  }
}

/** Default footprint for a new widget by chart type and legacy size. */
export function defaultBox(type: string, size?: string): { w: number; h: number } {
  if (type === "kpi") return { w: 4, h: 6 };
  if (type === "text") return { w: 12, h: 4 };
  if (type === "table") return { w: 12, h: 11 };
  switch (size) {
    case "sm":
      return { w: 4, h: 10 };
    case "wide":
      return { w: 8, h: 11 };
    case "full":
      return { w: 12, h: 12 };
    default:
      return { w: 6, h: 10 };
  }
}

export const collides = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function clampBox(b: Box): Box {
  const w = Math.max(MIN_W, Math.min(COLS, Math.round(b.w)));
  const h = Math.max(MIN_H, Math.min(MAX_H, Math.round(b.h)));
  const x = Math.max(0, Math.min(COLS - w, Math.round(b.x)));
  const y = Math.max(0, Math.round(b.y));
  return { x, y, w, h };
}

/** Lowest y ≥ 0 where the box fits without touching any placed box. */
function fallY(box: Box, placed: Box[]): number {
  let y = 0;
  for (;;) {
    const hit = placed.find((p) => collides({ ...box, y }, p));
    if (!hit) return y;
    y = hit.y + hit.h;
  }
}

/** First free slot scanning top-to-bottom, left-to-right (used for new widgets). */
export function firstFit(w: number, h: number, placed: Box[]): { x: number; y: number } {
  const maxY = placed.reduce((m, p) => Math.max(m, p.y + p.h), 0);
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x + w <= COLS; x++) {
      if (!placed.some((p) => collides({ x, y, w, h }, p))) return { x, y };
    }
  }
  return { x: 0, y: maxY };
}

/** Vertical compaction: every item falls up as far as it can, in reading order. */
export function compact(items: LayoutItem[]): LayoutItem[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: LayoutItem[] = [];
  for (const it of sorted) placed.push({ ...it, y: fallY(it, placed) });
  return placed;
}

/**
 * Place `activeId` at `target` and re-flow everything else around it.
 * Items the active widget overlaps go below it once it passes their upper
 * half, otherwise they stay above – which feels like "swapping".
 */
export function moveItem(items: LayoutItem[], activeId: string, target: Box): LayoutItem[] {
  const t = clampBox(target);
  const active = { i: activeId, ...t };
  const others = items.filter((it) => it.i !== activeId);
  const key = (it: LayoutItem) => {
    if (!collides(it, t)) return it.y;
    return t.y <= it.y + it.h / 2 ? t.y + 0.5 : it.y;
  };
  const ordered = [...others.map((it) => ({ it, k: key(it) })), { it: active, k: t.y }].sort((a, b) => a.k - b.k || (a.it.i === activeId ? -1 : b.it.i === activeId ? 1 : a.it.x - b.it.x));
  const placed: LayoutItem[] = [];
  for (const { it } of ordered) placed.push({ ...it, y: fallY(it, placed) });
  return placed;
}

/** Resize is a move that keeps x/y and changes w/h. */
export function resizeItem(items: LayoutItem[], activeId: string, w: number, h: number): LayoutItem[] {
  const cur = items.find((it) => it.i === activeId);
  if (!cur) return items;
  return moveItem(items, activeId, { x: cur.x, y: cur.y, w: Math.min(w, COLS - cur.x), h });
}

/**
 * Build a full layout from stored boxes. Items without a stored box (older
 * reports, new widgets) are dropped into the first free slot in order.
 */
export function buildLayout(entries: { i: string; box?: Box | null; type: string; size?: string }[]): LayoutItem[] {
  const placed: LayoutItem[] = [];
  const withBox = entries.filter((e) => e.box && Number.isFinite(e.box.x));
  const without = entries.filter((e) => !(e.box && Number.isFinite(e.box.x)));
  for (const e of withBox) {
    const b = clampBox(e.box as Box);
    const m = minBox(e.type);
    const w = Math.max(b.w, m.w);
    placed.push({ i: e.i, x: Math.min(b.x, COLS - w), y: b.y, w, h: Math.max(b.h, m.h) });
  }
  let out = compact(placed);
  for (const e of without) {
    const { w, h } = defaultBox(e.type, e.size);
    const pos = firstFit(w, h, out);
    out = [...out, { i: e.i, x: pos.x, y: pos.y, w, h }];
  }
  return compact(out);
}

export const layoutHeight = (items: Box[]) => items.reduce((m, it) => Math.max(m, it.y + it.h), 0);

export function sameLayout(a: LayoutItem[], b: LayoutItem[]): boolean {
  if (a.length !== b.length) return false;
  const m = new Map(b.map((x) => [x.i, x]));
  return a.every((x) => {
    const y = m.get(x.i);
    return y && y.x === x.x && y.y === x.y && y.w === x.w && y.h === x.h;
  });
}
