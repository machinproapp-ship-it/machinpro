/**
 * Guías paso a paso: lista, enlaces y qué guía explica cada parte de la app.
 * Sin React, para usarlo también en el servidor (correos de bienvenida).
 */
export const HELP_GUIDES: { key: string; steps: number }[] = [
  { key: "guide_roles", steps: 6 },
  { key: "guide_clock", steps: 8 },
  { key: "guide_shifts", steps: 6 },
  { key: "guide_daily", steps: 8 },
  { key: "guide_requests", steps: 6 },
  { key: "guide_tools", steps: 8 },
  { key: "guide_visitors", steps: 6 },
  { key: "guide_safety", steps: 6 },
  { key: "guide_docs", steps: 5 },
];

const HELP_LANGS = new Set(["es", "en", "fr", "de", "it", "pt"]);

/** Enlace a una guía en machin.pro/help, en el idioma del usuario (o inglés si no está entre los 6 base). */
export function helpGuideHref(language: string | null | undefined, key: string, origin = ""): string {
  const lang = language && HELP_LANGS.has(language) ? language : "en";
  return `${origin}/help?lang=${lang}#${key}`;
}

/** Qué guías explican cada parte de la app (botón "?" de cada módulo). */
export const MODULE_GUIDES: Record<string, string[]> = {
  office: ["guide_roles", "guide_docs"],
  employees: ["guide_roles", "guide_docs"],
  schedule: ["guide_clock", "guide_shifts"],
  site: ["guide_daily", "guide_requests", "guide_visitors"],
  warehouse: ["guide_tools", "guide_requests"],
  security: ["guide_safety", "guide_docs"],
  forms: ["guide_daily"],
  settings: ["guide_roles", "guide_docs"],
};
