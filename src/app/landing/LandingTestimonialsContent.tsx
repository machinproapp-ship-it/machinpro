"use client";

type TxFn = (key: string, fallback: string) => string;

/** Testimonial grid (translations in locales); loaded via dynamic import. */
export function LandingTestimonialsContent({ tx }: { tx: TxFn }) {
  const items = ["1", "2", "3"] as const;

  return (
    <>
      <h2
        id="landing-testimonials-title"
        className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl"
      >
        {tx("landing_testimonials_title", "What teams say")}
      </h2>
      <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-600 dark:text-slate-400 sm:text-base">
        {tx("landing_testimonials_coming", "")}
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {items.map((n) => {
          const initials = tx(`landing_testimonial_${n}_initial`, "");
          const name = tx(`landing_testimonial_${n}_name`, "");
          const company = tx(`landing_testimonial_${n}_company`, "");
          const text = tx(`landing_testimonial_${n}_text`, "");
          return (
            <blockquote
              key={n}
              className="flex min-h-[200px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/85"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1a4f5e]/10 text-base font-semibold text-[#1a4f5e] dark:bg-teal-900/35 dark:text-teal-300"
                  aria-hidden
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{company}</p>
                </div>
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
            </blockquote>
          );
        })}
      </div>
    </>
  );
}
