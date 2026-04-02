"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
  exiting?: boolean;
};

type ToastContextValue = {
  showToast: (variant: ToastVariant, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;
const DISMISS_MS = 3000;

function iconFor(v: ToastVariant) {
  switch (v) {
    case "success":
      return CheckCircle2;
    case "error":
      return AlertCircle;
    case "warning":
      return AlertTriangle;
    default:
      return Info;
  }
}

function stylesFor(v: ToastVariant): string {
  switch (v) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100";
    case "error":
      return "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100";
    default:
      return "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100";
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback((variant: ToastVariant, message: string) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems((prev) => {
      const next = [...prev, { id, variant, message }];
      return next.slice(-MAX_VISIBLE);
    });
    const dismissTimer = setTimeout(() => {
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, exiting: true } : x))
      );
      setTimeout(() => remove(id), 220);
    }, DISMISS_MS);
    timers.current.set(id, dismissTimer);
  }, [remove]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:top-auto sm:items-end sm:px-0 sm:pb-0"
        aria-live="polite"
      >
        {items.map((item) => {
          const Icon = iconFor(item.variant);
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex w-full max-w-none items-start gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-lg transition-all duration-200 min-h-[44px] sm:max-w-[min(100%,20rem)] ${
                item.exiting ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"
              } ${stylesFor(item.variant)}`}
              role="status"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 leading-snug break-words">{item.message}</p>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium opacity-70 hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="OK"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {
        /* no-op outside provider */
      },
    };
  }
  return ctx;
}
