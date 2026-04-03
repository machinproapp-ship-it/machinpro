"use client";

import { useEffect } from "react";

/** Calls onClose when Escape is pressed while `open` is true. */
export function useDismissOnEscape(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
}
