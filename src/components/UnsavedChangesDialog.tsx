"use client";

import { X } from "lucide-react";

type UnsavedChangesDialogProps = {
  open: boolean;
  title: string;
  message: string;
  stayLabel: string;
  leaveLabel: string;
  onStay: () => void;
  onLeave: () => void;
};

/**
 * Confirms before discarding in-app settings navigation. Use with `beforeunload` for tab close.
 */
export function UnsavedChangesDialog({
  open,
  title,
  message,
  stayLabel,
  leaveLabel,
  onStay,
  onLeave,
}: UnsavedChangesDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-changes-title" aria-describedby="unsaved-changes-desc">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label={stayLabel} onClick={onStay} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="unsaved-changes-title" className="text-lg font-semibold text-zinc-900 dark:text-white pr-6">
            {title}
          </h2>
          <button
            type="button"
            onClick={onStay}
            className="shrink-0 rounded-lg p-2.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={stayLabel}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p id="unsaved-changes-desc" className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {message}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onLeave}
            className="min-h-[44px] w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60 sm:w-auto"
          >
            {leaveLabel}
          </button>
          <button
            type="button"
            onClick={onStay}
            className="min-h-[44px] w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 sm:w-auto"
          >
            {stayLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
