"use client";

/**
 * Guías paso a paso (Ajustes → Ayuda y tutoriales, y machin.pro/help).
 * Cada guía: título, introducción y pasos numerados, todo traducido.
 */
const GUIDES: { key: string; steps: number }[] = [{ key: "guide_tools", steps: 8 }];

export function HelpGuides({ labels, variant = "app" }: { labels: Record<string, string>; variant?: "app" | "public" }) {
  const L = (k: string) => labels[k] ?? "";
  const pub = variant === "public";
  return (
    <div className="space-y-2">
      <h4
        className={
          pub
            ? "text-lg font-semibold text-slate-900 dark:text-white"
            : "text-sm font-semibold text-zinc-900 dark:text-zinc-100"
        }
      >
        {L("guides_title")}
      </h4>
      {GUIDES.map((g) => (
        <details
          key={g.key}
          id={g.key}
          className={
            pub
              ? "group scroll-mt-24 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/15 dark:bg-white/10"
              : "group rounded-xl border border-zinc-200 bg-white open:ring-1 open:ring-orange-200/80 dark:border-slate-700 dark:bg-slate-900 dark:open:ring-orange-900/40"
          }
        >
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
            <span className="flex-1 pr-2">{L(`${g.key}_title`)}</span>
            <span className="text-zinc-400 transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="space-y-3 px-4 pb-4">
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{L(`${g.key}_intro`)}</p>
            <ol className="space-y-2">
              {Array.from({ length: g.steps }, (_, i) => i + 1).map((n) => (
                <li key={n} className="flex gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                    aria-hidden
                  >
                    {n}
                  </span>
                  <span>{L(`${g.key}_${n}`)}</span>
                </li>
              ))}
            </ol>
          </div>
        </details>
      ))}
    </div>
  );
}
