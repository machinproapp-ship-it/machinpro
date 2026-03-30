"use client";

import { type ReactNode } from "react";

export const BRAND_GOLD = "#C9A84C";

export type BrandWordmarkTone = "onDark" | "onLight" | "inherit";

export function BrandWordmark({
  tone,
  className = "",
}: {
  tone: BrandWordmarkTone;
  className?: string;
}) {
  const letterClass =
    tone === "onDark"
      ? "text-white"
      : tone === "onLight"
        ? "text-slate-900 dark:text-white"
        : "text-inherit";
  return (
    <span className={className}>
      <span className={`font-bold ${letterClass}`}>Machin</span>
      <span className={`font-bold ${letterClass}`}>
        Pr<span style={{ color: BRAND_GOLD }}>o</span>
      </span>
    </span>
  );
}

const BRAND_NAME = "MachinPro";

/** Replaces every "MachinPro" in `text` with a colored wordmark. */
export function TextWithBrandMarks({
  text,
  tone,
  className = "",
}: {
  text: string;
  tone: BrandWordmarkTone;
  className?: string;
}) {
  if (!text.includes(BRAND_NAME)) {
    return <span className={className}>{text}</span>;
  }
  const chunks: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length > 0) {
    const idx = rest.indexOf(BRAND_NAME);
    if (idx === -1) {
      chunks.push(rest);
      break;
    }
    if (idx > 0) chunks.push(rest.slice(0, idx));
    chunks.push(<BrandWordmark key={key++} tone={tone} className="inline" />);
    rest = rest.slice(idx + BRAND_NAME.length);
  }
  return <span className={className}>{chunks}</span>;
}
