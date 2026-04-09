"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const DEFAULT_INTERVAL_MS = 300_000;

/**
 * Inserts a row into `gps_tracking` every `intervalMs` while the shift is open.
 * Stops when `entryId` is cleared (clock-out). Browser tab closed = no tracking.
 */
export function useShiftGpsTracking(opts: {
  entryId: string | null;
  companyId: string | null;
  userId: string | null;
  /** User preference + implicit browser permission (getCurrentPosition). */
  enabled: boolean;
  intervalMs?: number;
}): void {
  const { entryId, companyId, userId, enabled, intervalMs = DEFAULT_INTERVAL_MS } = opts;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!entryId || !companyId || !userId || !enabled) return;
    if (typeof window === "undefined" || !navigator.geolocation) return;

    const push = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (!supabase) return;
          const acc = pos.coords.accuracy;
          await supabase.from("gps_tracking").insert({
            entry_id: entryId,
            user_id: userId,
            company_id: companyId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            ...(Number.isFinite(acc) ? { accuracy: acc } : {}),
          });
        },
        () => {
          /* denied or unavailable — skip this tick */
        },
        { enableHighAccuracy: true, timeout: 25_000, maximumAge: 0 }
      );
    };

    timerRef.current = window.setInterval(() => void push(), intervalMs);
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [entryId, companyId, userId, enabled, intervalMs]);
}
