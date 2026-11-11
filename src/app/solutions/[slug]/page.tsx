import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalSimpleNav } from "@/components/LegalSimpleNav";
import { LegalSimpleFooter } from "@/components/LegalSimpleFooter";
import { SOLUTIONS, SOLUTION_UI, findSolution, type SolutionLang } from "@/content/solutions";

const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://machin.pro").replace(/\/$/, "");

type Params = { slug: string };
type Search = { lang?: string };

export const dynamicParams = false;

const pickLang = (raw?: string, fallback: SolutionLang = "en"): SolutionLang =>
  raw === "es" ? "es" : raw === "en" ? "en" : fallback;

export function generateStaticParams(): Params[] {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { lang } = await searchParams;
  const sol = findSolution(slug);
  if (!sol) return {};
  const l = pickLang(lang, sol.defaultLang);
  const def = sol.defaultLang ?? "en";
  const c = sol.content[l];
  const url = `${site}/solutions/${slug}${l === def ? "" : `?lang=${l}`}`;
  return {
    metadataBase: new URL(site),
    title: c.title,
    description: c.description,
    alternates: {
      canonical: url,
      languages: {
        en: `${site}/solutions/${slug}${def === "en" ? "" : "?lang=en"}`,
        es: `${site}/solutions/${slug}${def === "es" ? "" : "?lang=es"}`,
      },
    },
    openGraph: { title: c.title, description: c.description, url, siteName: "MachinPro", type: "website" },
  };
}

export default async function SolutionPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const sol = findSolution(slug);
  if (!sol) notFound();
  const def = sol.defaultLang ?? "en";
  const l = pickLang(lang, def);
  const c = sol.content[l];
  const ui = SOLUTION_UI[l];
  const others = SOLUTIONS.filter((s) => s.slug !== slug);
  const linkTo = (o: { slug: string; defaultLang?: SolutionLang }) =>
    `/solutions/${o.slug}${l === (o.defaultLang ?? "en") ? "" : `?lang=${l}`}`;

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100" lang={l}>
      <LegalSimpleNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div className="flex justify-end">
          <Link
            href={`/solutions/${slug}${(l === "es" ? "en" : "es") === def ? "" : `?lang=${l === "es" ? "en" : "es"}`}`}
            hrefLang={l === "es" ? "en" : "es"}
            className="inline-flex min-h-[44px] items-center text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            {ui.switchLang}
          </Link>
        </div>
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">{c.kicker}</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{c.h1}</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">{c.intro}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/register"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-amber-600 px-6 text-base font-semibold text-white hover:bg-amber-500"
          >
            {ui.cta}
          </Link>
          <p className="text-sm text-slate-500 dark:text-slate-400">{ui.ctaSub}</p>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-bold">{c.problemsTitle}</h2>
          <ul className="mt-4 space-y-2">
            {c.problems.map((p) => (
              <li
                key={p}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">{c.stepsTitle}</h2>
          <ol className="mt-4 space-y-4">
            {c.steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="text-lg font-bold">{ui.planTitle}</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{c.plan}</p>
          <Link
            href="/pricing"
            className="mt-3 inline-flex min-h-[44px] items-center font-semibold text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
          >
            {ui.seePricing} →
          </Link>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">{ui.faqTitle}</h2>
          <div className="mt-4 space-y-3">
            {c.faq.map((f) => (
              <details
                key={f.q}
                className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"
              >
                <summary className="min-h-[28px] cursor-pointer font-medium">{f.q}</summary>
                <p className="mt-2 text-slate-600 dark:text-slate-300">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-slate-900 p-6 text-white dark:bg-slate-800">
          <p className="text-xl font-bold">{c.h1}</p>
          <Link
            href="/register"
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-amber-600 px-6 font-semibold text-white hover:bg-amber-500"
          >
            {ui.cta}
          </Link>
          <p className="mt-2 text-sm text-slate-300">{ui.ctaSub}</p>
        </section>

        <nav className="mt-12" aria-label={ui.otherTitle}>
          <h2 className="text-lg font-bold">{ui.otherTitle}</h2>
          <ul className="mt-3 space-y-1">
            {others.map((o) => (
              <li key={o.slug}>
                <Link
                  href={linkTo(o)}
                  className="inline-flex min-h-[44px] items-center text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
                >
                  {o.content[l].h1}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
      <LegalSimpleFooter />
    </div>
  );
}
