"use client";

import { BrandLogoImage } from "@/components/BrandLogoImage";
import { BrandWordmark } from "@/components/BrandWordmark";

export type BetaWelcomeModalProps = {
  open: boolean;
  t: Record<string, string>;
  onStartTour: () => void;
  onSkipToDashboard: () => void;
};

const L = (dict: Record<string, string>, key: string, fb: string) => dict[key] ?? fb;

export function BetaWelcomeModal({ open, t, onStartTour, onSkipToDashboard }: BetaWelcomeModalProps) {
  if (!open) return null;

  const closeAndMark = (fn: () => void) => {
    try {
      localStorage.setItem("machinpro_beta_welcomed", "true");
    } catch {
      /* ignore */
    }
    fn();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-welcome-title"
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex flex-col items-center text-center gap-3">
          <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-16 w-16" sizes="64px" />
          <div className="dark:hidden">
            <BrandWordmark tone="onLight" className="text-xl font-bold" />
          </div>
          <div className="hidden dark:block">
            <BrandWordmark tone="onDark" className="text-xl font-bold" />
          </div>
          <h2 id="beta-welcome-title" className="text-lg font-semibold text-zinc-900 dark:text-white">
            {L(t, "beta_welcome_title", "¡Bienvenido a la beta privada de MachinPro!")}
          </h2>
          <p className="text-sm text-amber-800 dark:text-amber-200/90">
            {L(
              t,
              "beta_welcome_subtitle",
              "Eres uno de los 20 founders que acceden antes del lanzamiento público."
            )}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {L(
              t,
              "beta_welcome_body",
              "Tu feedback es muy valioso para nosotros. Usa el botón de feedback en cualquier momento para enviarnos sugerencias o reportar problemas."
            )}
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <button
            type="button"
            className="min-h-[44px] flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 sm:flex-none sm:min-w-[160px]"
            onClick={() => closeAndMark(onStartTour)}
          >
            {L(t, "beta_welcome_start_tour", "Empezar el tour")}
          </button>
          <button
            type="button"
            className="min-h-[44px] flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-100 dark:hover:bg-slate-700 sm:flex-none sm:min-w-[160px]"
            onClick={() => closeAndMark(onSkipToDashboard)}
          >
            {L(t, "beta_welcome_skip", "Ir al dashboard")}
          </button>
        </div>
      </div>
    </div>
  );
}
