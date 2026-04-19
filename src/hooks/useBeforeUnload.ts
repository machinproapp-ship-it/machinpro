"use client";

import { useEffect } from "react";

/** Warn when closing tab or reloading if `dirty` is true (native `beforeunload`). */
export function useBeforeUnload(dirty: boolean, message?: string): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = typeof message === "string" ? message : "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, message]);
}
