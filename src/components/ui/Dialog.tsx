"use client";

import { useEffect } from "react";
import { clsx } from "clsx";

/**
 * Large centered dialog for full workflows (widget builder, Ask AI).
 * Unlike Modal it has no built-in header – the content owns its layout.
 */
export function Dialog({ open, onClose, children, className, label }: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-[#0b0f1e]/55 backdrop-blur-[6px] animate-fade-in" onClick={onClose} />
      <div
        className={clsx(
          "relative flex h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-surface shadow-[0_40px_120px_-30px_rgba(11,15,30,0.6)] animate-slide-up sm:h-[88vh] sm:rounded-3xl sm:animate-dialog-in",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
