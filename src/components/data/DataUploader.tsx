"use client";

import { useCallback, useRef, useState } from "react";
import { clsx } from "clsx";
import { ClipboardPaste, FileSpreadsheet, Sparkles, Table2, UploadCloud } from "lucide-react";
import { parseDelimitedText, parseFile, type ParsedTable } from "@/lib/data/parse";
import { SAMPLE_DATASETS } from "@/lib/data/samples";
import type { Column, Row } from "@/lib/charts/types";
import { DataTable } from "@/components/data/DataTable";
import { Button } from "@/components/ui/Button";

export type DataSource = "csv" | "excel" | "paste" | "manual" | "sample";

export interface DataDraft {
  name: string;
  source: DataSource;
  columns: Column[];
  rows: Row[];
}

interface Props {
  onReady: (draft: DataDraft | null) => void;
  draft: DataDraft | null;
  initialMode?: Mode;
}

type Mode = "upload" | "paste" | "sample" | "manual";

const MODES: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: "upload", label: "Upload file", icon: UploadCloud, hint: "CSV or Excel" },
  { id: "paste", label: "Paste data", icon: ClipboardPaste, hint: "From a spreadsheet" },
  { id: "sample", label: "Use a sample", icon: Sparkles, hint: "Try it instantly" },
  { id: "manual", label: "Type it in", icon: Table2, hint: "Start from scratch" },
];

const PASTE_EXAMPLE = `Month\tRevenue\tCustomers
Jan\t12000\t120
Feb\t15800\t142
Mar\t14100\t139
Apr\t19800\t171`;

export function DataUploader({ onReady, draft, initialMode }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode ?? (draft?.source === "paste" ? "paste" : draft?.source === "sample" ? "sample" : draft?.source === "manual" ? "manual" : "upload"));
  const [error, setError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const finish = useCallback(
    (table: ParsedTable, name: string, source: DataSource) => {
      if (table.columns.length === 0 || table.rows.length === 0) {
        setError("We couldn't find any rows. Make sure the first line has column names.");
        return;
      }
      setError(null);
      onReady({ name, source, columns: table.columns, rows: table.rows });
    },
    [onReady]
  );

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const lower = file.name.toLowerCase();
      const ok = [".csv", ".tsv", ".txt", ".xlsx", ".xls"].some((ext) => lower.endsWith(ext));
      if (!ok) throw new Error("Please upload a .csv, .tsv, .xlsx or .xls file.");
      if (file.size > 8 * 1024 * 1024) throw new Error("Files over 8 MB aren't supported yet.");
      const table = await parseFile(file);
      finish(table, file.name.replace(/\.[^.]+$/, ""), lower.endsWith(".xls") || lower.endsWith(".xlsx") ? "excel" : "csv");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setBusy(false);
    }
  };

  const handlePaste = () => {
    const table = parseDelimitedText(pasteText);
    finish(table, "Pasted data", "paste");
  };

  const startManual = () => {
    const columns: Column[] = [
      { name: "Category", type: "string" },
      { name: "Value", type: "number" },
    ];
    const rows: Row[] = [
      { Category: "A", Value: 10 },
      { Category: "B", Value: 25 },
      { Category: "C", Value: 18 },
    ];
    onReady({ name: "My data", source: "manual", columns, rows });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id);
              setError(null);
            }}
            className={clsx(
              "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5",
              mode === m.id ? "border-brand bg-brand-soft shadow-[0_0_0_3px_var(--ring)]" : "bg-surface hover:bg-surface-2"
            )}
          >
            <m.icon className={clsx("h-5 w-5", mode === m.id ? "text-brand" : "text-ink-3")} />
            <div>
              <div className={clsx("text-sm font-medium", mode === m.id ? "text-brand-ink" : "text-ink")}>{m.label}</div>
              <div className="text-[11px] text-ink-3">{m.hint}</div>
            </div>
          </button>
        ))}
      </div>

      {mode === "upload" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => fileInput.current?.click()}
          className={clsx(
            "bg-dots flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
            dragging ? "border-brand bg-brand-soft/60" : "border-border-strong hover:border-brand/60"
          )}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
            data-testid="file-input"
          />
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-ink">{busy ? "Reading your file…" : "Drop a CSV or Excel file here"}</p>
          <p className="mt-1 text-xs text-ink-3">or click to browse · first row should be column names</p>
        </div>
      )}

      {mode === "paste" && (
        <div className="space-y-3">
          <textarea
            className="input min-h-[180px] resize-y font-mono text-xs"
            placeholder={PASTE_EXAMPLE}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            data-testid="paste-area"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-3">Copy cells from Google Sheets or Excel and paste them here. Commas, tabs and semicolons all work.</p>
            <Button size="sm" onClick={handlePaste} disabled={!pasteText.trim()}>
              Use this data
            </Button>
          </div>
        </div>
      )}

      {mode === "sample" && (
        <div className="stagger stagger-auto grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_DATASETS.map((s) => {
            const active = draft?.name === s.name && draft.source === "sample";
            return (
              <button
                key={s.id}
                onClick={() => onReady({ name: s.name, source: "sample", columns: s.columns, rows: s.rows })}
                className={clsx(
                  "card-hover group flex flex-col items-start gap-2 rounded-2xl border p-4 text-left",
                  active ? "border-brand bg-brand-soft shadow-[0_0_0_3px_var(--ring)]" : "bg-surface"
                )}
                data-testid={`sample-${s.id}`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3 text-xl transition-transform duration-200 group-hover:scale-110">{s.emoji}</span>
                  {active && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">Selected</span>}
                </div>
                <div className="text-sm font-semibold text-ink">{s.name}</div>
                <div className="text-xs leading-relaxed text-ink-2">{s.description}</div>
                <div className="mt-auto flex flex-wrap gap-1 pt-1">
                  <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-3">{s.rows.length} rows</span>
                  <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-3">{s.columns.length} cols</span>
                  {s.tags.map((t) => (
                    <span key={t} className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] text-brand-ink">
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {mode === "manual" && !draft && (
        <div className="card bg-dots flex flex-col items-center px-6 py-10 text-center">
          <Table2 className="mb-3 h-8 w-8 text-brand" />
          <p className="text-sm font-medium">Start with a small table and edit it like a spreadsheet.</p>
          <Button size="sm" className="mt-4" onClick={startManual}>
            Create blank table
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {draft && (
        <div className="space-y-3 animate-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              <input
                className="rounded-md border-0 bg-transparent px-1 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-brand/30"
                value={draft.name}
                onChange={(e) => onReady({ ...draft, name: e.target.value })}
                aria-label="Dataset name"
              />
              <span className="text-xs text-ink-3">
                {draft.rows.length.toLocaleString()} rows · {draft.columns.length} columns
              </span>
            </div>
            <button onClick={() => onReady(null)} className="text-xs text-ink-2 underline hover:text-ink">
              Start over
            </button>
          </div>
          <DataTable
            columns={draft.columns}
            rows={draft.rows}
            editable
            maxHeight={320}
            onChange={({ columns, rows }) => onReady({ ...draft, columns, rows })}
          />
          <p className="text-xs text-ink-3">Tip: click a column name to rename it, or change its type with the dropdown. Numbers are detected automatically.</p>
        </div>
      )}
    </div>
  );
}
