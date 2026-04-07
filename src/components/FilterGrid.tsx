"use client";

import type { ReactNode } from "react";

/**
 * Responsive filter layout: 2 columns on mobile, up to 4 on large screens.
 * Use `col-span-2` on a child for full-width rows (e.g. date range or search).
 */
export function FilterGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`grid w-full min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
