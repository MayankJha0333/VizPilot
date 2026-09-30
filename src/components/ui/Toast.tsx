"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { clsx } from "clsx";

type Kind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: Kind;
  message: string;
}

interface ToastApi {
  toast: (message: string, kind?: Kind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message: string, kind: Kind = "info") => {
      const id = ++counter;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({ toast, success: (m) => toast(m, "success"), error: (m) => toast(m, "error") }),
    [toast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={clsx(
              "pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-[18px] bg-popover px-4 py-3 text-sm font-semibold shadow-[var(--shadow-md)] animate-scale-in",
                    )}
          >
            {t.kind === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
            {t.kind === "error" && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
            {t.kind === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
            <span className="flex-1 text-ink">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-ink-3 hover:text-ink" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
            <span
              className={clsx("absolute bottom-0 left-0 h-0.5 origin-left", t.kind === "success" ? "bg-success" : t.kind === "error" ? "bg-danger" : "bg-brand")}
              style={{ width: "100%", animation: `progress ${t.kind === "error" ? 6 : 3.5}s linear forwards` }}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
