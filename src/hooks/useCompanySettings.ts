"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_COMPANY_SETTINGS,
  normalizeCompanySettings,
  type CompanySettingsJson,
} from "@/lib/companySettingsTypes";

const LS_VACATION = (cid: string) => `machinpro_default_vacation_days_${cid}`;
const LS_WEEKLY_CAP = (cid: string) => `machinpro_weekly_regular_cap_${cid}`;
const LS_WEEKLY_GOAL = (cid: string) => `machinpro_weekly_hours_goal_${cid}`;
const LS_DASH_WIDGETS = (cid: string) => `machinpro_dashboard_widgets_${cid}`;
const LS_DASH_GLOBAL = "machinpro_dashboard_widget_order";

async function patchSettings(
  companyId: string,
  token: string,
  body: Record<string, unknown>
): Promise<CompanySettingsJson | null> {
  const res = await fetch("/api/company/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ companyId, ...body }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { settings?: CompanySettingsJson };
  return j.settings ? normalizeCompanySettings(j.settings) : null;
}

/**
 * Lee/escribe `companies.settings` vía API; migra claves legacy de localStorage una sola vez.
 */
export function useCompanySettings(companyId: string | null, accessToken: string | null) {
  const [settings, setSettings] = useState<CompanySettingsJson>({});
  const [isLoading, setIsLoading] = useState(true);
  const migratedRef = useRef(false);

  const load = useCallback(async () => {
    if (!companyId?.trim() || !accessToken?.trim()) {
      setSettings({});
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/company/settings?companyId=${encodeURIComponent(companyId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!res.ok) {
        setSettings({});
        return;
      }
      const j = (await res.json()) as { settings?: unknown };
      let s = normalizeCompanySettings(j.settings);

      if (!migratedRef.current && typeof window !== "undefined") {
        migratedRef.current = true;
        const merge: Partial<CompanySettingsJson> = {};
        try {
          if (s.defaultVacationDays === undefined) {
            const raw = localStorage.getItem(LS_VACATION(companyId));
            if (raw) {
              const n = parseInt(raw, 10);
              if (Number.isFinite(n) && n >= 0 && n <= 366) merge.defaultVacationDays = n;
            }
          }
          if (s.weeklyHoursGoal === undefined) {
            const rawG = localStorage.getItem(LS_WEEKLY_GOAL(companyId));
            const rawC = localStorage.getItem(LS_WEEKLY_CAP(companyId));
            const raw = rawG ?? rawC;
            if (raw) {
              const n = parseInt(raw, 10);
              if (Number.isFinite(n) && n >= 1 && n <= 168) merge.weeklyHoursGoal = n;
            }
          }
          if (!s.dashboardWidgets?.length) {
            const rawScoped = localStorage.getItem(LS_DASH_WIDGETS(companyId));
            const rawGlobal = localStorage.getItem(LS_DASH_GLOBAL);
            const raw = rawScoped ?? rawGlobal;
            if (raw) {
              const arr = JSON.parse(raw) as unknown;
              if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) {
                merge.dashboardWidgets = arr as string[];
              }
            }
          }
        } catch {
          /* ignore */
        }
        if (Object.keys(merge).length > 0) {
          const merged = await patchSettings(companyId, accessToken, { merge });
          if (merged) {
            s = merged;
            try {
              localStorage.removeItem(LS_VACATION(companyId));
              localStorage.removeItem(LS_WEEKLY_CAP(companyId));
              localStorage.removeItem(LS_WEEKLY_GOAL(companyId));
              localStorage.removeItem(LS_DASH_WIDGETS(companyId));
              localStorage.removeItem(LS_DASH_GLOBAL);
            } catch {
              /* ignore */
            }
          }
        }
      }

      setSettings(s);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, accessToken]);

  useEffect(() => {
    migratedRef.current = false;
    void load();
  }, [load]);

  const updateSetting = useCallback(
    async (key: keyof CompanySettingsJson, value: unknown): Promise<boolean> => {
      if (!companyId?.trim() || !accessToken?.trim()) return false;
      const next = await patchSettings(companyId, accessToken, { key, value });
      if (!next) return false;
      setSettings(next);
      return true;
    },
    [companyId, accessToken]
  );

  const defaults = DEFAULT_COMPANY_SETTINGS;

  return {
    settings,
    isLoading,
    reload: load,
    updateSetting,
    defaultVacationDays: settings.defaultVacationDays ?? defaults.defaultVacationDays,
    weeklyHoursGoal: settings.weeklyHoursGoal ?? defaults.weeklyHoursGoal,
    dashboardWidgets: settings.dashboardWidgets ?? [],
  };
}
