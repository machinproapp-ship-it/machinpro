"use client";

import type { ReactNode } from "react";

/**
 * Responsive filter layout: 2 columns on mobile, up to 4 on large screens.
 * Use `col-span-2` on a child for full-width rows (e.g. date range or search).
 */
export function FilterGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`.trim()}>{children}</div>
  );
}
