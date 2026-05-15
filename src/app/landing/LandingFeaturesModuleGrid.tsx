"use client";

import type { LucideIcon } from "lucide-react";

type TxFn = (key: string, fallback: string) => string;

const LANDING_ICON_BADGE =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f97316]/15 text-[#f97316] dark:bg-orange-500/20 dark:text-orange-400";

const MODULE_IDS = ["central", "operations", "schedule", "logistics", "security", "forms"] as const;

type ModuleIcons = Record<(typeof MODULE_IDS)[number], LucideIcon>;

export function LandingFeaturesModuleGrid({
  tx,
  moduleIcons,
}: {
  tx: TxFn;
  moduleIcons: ModuleIcons;
}) {
  return (
    <>
      <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
        {tx("landing_features_heading", "")}
      </h2>
      <div className="mt-10 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {MODULE_IDS.map((id) => {
          const ModIcon = moduleIcons[id];
          return (
            <div
              key={id}
              className="flex min-h-[200px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
            >
              <div className="mb-3 flex items-start gap-3">
                <span className={LANDING_ICON_BADGE} aria-hidden>
                  <ModIcon className="h-7 w-7" strokeWidth={2} />
                </span>
                <h3 className="text-base font-semibold leading-snug text-[#1a4f5e] dark:text-teal-300">
                  {tx(`landing_features_module_${id}`, "")}
                </h3>
              </div>
              <ul className="mt-3 flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {(tx(`landing_features_lines_${id}`, "") || "")
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => (
                    <li key={`${id}-${i}`} className="flex gap-2 leading-snug">
                      <span className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden>
                        ·
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
