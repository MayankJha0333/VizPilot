"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check, ChevronDown, Database, Plus, Search } from "lucide-react";

export interface SourceOption {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  /** Already used somewhere in this report. */
  inReport?: boolean;
}

/**
 * Dropdown to pick the data source for a widget or an Ask AI conversation.
 * Groups sources already in the report above the rest of the workspace and
 * offers "Add new data" at the bottom.
 */
export function SourcePicker({ value, options, onChange, onAddNew, compact }: { value: string | null; options: SourceOption[]; onChange: (id: string) => void; onAddNew?: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const s = q.trim().toLowerCase();
  const filtered = options.filter((o) => !s || o.name.toLowerCase().includes(s));
  const inReport = filtered.filter((o) => o.inReport);
  const others = filtered.filter((o) => !o.inReport);

  const row = (o: SourceOption) => (
    <button
      key={o.id}
      type="button"
      onClick={() => {
        onChange(o.id);
        setOpen(false);
        setQ("");
      }}
      className={clsx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors", o.id === value ? "bg-brand-soft" : "hover:bg-surface-2")}
      data-testid="source-option"
    >
      <span className={clsx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", o.id === value ? "bg-brand text-white" : "bg-surface-3 text-ink-2")}>
        <Database className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{o.name}</span>
        <span className="block text-[11px] text-ink-3">
          {o.rowCount.toLocaleString()} rows · {o.columnCount} columns
        </span>
      </span>
      {o.id === value && <Check className="h-4 w-4 text-brand" />}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex max-w-full items-center gap-2 rounded-xl border bg-surface text-left transition-all hover:border-border-strong hover:shadow-[var(--shadow-sm)]",
          compact ? "px-2 py-1" : "px-3 py-2",
          open && "border-brand ring-2 ring-[var(--ring)]"
        )}
        data-testid="source-picker"
      >
        <Database className={clsx("shrink-0 text-brand", compact ? "h-3 w-3" : "h-4 w-4")} />
        <span className="min-w-0">
          {!compact && <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-3">Data source</span>}
          <span className={clsx("block truncate font-medium text-ink", compact ? "text-xs" : "text-sm")}>{current ? current.name : "Choose data…"}</span>
        </span>
        <ChevronDown className={clsx("h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border bg-surface shadow-[var(--shadow-lg)] animate-scale-in">
          {options.length > 5 && (
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-3.5 w-3.5 text-ink-3" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search datasets…" className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3" />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto p-1.5 scrollbar-thin">
            {inReport.length > 0 && <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">In this report</div>}
            {inReport.map(row)}
            {others.length > 0 && <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">{inReport.length ? "Other datasets" : "Your datasets"}</div>}
            {others.map(row)}
            {filtered.length === 0 && <div className="px-3 py-6 text-center text-xs text-ink-3">No datasets match “{q}”.</div>}
          </div>
          {onAddNew && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddNew();
              }}
              className="flex w-full items-center gap-2 border-t bg-surface-2 px-4 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand-soft"
              data-testid="source-add-new"
            >
              <Plus className="h-4 w-4" /> Add new data (upload, paste, sample)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
