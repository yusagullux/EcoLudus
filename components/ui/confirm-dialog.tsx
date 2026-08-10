"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { dangerButton, primaryButton, secondaryButton } from "@/components/game-ui";

/**
 * In-app confirmation dialog. Replaces native `confirm()`. Built on the shared
 * Dialog, so it inherits Escape / focus-trap / aria-modal / scroll-lock for free.
 * Supports an async `onConfirm` — while pending the confirm button shows a
 * spinner, both buttons are disabled, and the dialog can't be dismissed by
 * accident (it stays open until the promise resolves; the caller closes it via
 * `open={false}`). The pending guard also prevents duplicate async calls if the
 * user clicks Confirm repeatedly before the first call settles.
 */
type ConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** If provided, the confirm button is disabled until this resolves. */
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  /** Hide the default close button + disable backdrop close (force an explicit choice). */
  requireExplicitChoice?: boolean;
};

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onClose,
  requireExplicitChoice = false
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  const busyCls = "disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      hideCloseButton={requireExplicitChoice}
      disableBackdropClose={requireExplicitChoice}
      footer={
        <>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            aria-busy={pending}
            className={`${danger ? dangerButton : primaryButton} ${busyCls}`}
          >
            {pending ? <Spinner /> : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={`${secondaryButton} ${busyCls}`}
          >
            {cancelLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 leading-none" aria-hidden="true" style={{ color: danger ? "var(--text-danger, var(--text-accent))" : "var(--text-muted)" }}>
          {danger ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          )}
        </span>
        {message ? (
          <p className="text-sm leading-6" style={{ color: "var(--text-muted)" }}>{message}</p>
        ) : null}
      </div>
    </Dialog>
  );
}