"use client";

import { type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { primaryButton, secondaryButton } from "@/components/game-ui";

/**
 * In-app confirmation dialog. Replaces native `confirm()`. Built on the shared
 * Dialog, so it inherits Escape / focus-trap / aria-modal / scroll-lock for free.
 * Supports an async `onConfirm` — while pending the confirm button shows a spinner
 * and the dialog can't be dismissed by accident (it stays open until the promise
 * resolves; caller closes via `open={false}`).
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
  const handleConfirm = async () => {
    await onConfirm();
  };

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
            className={danger
              ? "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-400"
              : primaryButton}
          >
            {confirmLabel}
          </button>
          <button type="button" onClick={onClose} className={secondaryButton}>
            {cancelLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden="true">{danger ? "⚠️" : "❓"}</span>
        {message ? (
          <p className="text-sm leading-6" style={{ color: "var(--text-muted)" }}>{message}</p>
        ) : null}
      </div>
    </Dialog>
  );
}