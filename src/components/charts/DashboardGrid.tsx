"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { COLS, GAP, ROW_H, colsToPx, layoutHeight, moveItem, resizeItem, rowsToPx, sameLayout, type LayoutItem } from "@/lib/layout/grid";

/**
 * A 12-column dashboard grid where widgets can be dragged anywhere (by their
 * header, `[data-drag-handle]`) and resized from the right edge, bottom edge
 * or corner. Other widgets make room live and everything compacts upward.
 *
 * Performance: the grid owns the drag state, and the widget elements are
 * created by the parent, so a drag only re-renders the grid wrappers – the
 * charts inside keep their identity and don't re-render per mouse move.
 */

type Mode = "move" | "e" | "s" | "se";

interface Drag {
  id: string;
  mode: Mode;
  startX: number;
  startY: number;
  origin: LayoutItem;
  /** Live pixel rect of the active widget (follows the pointer). */
  left: number;
  top: number;
  width: number;
  height: number;
  preview: LayoutItem[];
  /** Grid target of the last computed preview, to skip redundant re-flows. */
  key: string;
  moved: boolean;
}

interface Props {
  layout: LayoutItem[];
  items: { id: string; node: React.ReactNode; className?: string; minW?: number; minH?: number }[];
  editable?: boolean;
  dark?: boolean;
  onLayoutChange?: (next: LayoutItem[]) => void;
  /** Rendered after the last widget (e.g. an "Add widget" tile), full-width row. */
  footer?: React.ReactNode;
}

const MOBILE_BREAKPOINT = 720;

export function DashboardGrid({ layout, items, editable = false, dark = false, onLayoutChange, footer }: Props) {
  // Callback ref: the measured element changes when switching mobile ↔ grid.
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e.contentRect.width > 0 && setWidth(e.contentRect.width));
    ro.observe(el); // ResizeObserver fires once immediately with the current size
    return () => ro.disconnect();
  }, [el]);

  const colW = width > 0 ? (width - GAP * (COLS - 1)) / COLS : 0;
  const stepX = colW + GAP;
  const stepY = ROW_H + GAP;
  const mobile = width > 0 && width < MOBILE_BREAKPOINT;
  const current = drag?.preview ?? layout;
  const byId = useMemo(() => new Map(current.map((l) => [l.i, l])), [current]);

  const rect = useCallback((l: LayoutItem) => ({ left: l.x * stepX, top: l.y * stepY, width: colsToPx(l.w, colW), height: rowsToPx(l.h) }), [stepX, stepY, colW]);

  // ---- pointer handling --------------------------------------------------------
  const onMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 5) return;
      const o = rect(d.origin);
      let next: Drag;
      if (d.mode === "move") {
        const left = o.left + dx;
        const top = o.top + dy;
        const x = Math.max(0, Math.min(COLS - d.origin.w, Math.round(left / stepX)));
        const y = Math.max(0, Math.round(top / stepY));
        const key = `m${x},${y}`;
        const preview = key === d.key ? d.preview : moveItem(layout, d.id, { x, y, w: d.origin.w, h: d.origin.h });
        next = { ...d, left, top, width: o.width, height: o.height, preview, key, moved: true };
      } else {
        const it = items.find((x) => x.id === d.id);
        const wantW = Math.max(it?.minW ?? 2, d.mode === "s" ? d.origin.w : Math.round((o.width + dx + GAP) / stepX));
        const wantH = Math.max(it?.minH ?? 3, d.mode === "e" ? d.origin.h : Math.round((o.height + dy + GAP) / stepY));
        const key = `r${wantW},${wantH}`;
        const preview = key === d.key ? d.preview : resizeItem(layout, d.id, wantW, wantH);
        const snapped = preview.find((p) => p.i === d.id)!;
        const r = rect(snapped);
        next = { ...d, left: r.left, top: r.top, width: r.width, height: r.height, preview, key, moved: true };
      }
      // Auto-scroll near the viewport edges.
      if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
      else if (e.clientY < 90) window.scrollBy(0, -14);
      dragRef.current = next;
      setDrag(next);
    },
    [layout, rect, stepX, stepY, items]
  );

  const finish = useCallback(() => {
    const d = dragRef.current;
    document.body.classList.remove("grid-dragging", "grid-resizing");
    dragRef.current = null;
    setDrag(null);
    if (d?.moved) {
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 50);
      if (!sameLayout(d.preview, layout)) onLayoutChange?.(d.preview);
    }
  }, [layout, onLayoutChange]);

  // Latest handlers, read by the window listeners attached in start().
  const handlers = useRef({ onMove, finish });
  useEffect(() => {
    handlers.current = { onMove, finish };
  }, [onMove, finish]);
  const detach = useRef<(() => void) | null>(null);
  useEffect(() => () => detach.current?.(), []);

  const start = (e: React.PointerEvent, id: string, mode: Mode) => {
    if (!editable || mobile || e.button !== 0) return;
    const origin = layout.find((l) => l.i === id);
    if (!origin) return;
    if (mode === "move") {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-drag-handle]") || t.closest("button, a, input, textarea, select, [data-no-drag]")) return;
    }
    e.preventDefault();
    const r = rect(origin);
    const d: Drag = { id, mode, startX: e.clientX, startY: e.clientY, origin, ...r, preview: layout, key: "", moved: false };
    dragRef.current = d;
    document.body.classList.add(mode === "move" ? "grid-dragging" : "grid-resizing");
    const move = (ev: PointerEvent) => handlers.current.onMove(ev);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      detach.current = null;
      handlers.current.finish();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    detach.current = up;
  };

  // ---- mobile: simple stack --------------------------------------------------------
  if (mobile) {
    const ordered = [...items].sort((a, b) => {
      const la = byId.get(a.id);
      const lb = byId.get(b.id);
      return (la?.y ?? 0) - (lb?.y ?? 0) || (la?.x ?? 0) - (lb?.x ?? 0);
    });
    return (
      <div ref={setEl} className="flex w-full flex-col gap-4" data-testid="chart-grid">
        {ordered.map((it) => {
          const l = byId.get(it.id);
          return (
            <div key={it.id} className={clsx("relative", it.className)} style={{ height: l ? Math.max(rowsToPx(Math.min(l.h, 12)), 150) : 320 }}>
              {it.node}
            </div>
          );
        })}
        {footer}
      </div>
    );
  }

  const rows = layoutHeight(current) + (drag ? 12 : 0);
  const active = drag ? byId.get(drag.id) : null;

  return (
    <div ref={setEl} className="w-full">
      <div
        className={clsx("relative w-full", drag && "select-none")}
        style={{ height: width ? Math.max(rowsToPx(Math.max(rows, 1)), 0) : undefined }}
        data-testid="chart-grid"
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        {/* Column guides while dragging */}
        {drag?.moved && (
          <div className="pointer-events-none absolute inset-0 animate-fade-in">
            {Array.from({ length: COLS }).map((_, i) => (
              <div key={i} className={clsx("absolute inset-y-0 rounded-md", dark ? "bg-white/[0.025]" : "bg-brand/[0.035]")} style={{ left: i * stepX, width: colW }} />
            ))}
          </div>
        )}

        {/* Placeholder where the widget will land */}
        {drag?.moved && active && (
          <div
            className={clsx("pointer-events-none absolute left-0 top-0 rounded-[18px] border-2 border-dashed transition-transform duration-150 ease-out", dark ? "border-white/30 bg-white/5" : "border-brand/50 bg-brand/[0.06]")}
            style={{ ...sizeStyle(rect(active)), transform: `translate(${rect(active).left}px, ${rect(active).top}px)` }}
          />
        )}

        {width > 0 &&
          items.map((it) => {
            const l = byId.get(it.id);
            if (!l) return null;
            const isActive = drag?.id === it.id && drag.moved;
            const r = isActive ? { left: drag.left, top: drag.top, width: drag.width, height: drag.height } : rect(l);
            return (
              <div
                key={it.id}
                data-grid-item={it.id}
                className={clsx(
                  "group/cell absolute left-0 top-0",
                  // The hovered widget rises above its neighbours so its tooltip can float over them.
                  isActive ? "z-30" : "z-10 transition-[transform,width,height] duration-200 ease-out hover:z-20",
                  isActive && drag?.mode === "move" && "cursor-grabbing",
                  it.className
                )}
                style={{ ...sizeStyle(r), transform: `translate(${r.left}px, ${r.top}px)` }}
                onPointerDown={(e) => start(e, it.id, "move")}
              >
                <div className={clsx("h-full transition-[transform,box-shadow] duration-200", isActive && drag?.mode === "move" && "scale-[1.015] rotate-[0.4deg] rounded-[18px] shadow-[var(--shadow-lg)]")}>{it.node}</div>
                {editable && (
                  <>
                    <span data-no-drag className="absolute inset-y-4 -right-1.5 z-20 w-3 cursor-ew-resize" onPointerDown={(e) => start(e, it.id, "e")} aria-hidden />
                    <span data-no-drag className="absolute inset-x-4 -bottom-1.5 z-20 h-3 cursor-ns-resize" onPointerDown={(e) => start(e, it.id, "s")} aria-hidden />
                    <span
                      data-no-drag
                      role="presentation"
                      title="Drag to resize"
                      className={clsx(
                        "absolute -bottom-1 -right-1 z-20 flex h-5 w-5 cursor-nwse-resize items-end justify-end p-1 opacity-0 transition-opacity group-hover/cell:opacity-100",
                        drag?.id === it.id && "opacity-100"
                      )}
                      onPointerDown={(e) => start(e, it.id, "se")}
                      data-testid="resize-handle"
                    >
                      <svg viewBox="0 0 10 10" className={clsx("h-2.5 w-2.5", dark ? "text-white/50" : "text-ink-3")} aria-hidden>
                        <path d="M9 1 1 9M9 5 5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    {drag?.id === it.id && drag.moved && drag.mode !== "move" && (
                      <span className="absolute bottom-3 right-3 z-30 rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
                        {byId.get(it.id)?.w} × {byId.get(it.id)?.h}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}

const sizeStyle = (r: { width: number; height: number }) => ({ width: r.width, height: r.height });
