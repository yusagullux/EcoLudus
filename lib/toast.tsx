"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

/**
 * App-wide toast notifications. Replaces the ~10 per-page
 * `useState("")` + `setTimeout` + bottom-center-pill implementations.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.show("Saved");                 // default
 *   toast.success("Profile updated");    // success (emerald)
 *   toast.error("Something went wrong");  // error (rose)
 *
 * To mount, wrap the app in <ToastProvider> once (see app/(game)/layout.tsx).
 * Toasts auto-dismiss after `durationMs` and render in a single aria-live region.
 */

export type ToastVariant = "default" | "success" | "error";

type ToastInput = {
  message: string;
  variant?: ToastVariant;
  /** Override the default 3500ms dismiss delay. */
  durationMs?: number;
};

type ToastRecord = ToastInput & { id: number };

type ToastApi = {
  show: (message: string, opts?: Omit<ToastInput, "message">) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  // Monotonic id counter — avoids Date.now()/Math.random() (banned in some runtimes).
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current;
      const record: ToastRecord = { id, ...input };
      setToasts((cur) => {
        // Dedupe identical in-flight messages (same text + variant).
        const dupe = cur.find((t) => t.message === record.message && t.variant === record.variant);
        if (dupe) return cur;
        return [...cur, record];
      });
      const delay = input.durationMs ?? DEFAULT_DURATION;
      const handle = setTimeout(() => dismiss(id), delay);
      timers.current.set(id, handle);
    },
    [dismiss]
  );

  // Cleanup all pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((h) => clearTimeout(h));
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show: (message: string, opts?: Omit<ToastInput, "message">) =>
        push({ message, variant: opts?.variant ?? "default", durationMs: opts?.durationMs }),
      success: (message: string, durationMs?: number) => push({ message, variant: "success", durationMs }),
      error: (message: string, durationMs?: number) => push({ message, variant: "error", durationMs }),
      dismiss
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Single live region — AT announce new toasts; existing ones update in place. */}
      <div
        className="pointer-events-none fixed top-6 right-6 z-[60] flex flex-col items-end gap-2 px-4 max-w-full"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} record={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ record, onDismiss }: { record: ToastRecord; onDismiss: () => void }) {
  const isPlain = record.variant === "default";
  const icon = record.variant === "success" ? "✓" : record.variant === "error" ? "!" : null;
  const prefersReducedMotion = useReducedMotion();

  const bg = isPlain
    ? "var(--bg-sidebar)"
    : record.variant === "success"
    ? "var(--toast-success-bg)"
    : "var(--toast-error-bg)";
  const fg = isPlain
    ? "var(--text-sidebar)"
    : record.variant === "success"
    ? "var(--toast-success-fg)"
    : "var(--toast-error-fg)";

  return (
    <motion.div
      layout
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 20, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="pointer-events-auto flex w-auto max-w-md items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold shadow-xl"
      style={{ background: bg, color: fg } as React.CSSProperties}
    >
      {icon && (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: "rgba(255,255,255,0.22)" }}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <span className="text-left flex-1 break-words leading-snug">{record.message}</span>
      <button 
        onClick={onDismiss} 
        className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-white/20 transition-colors"
        aria-label="Dismiss"
      >
        <span className="text-xs">✕</span>
      </button>
    </motion.div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful no-op outside a provider (e.g. marketing pages) so callers don't crash.
    return { show: () => {}, success: () => {}, error: () => {}, dismiss: () => {} };
  }
  return ctx;
}