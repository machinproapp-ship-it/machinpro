"use client";

import { useLandingLocale } from "@/hooks/useLandingLocale";

/** Pulse skeleton placeholders for lazily-loaded landing sections (below the fold). */
export function LandingPricingSkeleton() {
  const { tx } = useLandingLocale();
  const label = tx("landing_loading_pricing", "Loading pricing…");

  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse space-y-8 py-6"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <p className="sr-only">{label}</p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="h-10 w-full max-w-sm rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-10 w-40 rounded-lg bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[260px] rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div className="mx-auto mb-6 h-6 w-2/5 rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="mb-6 h-10 w-[45%] rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-3 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingTestimonialsSkeleton() {
  const { tx } = useLandingLocale();
  const label = tx("landing_loading_testimonials", "Loading testimonials…");

  return (
    <div
      className="mx-auto w-full max-w-6xl animate-pulse space-y-6 py-14 sm:py-16"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <p className="sr-only">{label}</p>
      <div className="mx-auto h-10 w-[min(520px,100%)] rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="mx-auto h-6 w-[min(400px,100%)] rounded-lg bg-slate-200 dark:bg-slate-700" />
      <div className="mt-10 grid min-h-[200px] gap-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="min-h-[220px] rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950/85">
            <div className="flex gap-3">
              <div className="h-11 w-11 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 space-y-2 pt-2">
                <div className="h-5 w-[45%] rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3].map((line) => (
                <div key={line} className="h-3 rounded bg-slate-200 dark:bg-slate-700" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingFeaturesGridSkeleton() {
  const { tx } = useLandingLocale();
  const label = tx("landing_loading_features_grid", "Loading features…");

  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse py-12"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <p className="sr-only">{label}</p>
      <div className="mx-auto mb-12 h-9 w-[min(400px,100%)] rounded-lg bg-slate-200 dark:bg-slate-700" />
      <div className="grid min-h-[200px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[200px] rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/80"
          >
            <div className="flex gap-3 pb-6">
              <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700" />
              <div className="h-6 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            {[0, 1, 2, 3, 4].map((li) => (
              <div key={li} className="mt-3 h-4 rounded bg-slate-200 dark:bg-slate-700" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingFooterSkeleton() {
  const { tx } = useLandingLocale();
  const label = tx("landing_loading_footer", "Loading footer…");

  return (
    <div
      className="mx-auto w-full max-w-6xl animate-pulse py-12"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <p className="sr-only">{label}</p>
      <div className="mb-10 h-4 w-full max-w-xl rounded bg-slate-200 dark:bg-slate-700" />
      <div className="flex flex-col gap-10 md:flex-row md:justify-between">
        <div className="max-w-sm space-y-4">
          <div className="flex gap-3">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700" />
            <div className="h-7 flex-1 rounded-lg bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="h-16 w-full rounded-lg bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="flex flex-wrap gap-10">
          <div className="w-44 space-y-3">
            <div className="h-5 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 rounded bg-slate-200 dark:bg-slate-700" />
            ))}
          </div>
          <div className="w-40 space-y-3">
            <div className="h-5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
            {[0, 1].map((i) => (
              <div key={i} className="h-4 rounded bg-slate-200 dark:bg-slate-700" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
