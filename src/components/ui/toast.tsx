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

/**
 * Toasts for transient failures: a failure with data still on screen raises
 * one and leaves the data alone, while a failure with nothing to fall back on
 * renders inline instead.
 *
 * Deduplicated by key — a burst across a twelve-card dashboard is one
 * underlying rate limit, not twelve.
 */

export type Toast = {
  /** Failure class. Two toasts sharing a key are the same event. */
  key: string;
  title: string;
  body?: string;
};

type Ctx = { push: (t: Toast) => void };

const ToastContext = createContext<Ctx | null>(null);

/** No-ops outside a provider rather than throwing — a missing toast is never
 *  worth taking a page down for. */
export function useToast(): Ctx {
  return useContext(ToastContext) ?? { push: () => {} };
}

const DISMISS_MS = 6000;
/** How long a key stays suppressed after firing. */
const DEDUP_MS = 30_000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seen = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((key: string) => {
    setItems((cur) => cur.filter((t) => t.key !== key));
    const timer = timers.current.get(key);
    if (timer) clearTimeout(timer);
    timers.current.delete(key);
  }, []);

  const push = useCallback(
    (toast: Toast) => {
      const now = Date.now();
      const last = seen.current.get(toast.key) ?? 0;
      if (now - last < DEDUP_MS) return; // same cause, already reported
      seen.current.set(toast.key, now);

      setItems((cur) => [...cur.filter((t) => t.key !== toast.key), toast]);

      const timer = setTimeout(() => dismiss(toast.key), DISMISS_MS);
      timers.current.set(toast.key, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* aria-live=polite, not assertive: a background refresh failing should
          be announced without interrupting whatever is being read. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.key}
            className="rise pointer-events-auto flex w-full max-w-sm items-start gap-3 border-l-2 border-[var(--gold)] bg-[var(--raised)] px-4 py-3 shadow-lg shadow-black/40"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.body && (
                <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
                  {t.body}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.key)}
              aria-label="Dismiss"
              className="-mt-1 -mr-1 px-2 py-1 text-[var(--faint)] transition-colors hover:text-[var(--fg)]"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
