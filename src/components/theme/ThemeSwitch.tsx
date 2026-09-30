"use client";

import { clsx } from "clsx";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePref } from "@/components/theme/ThemeProvider";

/** Clay sun/moon switch for the whole app. `compact` renders a single round icon button. */
export function ThemeSwitch({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  if (compact) {
    return (
      <button type="button" role="switch" aria-checked={dark} aria-label="Toggle theme" title={label} onClick={toggle} className={clsx("clay-sm clay-press flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:text-ink", className)}>
        {dark ? <Moon className="h-4 w-4 text-brand" /> : <Sun className="h-4 w-4 text-warning" />}
      </button>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Toggle theme"
      title={label}
      onClick={toggle}
      className={clsx("clay-inset relative flex h-9 w-[66px] shrink-0 items-center justify-between rounded-full px-2.5 text-ink-3", className)}
    >
      <span className={clsx("absolute top-[4px] h-7 w-7 rounded-full bg-surface shadow-[var(--shadow-sm)] transition-transform duration-300 ease-[var(--ease-spring)]", dark ? "translate-x-[26px]" : "-translate-x-[6px]")} />
      <Sun className={clsx("relative h-3.5 w-3.5 transition-colors", !dark && "text-warning")} />
      <Moon className={clsx("relative h-3.5 w-3.5 transition-colors", dark && "text-brand")} />
    </button>
  );
}

const OPTIONS: { value: ThemePref; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
  { value: "system", label: "System", icon: <Monitor className="h-3.5 w-3.5" /> },
];

/** Light / Dark / System picker for Settings. */
export function ThemePicker() {
  const { pref, setPref } = useTheme();
  return (
    <div className="clay-inset inline-flex rounded-full p-1" role="radiogroup" aria-label="App theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          onClick={() => setPref(o.value)}
          className={clsx("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-all", pref === o.value ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-2 hover:text-ink")}
          data-testid={`theme-${o.value}`}
        >
          {o.icon} {o.label}
        </button>
      ))}
    </div>
  );
}
