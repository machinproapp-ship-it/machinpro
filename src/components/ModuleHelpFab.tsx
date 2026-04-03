"use client";

import { useState } from "react";
import { X } from "lucide-react";

export type ModuleHelpKey =
  | "office"
  | "warehouse"
  | "employees"
  | "site"
  | "schedule"
  | "forms"
  | "security"
  | "settings";

export interface ModuleHelpFabProps {
  moduleKey: ModuleHelpKey;
  labels: Record<string, string>;
  onOpenSettingsHelp: () => void;
}

export function ModuleHelpFab({ moduleKey, labels, onOpenSettingsHelp }: ModuleHelpFabProps) {
  const [open, setOpen] = useState(false);
  const L = (k: string, fb: string) => labels[k] ?? fb;
  const p = `help_mod_${moduleKey}`;
  const title = L(`${p}_title`, "");
  const body = L(`${p}_body`, "");
  const a1 = L(`${p}_action1`, "");
  const a2 = L(`${p}_action2`, "");
  const a3 = L(`${p}_action3`, "");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 min-h-[56px] min-w-[56px] items-center justify-center rounded-full border border-zinc-300 bg-white text-lg font-semibold text-zinc-800 shadow-lg hover:bg-zinc-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 xl:hidden"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={L("help_module_button", "Help")}
      >
        ?
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-black/40 md:hidden"
            aria-label={L("common_close", "Close")}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`module-help-title-${moduleKey}`}
            className="fixed bottom-[5.5rem] left-3 right-3 z-[80] max-h-[min(70vh,28rem)] w-auto max-w-[95vw] mx-auto overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900 xl:hidden"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h2 id={`module-help-title-${moduleKey}`} className="text-base font-semibold text-zinc-900 dark:text-white">
                {title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-slate-800"
                aria-label={L("common_close", "Close")}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{body}</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-200">
              {a1 ? <li>{a1}</li> : null}
              {a2 ? <li>{a2}</li> : null}
              {a3 ? <li>{a3}</li> : null}
            </ul>
            <button
              type="button"
              className="mt-4 w-full min-h-[44px] rounded-xl border border-amber-500 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
              onClick={() => {
                setOpen(false);
                onOpenSettingsHelp();
              }}
            >
              {L("helpAndTutorials", "Help & tutorials")}
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
