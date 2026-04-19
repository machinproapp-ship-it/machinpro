"use client";

import type { ReactNode } from "react";

export function ModuleEmptyState(props: {
  illustration: ReactNode;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { illustration, title, message, actionLabel, onAction } = props;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-12 text-center dark:border-slate-600 dark:bg-slate-900/35 sm:py-14">
      <div className="text-zinc-400 dark:text-zinc-500 [&_svg]:mx-auto" aria-hidden>
        {illustration}
      </div>
      {title ? (
        <h3 className="mt-4 max-w-md text-base font-semibold text-zinc-900 dark:text-white">{title}</h3>
      ) : null}
      <p
        className={`max-w-md text-sm text-zinc-600 dark:text-zinc-400 ${title ? "mt-2" : "mt-4"}`}
      >
        {message}
      </p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyIllustrationPeople() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
      <ellipse cx="60" cy="88" rx="44" ry="6" className="fill-zinc-200 dark:fill-slate-700" />
      <circle cx="44" cy="36" r="14" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2" fill="none" />
      <path d="M28 62c0-10 7-18 16-18s16 8 16 18" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2" fill="none" />
      <circle cx="76" cy="36" r="14" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2" fill="none" />
      <path d="M60 62c0-10 7-18 16-18s16 8 16 18" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function EmptyIllustrationFolder() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
      <ellipse cx="60" cy="88" rx="44" ry="6" className="fill-zinc-200 dark:fill-slate-700" />
      <path
        d="M24 34h22l8 8h42v40H24V34z"
        className="stroke-zinc-400 dark:stroke-zinc-500"
        strokeWidth="2"
        fill="none"
      />
      <path d="M24 42h72" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2" />
    </svg>
  );
}

export function EmptyIllustrationBox() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
      <ellipse cx="60" cy="88" rx="44" ry="6" className="fill-zinc-200 dark:fill-slate-700" />
      <path
        d="M36 48l24-12 24 12v28H36V48z"
        className="stroke-zinc-400 dark:stroke-zinc-500"
        strokeWidth="2"
        fill="none"
      />
      <path d="M36 48l24 12 24-12" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2" />
    </svg>
  );
}

export function EmptyIllustrationForm() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
      <ellipse cx="60" cy="88" rx="44" ry="6" className="fill-zinc-200 dark:fill-slate-700" />
      <rect x="28" y="22" width="64" height="52" rx="6" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2" fill="none" />
      <path d="M38 38h44M38 50h32M38 62h40" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2" />
    </svg>
  );
}

export function ListSkeletonCards({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2" aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-[72px] animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-slate-700 dark:bg-slate-800 sm:h-20"
        />
      ))}
    </div>
  );
}
