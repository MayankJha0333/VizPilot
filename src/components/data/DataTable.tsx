"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { Plus, Trash2 } from "lucide-react";
import type { Column, Row } from "@/lib/charts/types";
import { coerce } from "@/lib/data/parse";

interface Props {
  columns: Column[];
  rows: Row[];
  editable?: boolean;
  onChange?: (next: { columns: Column[]; rows: Row[] }) => void;
  maxHeight?: number;
  pageSize?: number;
}

const TYPE_BADGE: Record<Column["type"], string> = {
  number: "123",
  string: "Abc",
  date: "📅",
  boolean: "✓/✗",
};

export function DataTable({ columns, rows, editable = false, onChange, maxHeight = 420, pageSize = 50 }: Props) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const slice = useMemo(() => rows.slice(page * pageSize, (page + 1) * pageSize), [rows, page, pageSize]);

  const updateCell = (rowIndex: number, col: Column, value: string) => {
    if (!onChange) return;
    const next = rows.map((r, i) => (i === rowIndex ? { ...r, [col.name]: coerce(value, col.type) } : r));
    onChange({ columns, rows: next });
  };
  const addRow = () => {
    if (!onChange) return;
    const blank: Row = {};
    columns.forEach((c) => (blank[c.name] = null));
    onChange({ columns, rows: [...rows, blank] });
    setPage(Math.floor(rows.length / pageSize));
  };
  const removeRow = (rowIndex: number) => {
    if (!onChange) return;
    onChange({ columns, rows: rows.filter((_, i) => i !== rowIndex) });
  };
  const renameColumn = (col: Column, name: string) => {
    if (!onChange || !name.trim() || columns.some((c) => c.name === name && c !== col)) return;
    const nextCols = columns.map((c) => (c === col ? { ...c, name } : c));
    const nextRows = rows.map((r) => {
      const { [col.name]: v, ...rest } = r;
      return { ...rest, [name]: v };
    });
    onChange({ columns: nextCols, rows: nextRows });
  };
  const setType = (col: Column, type: Column["type"]) => {
    if (!onChange) return;
    const nextCols = columns.map((c) => (c === col ? { ...c, type } : c));
    const nextRows = rows.map((r) => ({ ...r, [col.name]: coerce(r[col.name] ?? "", type) }));
    onChange({ columns: nextCols, rows: nextRows });
  };
  const addColumn = () => {
    if (!onChange) return;
    let name = `Column ${columns.length + 1}`;
    let i = 1;
    while (columns.some((c) => c.name === name)) name = `Column ${columns.length + 1 + i++}`;
    onChange({ columns: [...columns, { name, type: "string" }], rows: rows.map((r) => ({ ...r, [name]: null })) });
  };
  const removeColumn = (col: Column) => {
    if (!onChange || columns.length <= 1) return;
    onChange({
      columns: columns.filter((c) => c !== col),
      rows: rows.map((r) => {
        const { [col.name]: _omit, ...rest } = r;
        void _omit;
        return rest;
      }),
    });
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-auto scrollbar-thin" style={{ maxHeight }}>
        <table className="w-full min-w-max border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr>
              <th className="w-10 border-b px-2 py-2 text-center text-[11px] font-medium text-ink-3">#</th>
              {columns.map((col) => (
                <th key={col.name} className="border-b border-l px-2 py-1.5 align-top">
                  <div className="flex items-center gap-1.5">
                    {editable ? (
                      <input
                        className="w-full min-w-[110px] rounded-md bg-transparent px-1 py-0.5 text-[13px] font-semibold text-ink outline-none hover:bg-surface focus:bg-surface focus:ring-2 focus:ring-brand/30"
                        defaultValue={col.name}
                        onBlur={(e) => renameColumn(col, e.target.value.trim())}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      />
                    ) : (
                      <span className="font-semibold text-ink">{col.name}</span>
                    )}
                    {editable ? (
                      <select
                        value={col.type}
                        onChange={(e) => setType(col, e.target.value as Column["type"])}
                        className="rounded-md border bg-surface px-1 py-0.5 text-[11px] text-ink-2"
                        title="Column type"
                      >
                        <option value="string">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="boolean">Yes/No</option>
                      </select>
                    ) : (
                      <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-3" title={col.type}>
                        {TYPE_BADGE[col.type]}
                      </span>
                    )}
                    {editable && columns.length > 1 && (
                      <button onClick={() => removeColumn(col)} className="rounded p-0.5 text-ink-3 hover:text-danger" title="Remove column">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {editable && (
                <th className="border-b border-l px-2 py-1.5">
                  <button onClick={addColumn} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand hover:bg-brand-soft">
                    <Plus className="h-3 w-3" /> Column
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => {
              const rowIndex = page * pageSize + i;
              return (
                <tr key={rowIndex} className="group/row hover:bg-surface-2/60">
                  <td className="border-b px-2 py-1 text-center text-[11px] text-ink-3">
                    {editable ? (
                      <button onClick={() => removeRow(rowIndex)} className="rounded p-0.5 text-ink-3 opacity-0 hover:text-danger group-hover/row:opacity-100" title="Delete row">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      rowIndex + 1
                    )}
                  </td>
                  {columns.map((col) => (
                    <td key={col.name} className={clsx("border-b border-l px-2 py-1 tabular-nums", col.type === "number" && "text-right")}>
                      {editable ? (
                        <input
                          className="w-full min-w-[90px] rounded-md bg-transparent px-1 py-0.5 outline-none focus:bg-surface focus:ring-2 focus:ring-brand/30"
                          defaultValue={row[col.name] === null || row[col.name] === undefined ? "" : String(row[col.name])}
                          onBlur={(e) => updateCell(rowIndex, col, e.target.value)}
                        />
                      ) : (
                        <span className={row[col.name] === null ? "text-ink-3" : ""}>{row[col.name] === null || row[col.name] === undefined ? "—" : String(row[col.name])}</span>
                      )}
                    </td>
                  ))}
                  {editable && <td className="border-b border-l" />}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-8 text-center text-sm text-ink-3">
                  No rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t bg-surface-2 px-3 py-2 text-xs text-ink-2">
        <span>
          {rows.length.toLocaleString()} rows · {columns.length} columns
        </span>
        <div className="flex items-center gap-2">
          {editable && (
            <button onClick={addRow} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-brand hover:bg-brand-soft">
              <Plus className="h-3 w-3" /> Add row
            </button>
          )}
          {pages > 1 && (
            <>
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-md border bg-surface px-2 py-1 disabled:opacity-40">
                ‹
              </button>
              <span>
                {page + 1} / {pages}
              </span>
              <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded-md border bg-surface px-2 py-1 disabled:opacity-40">
                ›
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
