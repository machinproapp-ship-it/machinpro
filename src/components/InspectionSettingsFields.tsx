"use client";

import { useEffect, useState } from "react";
import { fetchInspectionTemplates, INSPECTION_FREQUENCIES, templateLabel, type InspectionTemplate } from "@/lib/inspections";
import type { InspectionFrequency } from "@/lib/logisticsDb";

export type InspectionSettingsValue = {
  requiresInspection?: boolean;
  inspectionFrequency?: InspectionFrequency;
  inspectionTemplateId?: string;
  /** Vacío = cualquiera puede usarlo e inspeccionarlo. */
  inspectionAllowedRoleIds?: string[];
  inspectionAllowedUserIds?: string[];
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
  roles = [],
  people = [],
}: {
  value: InspectionSettingsValue;
  onChange: (next: InspectionSettingsValue) => void;
  labels: Record<string, string>;
  disabled?: boolean;
  /** Roles de la empresa (para limitar quién puede usar este equipo). */
  roles?: { id: string; name: string }[];
  /** Personas de la empresa. */
  people?: { id: string; name: string }[];
}) {
  const allowedRoles = value.inspectionAllowedRoleIds ?? [];
  const allowedUsers = value.inspectionAllowedUserIds ?? [];
  const [restricted, setRestricted] = useState(allowedRoles.length > 0 || allowedUsers.length > 0);
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
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
      {value.requiresInspection ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm text-zinc-700 dark:text-zinc-300">
            {t.inspectionWhoCanUse ?? "Who can use and inspect it"}
          </legend>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-600">
              <input
                type="radio"
                disabled={disabled}
                checked={!restricted}
                onChange={() => {
                  setRestricted(false);
                  onChange({ ...value, inspectionAllowedRoleIds: [], inspectionAllowedUserIds: [] });
                }}
                className="h-4 w-4 accent-orange-600"
              />
              {t.inspectionAccessEveryone ?? "Everyone"}
            </label>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-600">
              <input
                type="radio"
                disabled={disabled}
                checked={restricted}
                onChange={() => setRestricted(true)}
                className="h-4 w-4 accent-orange-600"
              />
              {t.inspectionAccessSome ?? "Only some roles or people"}
            </label>
          </div>
          {restricted ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.roles ?? "Roles"}</p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                  {roles.map((r) => (
                    <label key={r.id} className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={allowedRoles.includes(r.id)}
                        onChange={() => onChange({ ...value, inspectionAllowedRoleIds: toggleIn(allowedRoles, r.id) })}
                        className="h-4 w-4 accent-orange-600"
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.inspectionAccessPeople ?? "People"}</p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                  {people.map((p) => (
                    <label key={p.id} className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={allowedUsers.includes(p.id)}
                        onChange={() => onChange({ ...value, inspectionAllowedUserIds: toggleIn(allowedUsers, p.id) })}
                        className="h-4 w-4 accent-orange-600"
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:col-span-2">
                {t.inspectionAccessHint ?? "The admin can always use and inspect it."}
              </p>
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </div>
  );
}
