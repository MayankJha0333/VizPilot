"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  side?: "top" | "bottom";
  className?: string;
}

/** Tiny dropdown menu (no external deps). */
export function Menu({ trigger, items, align = "right", side = "bottom", className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={clsx("relative", className)}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        {trigger}
      </div>
      {open && (
        <div
          className={clsx(
            "absolute z-40 min-w-[190px] overflow-hidden rounded-[18px] bg-popover p-1.5 shadow-[var(--shadow-md)] animate-fade-up",
            side === "top" ? "bottom-full mb-2" : "mt-2",
            align === "right" ? "right-0" : "left-0"
          )}
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setOpen(false);
                item.onClick();
              }}
              className={clsx(
                "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors disabled:opacity-50",
                item.danger ? "text-danger-ink hover:bg-danger-soft" : "text-ink hover:bg-surface-2"
              )}
            >
              {item.icon && <span className="text-ink-3">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
