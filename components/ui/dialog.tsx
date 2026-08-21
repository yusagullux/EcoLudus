"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Accessible modal dialog.
 *
 * Provides role="dialog" / aria-modal, Escape-to-close, backdrop-click-to-close,
 * a focus trap (Tab/Shift+Tab cycle within the dialog), body-scroll lock while
 * open, and focus restoration to the trigger when closed. Built on the existing
 * theme CSS variables — no new colors or dependencies.
 *
 * Caller is responsible for the `open` boolean and `onClose` handler. Render this
 * component unconditionally and let it no-op when `open` is false, OR render
 * conditionally — both work because the effect hooks short-circuit on `!open`.
 */
type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Optional id override; otherwise a stable useId is generated. */
  labelledby?: string;
  /** Description read by AT after the title. */
  description?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Disable closing on backdrop click (e.g. for required confirmations). Default false. */
  disableBackdropClose?: boolean;
  /** Hide the default top-right close button (when you provide your own). */
  hideCloseButton?: boolean;
  children: ReactNode;
  /** Footer slot, typically actions. Rendered inside the panel after children. */
  footer?: ReactNode;
  className?: string;
};

const SIZE_MAX: Record<NonNullable<DialogProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl"
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const MotionBackdrop = motion.div;
const MotionPanel = motion.div;

export function Dialog({
  open,
  onClose,
  title,
  labelledby,
  description,
  size = "md",
  disableBackdropClose = false,
  hideCloseButton = false,
  children,
  footer,
  className = ""
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const autoId = useId();
  const titleId = labelledby ?? (title ? `dialog-title-${autoId}` : undefined);
  const descId = description ? `dialog-desc-${autoId}` : undefined;
  const prefersReducedMotion = useReducedMotion();

  // Keep the latest onClose in a ref so the Escape handler always calls the
  // current version without forcing the focus effect to re-bind (which would
  // re-steal focus on every parent re-render — e.g. on each keystroke typed
  // into a textarea inside the dialog, when onClose is an inline arrow).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus trap, escape, scroll lock, focus restore.
  // Depends only on `open` so focus is set once when the dialog opens, not
  // re-stolen on every render (callers commonly pass an inline onClose).
  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the panel (or first focusable) on open.
    const focusInitial = () => {
      const target = panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      target?.focus({ preventScroll: true });
    };
    focusInitial();

    // Lock body scroll.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (active === last || !panel.contains(active)) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <MotionBackdrop
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
      onClick={disableBackdropClose ? undefined : onClose}
      role="presentation"
    >
      <MotionPanel
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className={`relative flex max-h-[90vh] w-full ${SIZE_MAX[size]} flex-col overflow-hidden rounded-[24px] border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.25)] outline-none ${className}`}
        style={{ borderColor: "var(--border-default)", background: "var(--bg-panel)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-4 shrink-0 pr-10">
            <h3 id={titleId} className="font-serif text-xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
              {title}
            </h3>
            {description && (
              <p id={descId} className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                {description}
              </p>
            )}
          </div>
        )}

        {!hideCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: "var(--bg-panel-alt)",
              color: "var(--text-muted)",
              // @ts-expect-error CSS custom property for ring offset color
              "--tw-ring-offset-color": "var(--bg-panel)"
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto text-sm leading-6" style={{ color: "var(--text-primary)" }}>
          {children}
        </div>

        {footer && (
          <div className="mt-5 shrink-0 flex flex-wrap gap-3">{footer}</div>
        )}
      </MotionPanel>
    </MotionBackdrop>
  );
}