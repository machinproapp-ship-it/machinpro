"use client";

import { useState } from "react";

export type TranslationEntry = Record<string, string>;

export interface OnboardingModalProps {
  onComplete: () => void;
  onGoToSettings: () => void;
  labels: TranslationEntry;
  companyName?: string;
}

export function OnboardingModal({
  onComplete,
  onGoToSettings,
  labels,
}: OnboardingModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      emoji: "🌍",
      title: labels.onboarding1Title ?? "Configura tu pais",
      description:
        labels.onboarding1Desc ??
        "Selecciona tu pais y Machinpro configurara automaticamente tu moneda, sistema de medida y etiquetas fiscales.",
      tip:
        labels.onboarding1Tip ??
        "Puedes cambiarlo en cualquier momento desde Ajustes.",
    },
    {
      emoji: "👷",
      title: labels.onboarding2Title ?? "Anade tu equipo",
      description:
        labels.onboarding2Desc ??
        "Crea roles personalizados y asigna permisos especificos a cada miembro de tu equipo.",
      tip:
        labels.onboarding2Tip ??
        "Ve a Central > Roles y Permisos para empezar.",
    },
    {
      emoji: "🏗️",
      title: labels.onboarding3Title ?? "Crea tu primera obra",
      description:
        labels.onboarding3Desc ??
        "Anade proyectos con GPS, presupuesto y empleados asignados. Sube planos y empieza el seguimiento de horas.",
      tip:
        labels.onboarding3Tip ??
        "El Clock-in registrara si el empleado esta en la obra.",
    },
    {
      emoji: "✅",
      title: labels.onboarding4Title ?? "Todo listo!",
      description:
        labels.onboarding4Desc ??
        "Completa tu perfil en Ajustes: sube tu logo, confirma el nombre de empresa y configura los campos de compliance.",
      tip: null,
    },
  ];

  const slide = slides[currentSlide];
  const prevSlide = () => setCurrentSlide((s) => Math.max(0, s - 1));
  const nextSlide = () => setCurrentSlide((s) => Math.min(3, s + 1));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${
                i === currentSlide ? "w-6 h-2 bg-amber-500" : "w-2 h-2 bg-zinc-300 dark:bg-zinc-600"
              }`}
              aria-hidden
            />
          ))}
        </div>

        {/* Slide content */}
        <div className="p-8 text-center space-y-4">
          <div className="text-6xl" aria-hidden>
            {slide.emoji}
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {slide.title}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {slide.description}
          </p>
          {slide.tip && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-700 dark:text-amber-400 text-left">
              {slide.tip}
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="px-8 pb-8 flex gap-3">
          {currentSlide > 0 && (
            <button
              type="button"
              onClick={prevSlide}
              className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400 min-h-[44px]"
            >
              {labels.back ?? "Atras"}
            </button>
          )}
          {currentSlide < 3 ? (
            <button
              type="button"
              onClick={nextSlide}
              className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white py-3 text-sm font-semibold min-h-[44px] transition-colors"
            >
              {labels.next ?? "Siguiente"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onComplete();
                onGoToSettings();
              }}
              className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white py-3 text-sm font-semibold min-h-[44px] transition-colors"
            >
              {labels.goToSettings ?? "Ir a Ajustes para completar perfil"}
            </button>
          )}
        </div>

        {/* Skip */}
        <div className="text-center pb-4">
          <button
            type="button"
            onClick={onComplete}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            {labels.skipOnboarding ?? "Omitir por ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}
