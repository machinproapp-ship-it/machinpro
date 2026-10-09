"use client";

import { useEffect, useState } from "react";
import { fetchInspectionTemplates, INSPECTION_FREQUENCIES, templateLabel, type InspectionTemplate } from "@/lib/inspections";
import type { InspectionFrequency } from "@/lib/logisticsDb";

export type InspectionSettingsValue = {
  requiresInspection?: boolean;
  inspectionFrequency?: InspectionFrequency;
  inspectionTemplateId?: string;
};

let cache: Promise<InspectionTemplate[]> | null = null;
function loadTemplatesOnce(): Promise<InspectionTemplate[]> {
  if (!cache) cache = fetchInspectionTemplates().catch(() => {
    cache = null;
    return [];
  });
  return cache;
}

const freqKey: Record<InspectionFrequency, string> = {
  before_each_use: "freq_before_each_use",
  daily: "freq_daily",
  weekly: "freq_weekly",
  monthly: "freq_monthly",
  yearly: "freq_yearly",
};
const freqFallback: Record<InspectionFrequency, string> = {
  before_each_use: "Antes de cada uso",
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
};

/** Campos "Requiere inspección / frecuencia / plantilla" para inventario, flota y alquileres. */
export function InspectionSettingsFields({
  value,
  onChange,
  labels: t,
  disabled,
}: {
  value: InspectionSettingsValue;
  onChange: (next: InspectionSettingsValue) => void;
  labels: Record<string, string>;
  disabled?: boolean;
}) {
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  useEffect(() => {
    let alive = true;
    void loadTemplatesOnce().then((list) => alive && setTemplates(list));
    return () => {
      alive = false;
    };
  }, []);

  const field = "min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-100";

  return (
    <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-900/50 dark:bg-orange-950/20">
      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        <input
          type="checkbox"
          disabled={disabled}
          checked={!!value.requiresInspection}
          onChange={(e) =>
            onChange({
              ...value,
              requiresInspection: e.target.checked,
              inspectionFrequency: e.target.checked ? value.inspectionFrequency ?? "before_each_use" : value.inspectionFrequency,
            })
          }
          className="h-5 w-5 accent-orange-600"
        />
        {t.inspectionRequired ?? "Requiere inspección antes de usar"}
      </label>
      {value.requiresInspection ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">{t.inspectionFrequency ?? "Frecuencia"}</label>
            <select
              disabled={disabled}
              value={value.inspectionFrequency ?? "before_each_use"}
              onChange={(e) => onChange({ ...value, inspectionFrequency: e.target.value as InspectionFrequency })}
              className={field}
            >
              {INSPECTION_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {t[freqKey[f]] ?? freqFallback[f]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">{t.inspectionTemplate ?? "Plantilla de inspección"}</label>
            <select
              disabled={disabled}
              value={value.inspectionTemplateId ?? ""}
              onChange={(e) => onChange({ ...value, inspectionTemplateId: e.target.value || undefined })}
              className={field}
            >
              <option value="">{t.inspectionTemplateChooseLater ?? "Elegir al inspeccionar"}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {templateLabel(tpl, t)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
