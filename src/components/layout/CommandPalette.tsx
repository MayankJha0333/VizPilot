"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Database, FilePlus2, LayoutGrid, Search, Settings, Sparkles, Upload } from "lucide-react";
import { api } from "@/lib/api";
import type { DatasetSummary, ReportRecord } from "@/lib/charts/types";
import { timeAgo } from "@/components/ui/misc";

interface Item {
  id: string;
  group: "Actions" | "Reports" | "Datasets";
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

/** Module-level cache so the palette is instant on re-open; refreshed in the background each time. */
let cache: { reports: ReportRecord[]; datasets: DatasetSummary[] } | null = null;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [reports, setReports] = useState<ReportRecord[]>(() => cache?.reports ?? []);
  const [datasets, setDatasets] = useState<DatasetSummary[]>(() => cache?.datasets ?? []);
  const [loading, setLoading] = useState(() => cache === null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTimeout(() => {
      inputRef.current?.focus();
      setQ("");
      setActive(0);
    }, 0);
    Promise.all([api<{ reports: ReportRecord[] }>("/api/reports"), api<{ datasets: DatasetSummary[] }>("/api/datasets")])
      .then(([r, d]) => {
        cache = { reports: r.reports, datasets: d.datasets };
        if (cancelled) return;
        setReports(r.reports);
        setDatasets(d.datasets);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const go = (path: string) => {
    onClose();
    router.push(path);
  };

  const items = useMemo<Item[]>(() => {
    const actions: Item[] = [
      { id: "new", group: "Actions", label: "New report", hint: "Upload, paste or pick a sample", icon: <FilePlus2 className="h-4 w-4" />, run: () => go("/reports/new") },
      { id: "upload", group: "Actions", label: "Upload a CSV or Excel file", icon: <Upload className="h-4 w-4" />, run: () => go("/reports/new?mode=upload") },
      { id: "sample", group: "Actions", label: "Start from a sample dataset", icon: <Sparkles className="h-4 w-4" />, run: () => go("/reports/new?mode=sample") },
      { id: "home", group: "Actions", label: "Go to Home", icon: <LayoutGrid className="h-4 w-4" />, run: () => go("/dashboard") },
      { id: "data", group: "Actions", label: "Go to Datasets", icon: <Database className="h-4 w-4" />, run: () => go("/datasets") },
      { id: "settings", group: "Actions", label: "Settings & AI providers", icon: <Settings className="h-4 w-4" />, run: () => go("/settings") },
    ];
    const rep: Item[] = reports.map((r) => ({ id: `r-${r._id}`, group: "Reports", label: r.title, hint: `Edited ${timeAgo(r.updatedAt)}`, icon: <LayoutGrid className="h-4 w-4" />, run: () => go(`/reports/${r._id}`) }));
    const ds: Item[] = datasets.map((d) => ({ id: `d-${d._id}`, group: "Datasets", label: d.name, hint: `${d.rowCount.toLocaleString()} rows · ${d.columns.length} columns`, icon: <Database className="h-4 w-4" />, run: () => go(`/datasets/${d._id}`) }));
    const all = [...actions, ...rep, ...ds];
    const s = q.trim().toLowerCase();
    if (!s) return [...actions.slice(0, 3), ...rep.slice(0, 5), ...ds.slice(0, 4)];
    return all.filter((i) => i.label.toLowerCase().includes(s) || i.hint?.toLowerCase().includes(s)).slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, reports, datasets]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(items.length - 1, a + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        items[active]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, active, onClose]);

  if (!open) return null;
  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#262b58]/35 backdrop-blur-[4px] animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-[26px] bg-surface shadow-[var(--shadow-lg)] animate-scale-in">
        <div className="m-2 flex items-center gap-3 rounded-[18px] border-[1.5px] border-[var(--input-border)] px-4 clay-inset">
          <Search className="h-4 w-4 text-ink-3" />
          <input
            ref={inputRef}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
            placeholder="Search reports, datasets, or type a command…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            data-testid="command-input"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2 scrollbar-thin">
          {items.length === 0 && loading && (
            <div className="space-y-2 p-2" data-testid="command-loading">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <div className="skeleton h-7 w-7 rounded-lg" />
                  <div className="skeleton h-3.5 w-1/2" />
                </div>
              ))}
            </div>
          )}
          {items.length === 0 && !loading && <div className="px-3 py-8 text-center text-sm text-ink-3">Nothing found for “{q}”.</div>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{header}</div>}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={it.run}
                  className={clsx("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors", i === active ? "bg-brand-soft text-brand-ink" : "text-ink hover:bg-surface-2")}
                >
                  <span className={clsx("flex h-8 w-8 items-center justify-center", i === active ? "clay-tile bg-surface text-brand" : "clay-tile bg-surface-2 text-ink-2")}>{it.icon}</span>
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="truncate text-xs text-ink-3">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 px-4 pb-3 pt-1 text-[11px] font-semibold text-ink-3">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> navigate
          </span>
          <span>
            <span className="kbd">↵</span> open
          </span>
        </div>
      </div>
    </div>
  );
}
