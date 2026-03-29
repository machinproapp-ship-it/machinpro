"use client";

import type { ReactNode } from "react";

type FadeVariant = "card" | "inherit";

const VARIANT_STOPS: Record<FadeVariant, string> = {
  /** Dark: slate-950 + faint scrim so the fade contrasts with card bg (slate-900). */
  card: "from-white to-transparent dark:from-slate-950 dark:via-slate-950/85 dark:to-transparent",
  inherit: "from-zinc-50 to-transparent dark:from-slate-950/90 dark:via-slate-900/50 dark:to-transparent",
};

/**
 * On narrow viewports, shows a right-edge gradient hint that horizontal content scrolls.
 * Does not affect desktop (md+).
 */
export function HorizontalScrollFade({
  children,
  className = "",
  variant = "card",
}: {
  children: ReactNode;
  className?: string;
  /** Match parent surface: card (white / slate-900) or inherit (transparent gradient stop — use on tinted headers). */
  variant?: FadeVariant;
}) {
  const fade = VARIANT_STOPS[variant];
  return (
    <div className={`relative ${className}`}>
      {children}
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 md:hidden bg-gradient-to-l ${fade}`}
        aria-hidden
      />
    </div>
  );
}
