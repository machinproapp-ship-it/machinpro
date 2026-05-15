"use client";

/**
 * Placeholder while a heavy sidebar module loads (next/dynamic).
 * Boxy layout to reduce CLS vs a single bar.
 */
export function ModuleRouteSkeleton({ label }: { label?: string }) {
  return (
    <div
      className="min-h-[min(70vh,560px)] space-y-5 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/35"
      aria-busy="true"
      role="status"
    >
      {label ? <span className="sr-only">{label}</span> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-8 w-44 max-w-[55%] animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[120px] animate-pulse rounded-xl border border-zinc-200/80 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/50"
          >
            <div className="mb-3 h-5 w-3/5 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="space-y-2">
              <div className="h-3 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl border border-zinc-200/80 bg-white/60 dark:border-zinc-700 dark:bg-zinc-950/40" />
    </div>
  );
}
