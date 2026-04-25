"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LANGUAGES } from "@/lib/i18n";
import type { Language } from "@/types/shared";

export type LandingLanguageSelectProps = {
  value: Language;
  onChange: (lang: Language) => void;
  /** Hero nav (semi-transparent over gradient) vs scrolled solid bar */
  navSolid: boolean;
  ariaLabel: string;
};

export function LandingLanguageSelect({
  value,
  onChange,
  navSolid,
  ariaLabel,
}: LandingLanguageSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listboxId = useId();

  const current = LANGUAGES.find((l) => l.code === value) ?? LANGUAGES[0];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const triggerClasses = navSolid
    ? "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/90"
    : "border-white/35 bg-white/15 text-white hover:bg-white/20";

  const panelClasses =
    "absolute left-0 md:left-auto md:right-0 z-[60] mt-1 max-h-[min(70vh,26rem)] w-[min(calc(100vw-2rem),18rem)] overflow-y-auto overscroll-contain rounded-lg border py-1 shadow-xl " +
    (navSolid
      ? "border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900"
      : "border-white/20 bg-[#0f3a45] dark:border-slate-600 dark:bg-slate-900");

  const itemBase =
    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors min-h-[44px] ";
  const itemIdle = navSolid
    ? "text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
    : "text-white hover:bg-white/15 dark:hover:bg-slate-800";
  const itemSelected = navSolid
    ? "bg-teal-50 font-semibold text-teal-900 dark:bg-teal-950/50 dark:text-teal-100"
    : "bg-white/20 font-semibold dark:bg-teal-950/40";

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        id={`${listboxId}-trigger`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${listboxId}-listbox`}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex min-h-[44px] w-full min-w-[10.5rem] max-w-[18rem] items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-sm font-semibold shadow-sm transition-colors sm:min-w-[12rem] ${triggerClasses}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          <span className="shrink-0 text-base leading-none" aria-hidden>
            {current.flag}
          </span>
          <span className="min-w-0 truncate">
            <span className="font-mono text-xs opacity-80">{current.code.toUpperCase()}</span>
            <span className="mx-1 opacity-60" aria-hidden>
              ·
            </span>
            <span>{current.label}</span>
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 opacity-80 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          id={`${listboxId}-listbox`}
          role="listbox"
          aria-labelledby={`${listboxId}-trigger`}
          className={panelClasses}
        >
          {LANGUAGES.map((l) => {
            const sel = l.code === value;
            return (
              <li key={l.code} role="presentation" className="px-0.5">
                <button
                  type="button"
                  role="option"
                  aria-selected={sel}
                  className={`${itemBase} ${sel ? itemSelected : itemIdle} rounded-md`}
                  onClick={() => {
                    onChange(l.code);
                    setOpen(false);
                    btnRef.current?.focus();
                  }}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {l.flag}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-xs opacity-75">{l.code.toUpperCase()}</span>
                    <span className="mx-1 opacity-50" aria-hidden>
                      ·
                    </span>
                    {l.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
