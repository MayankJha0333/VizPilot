"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { THEME_KEY as KEY, THEME_QUERY as QUERY } from "@/components/theme/boot";

/**
 * App-wide theme (the person's own preference, saved in this browser).
 * - "system" follows the OS setting and is the default.
 * - A report's own `theme` is separate: it only decides how a shared link / Present mode looks to viewers.
 */
export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const EVENT = "vp-theme-change";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}
function subscribePref(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}
function readSystemDark() {
  return window.matchMedia(QUERY).matches;
}
function subscribeSystem(cb: () => void) {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
function resolve(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

interface ThemeApi {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setPref: (p: ThemePref) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pref = useSyncExternalStore(subscribePref, readPref, () => "system" as ThemePref);
  const systemDark = useSyncExternalStore(subscribeSystem, readSystemDark, () => false);
  const resolved = resolve(pref, systemDark);

  useEffect(() => {
    // Read the live values (not the hydration snapshot) so the first effect never flips the page to light.
    const r = resolve(readPref(), readSystemDark());
    const root = document.documentElement;
    root.dataset.theme = r;
    root.style.colorScheme = r;
  }, [pref, systemDark]);

  const setPref = useCallback((p: ThemePref) => {
    try {
      if (p === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const api = useMemo<ThemeApi>(() => ({ pref, resolved, setPref, toggle: () => setPref(resolved === "dark" ? "light" : "dark") }), [pref, resolved, setPref]);
  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
