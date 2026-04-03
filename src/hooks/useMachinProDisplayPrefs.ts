"use client";

import { useEffect, useState } from "react";

/**
 * Re-render when user changes date/time display prefs in Settings (same tab)
 * or in another tab (storage). Use as: void useMachinProDisplayPrefs();
 */
export function useMachinProDisplayPrefs(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((n) => n + 1);
    window.addEventListener("machinpro-display-prefs", bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener("machinpro-display-prefs", bump);
      window.removeEventListener("storage", bump);
    };
  }, []);
  return v;
}
