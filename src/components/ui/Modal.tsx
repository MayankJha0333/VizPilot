"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-5xl" };

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#262b58]/35 backdrop-blur-[4px] animate-fade-in" onClick={onClose} />
      <div
        className={clsx(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-[var(--shadow-lg)] animate-slide-up sm:m-4 sm:animate-scale-in sm:rounded-[28px]",
          sizes[size]
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
            <div>
              {title && <h2 className="text-lg font-extrabold text-ink">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
            </div>
            <button onClick={onClose} className="clay-sm clay-press rounded-xl p-1.5 text-ink-3 hover:text-ink" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-2">{footer}</div>}
      </div>
    </div>
  );
}
