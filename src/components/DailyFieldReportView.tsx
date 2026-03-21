"use client";

import { useState, useCallback, useMemo } from "react";
import { ChevronDown, ChevronUp, FileDown, Plus, Trash2 } from "lucide-react";
import type {
  DailyFieldReport,
  LaborEntry,
  MaterialEntry,
  EquipmentEntry,
  WeatherCondition,
} from "@/types/dailyFieldReport";
import { generateDailyFieldReportPdf } from "@/lib/generateDailyFieldReportPdf";

const WEATHER_OPTIONS: { value: WeatherCondition; emoji: string }[] = [
  { value: "sunny", emoji: "☀️" },
  { value: "cloudy", emoji: "☁️" },
  { value: "rainy", emoji: "🌧️" },
  { value: "windy", emoji: "💨" },
  { value: "snowy", emoji: "❄️" },
  { value: "foggy", emoji: "🌫️" },
];

const MATERIAL_UNITS = ["m³", "m²", "kg", "ton", "units", "bags", "L", "m", "ea"];

function weatherButtonLabel(w: WeatherCondition, tl: Record<string, string>): string {
  const m: Record<WeatherCondition, string> = {
    sunny: tl.weatherSunny ?? "Sunny",
    cloudy: tl.weatherCloudy ?? "Cloudy",
    rainy: tl.weatherRainy ?? "Rainy",
    windy: tl.weatherWindy ?? "Windy",
    snowy: tl.weatherSnowy ?? "Snowy",
    foggy: tl.weatherFoggy ?? "Foggy",
  };
  return m[w] ?? w;
}

function createEmptyReport(params: {
  projectId: string;
  projectName: string;
  companyId: string;
  createdBy: string;
  createdByName: string;
}): DailyFieldReport {
  const now = new Date().toISOString();
  return {
    id: `dfr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    projectId: params.projectId,
    projectName: params.projectName,
    companyId: params.companyId,
    date: new Date().toISOString().slice(0, 10),
    weatherCondition: "sunny",
    workPerformed: "",
    plannedWork: "",
    laborEntries: [],
    materialEntries: [],
    equipmentEntries: [],
    visitors: "",
    delays: "",
    safetyIncidents: "",
    inspections: "",
    notes: "",
    status: "draft",
    createdBy: params.createdBy,
    createdByName: params.createdByName,
    createdAt: now,
  };
}

export type DailyFieldReportViewProps = {
  report: DailyFieldReport | null;
  projectId: string;
  projectName: string;
  companyName: string;
  companyId: string;
  employees: { id: string; name: string; role: string }[];
  currentUserName: string;
  currentUserEmployeeId?: string;
  language: string;
  labels: Record<string, string>;
  countryCode?: string;
  companyLogoUrl?: string;
  onSave: (report: DailyFieldReport) => void;
  onBack: () => void;
};

export function DailyFieldReportView({
  report,
  projectId,
  projectName,
  companyName,
  companyId,
  employees,
  currentUserName,
  currentUserEmployeeId = "",
  language,
  labels: rawLabels,
  countryCode = "CA",
  companyLogoUrl,
  onSave,
  onBack,
}: DailyFieldReportViewProps) {
  const tl = rawLabels as Record<string, string>;
  const tempUnit = countryCode === "US" ? "F" : "C";

  const [draft, setDraft] = useState<DailyFieldReport>(() =>
    report
      ? { ...report }
      : createEmptyReport({
          projectId,
          projectName,
          companyId,
          createdBy: currentUserEmployeeId,
          createdByName: currentUserName,
        })
  );

  const [weatherOpen, setWeatherOpen] = useState(true);

  const totalLaborHours = useMemo(
    () => draft.laborEntries.reduce((s, r) => s + (Number(r.hoursWorked) || 0), 0),
    [draft.laborEntries]
  );

  const updateDraft = useCallback((patch: Partial<DailyFieldReport>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const addLabor = useCallback(() => {
    const row: LaborEntry = {
      id: `lab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      employeeName: "",
      role: "",
      hoursWorked: 0,
      overtime: 0,
    };
    setDraft((d) => ({ ...d, laborEntries: [...d.laborEntries, row] }));
  }, []);

  const updateLabor = useCallback((id: string, patch: Partial<LaborEntry>) => {
    setDraft((d) => ({
      ...d,
      laborEntries: d.laborEntries.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }, []);

  const removeLabor = useCallback((id: string) => {
    setDraft((d) => ({ ...d, laborEntries: d.laborEntries.filter((r) => r.id !== id) }));
  }, []);

  const addMaterial = useCallback(() => {
    const row: MaterialEntry = {
      id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      description: "",
      quantity: 0,
      unit: "units",
    };
    setDraft((d) => ({ ...d, materialEntries: [...d.materialEntries, row] }));
  }, []);

  const updateMaterial = useCallback((id: string, patch: Partial<MaterialEntry>) => {
    setDraft((d) => ({
      ...d,
      materialEntries: d.materialEntries.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }, []);

  const removeMaterial = useCallback((id: string) => {
    setDraft((d) => ({ ...d, materialEntries: d.materialEntries.filter((r) => r.id !== id) }));
  }, []);

  const addEquipment = useCallback(() => {
    const row: EquipmentEntry = {
      id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: "",
      hoursUsed: 0,
    };
    setDraft((d) => ({ ...d, equipmentEntries: [...d.equipmentEntries, row] }));
  }, []);

  const updateEquipment = useCallback((id: string, patch: Partial<EquipmentEntry>) => {
    setDraft((d) => ({
      ...d,
      equipmentEntries: d.equipmentEntries.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }, []);

  const removeEquipment = useCallback((id: string) => {
    setDraft((d) => ({ ...d, equipmentEntries: d.equipmentEntries.filter((r) => r.id !== id) }));
  }, []);

  const handleSaveDraft = useCallback(() => {
    onSave({ ...draft, status: "draft" });
  }, [draft, onSave]);

  const handleSubmit = useCallback(() => {
    onSave({
      ...draft,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    });
  }, [draft, onSave]);

  const handlePdf = useCallback(() => {
    generateDailyFieldReportPdf({
      report: draft,
      companyName,
      companyLogoUrl,
      language,
      labels: tl,
      tempUnit,
    });
  }, [draft, companyName, companyLogoUrl, language, tl, tempUnit]);

  const statusBadge =
    draft.status === "draft"
      ? { text: tl.reportStatusDraft ?? tl.formStatusDraft ?? "Draft", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200" }
      : draft.status === "submitted"
        ? {
            text: tl.reportStatusSubmitted ?? "Submitted",
            className: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
          }
        : {
            text: tl.reportStatusApproved ?? "Approved",
            className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
          };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex min-h-[44px] items-center gap-1 text-sm text-amber-600 dark:text-amber-400"
        >
          ← {tl.back ?? "Back"}
        </button>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {tl.dailyFieldReport ?? "Daily Field Report"} — {projectName}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{companyName}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge.className}`}>
            {statusBadge.text}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{tl.checklistDate ?? tl.date ?? "Date"}</span>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => updateDraft({ date: e.target.value })}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
            />
          </label>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-slate-800/50">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{tl.preparedBy ?? "Prepared by"}</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">{draft.createdByName || currentUserName}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
        {/* Weather */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setWeatherOpen((o) => !o)}
            className="flex w-full min-h-[44px] items-center justify-between px-4 py-3 text-left font-medium text-zinc-900 dark:text-white"
          >
            {tl.weatherSection ?? "Weather"}
            {weatherOpen ? <ChevronUp className="h-5 w-5 shrink-0" aria-hidden /> : <ChevronDown className="h-5 w-5 shrink-0" aria-hidden />}
          </button>
          {weatherOpen && (
            <div className="space-y-4 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
              <div className="flex flex-wrap gap-2">
                {WEATHER_OPTIONS.map(({ value, emoji }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateDraft({ weatherCondition: value })}
                    className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center rounded-xl border-2 px-2 py-2 text-xs sm:flex-initial sm:min-w-[100px] ${
                      draft.weatherCondition === value
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40"
                        : "border-zinc-200 dark:border-zinc-600"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>
                      {emoji}
                    </span>
                    <span className="mt-0.5 text-center leading-tight">{weatherButtonLabel(value, tl)}</span>
                  </button>
                ))}
              </div>
              <label className="block text-sm">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {tl.temperature ?? "Temperature"} (°{tempUnit})
                </span>
                <input
                  type="number"
                  value={draft.weatherTemp ?? ""}
                  onChange={(e) =>
                    updateDraft({
                      weatherTemp: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-800"
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{tl.weatherNotes ?? tl.checklistComments ?? "Notes"}</span>
                <textarea
                  value={draft.weatherNotes ?? ""}
                  onChange={(e) => updateDraft({ weatherNotes: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-800"
                />
              </label>
            </div>
          )}
        </section>

        <section className="mb-6 space-y-3">
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">{tl.workPerformed ?? ""}</label>
          <textarea
            value={draft.workPerformed}
            onChange={(e) => updateDraft({ workPerformed: e.target.value })}
            rows={5}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-900"
          />
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">{tl.plannedWork ?? ""}</label>
          <textarea
            value={draft.plannedWork}
            onChange={(e) => updateDraft({ plannedWork: e.target.value })}
            rows={4}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-900"
          />
        </section>

        {/* Labor */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-zinc-900 dark:text-white">{tl.laborSection ?? "Labor"}</h2>
            <button
              type="button"
              onClick={addLabor}
              className="flex min-h-[44px] items-center gap-1 rounded-lg border border-amber-500 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300"
            >
              <Plus className="h-4 w-4" /> {tl.addWorker ?? "Add worker"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-700">
                  <th className="py-2 pr-2">{tl.workerName ?? "Name"}</th>
                  <th className="py-2 pr-2">{tl.laborRole ?? tl.roleLabel ?? "Role"}</th>
                  <th className="py-2 pr-2">{tl.hoursWorked ?? ""}</th>
                  <th className="py-2 pr-2">{tl.overtime ?? ""}</th>
                  <th className="py-2 pr-2">{tl.checklistComments ?? "Notes"}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {draft.laborEntries.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-2 align-top">
                      <select
                        value={row.employeeId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "__custom__") {
                            updateLabor(row.id, { employeeId: undefined, employeeName: "" });
                          } else if (v) {
                            const emp = employees.find((x) => x.id === v);
                            updateLabor(row.id, {
                              employeeId: v,
                              employeeName: emp?.name ?? "",
                              role: emp?.role ?? row.role,
                            });
                          }
                        }}
                        className="mb-1 w-full min-h-[40px] rounded-lg border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
                      >
                        <option value="">{tl.selectEmployee ?? "—"}</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                        <option value="__custom__">{tl.customName ?? "Other"}</option>
                      </select>
                      <input
                        type="text"
                        value={row.employeeName}
                        onChange={(e) => updateLabor(row.id, { employeeName: e.target.value, employeeId: undefined })}
                        placeholder={tl.workerName ?? ""}
                        className="w-full min-h-[40px] rounded-lg border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
                        aria-label={tl.workerName ?? "Name"}
                      />
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <input
                        type="text"
                        value={row.role}
                        onChange={(e) => updateLabor(row.id, { role: e.target.value })}
                        className="w-full min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        value={row.hoursWorked}
                        onChange={(e) => updateLabor(row.id, { hoursWorked: Number(e.target.value) })}
                        className="w-20 min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        value={row.overtime}
                        onChange={(e) => updateLabor(row.id, { overtime: Number(e.target.value) })}
                        className="w-20 min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <input
                        type="text"
                        value={row.notes ?? ""}
                        onChange={(e) => updateLabor(row.id, { notes: e.target.value })}
                        className="w-full min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2 align-top">
                      <button
                        type="button"
                        onClick={() => removeLabor(row.id)}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        aria-label={tl["delete"] ?? "Delete"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-right text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {tl.totalHours ?? "Total"}: {totalLaborHours.toFixed(2)}
          </p>
        </section>

        {/* Materials */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-zinc-900 dark:text-white">{tl.materialsSection ?? ""}</h2>
            <button
              type="button"
              onClick={addMaterial}
              className="flex min-h-[44px] items-center gap-1 rounded-lg border border-amber-500 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300"
            >
              <Plus className="h-4 w-4" /> {tl.addMaterial ?? ""}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-700">
                  <th className="py-2 pr-2">{tl.description ?? ""}</th>
                  <th className="py-2 pr-2">{tl.quantity ?? ""}</th>
                  <th className="py-2 pr-2">{tl.unit ?? ""}</th>
                  <th className="py-2 pr-2">{tl.supplier ?? ""}</th>
                  <th className="py-2 pr-2">{tl.checklistComments ?? ""}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {draft.materialEntries.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => updateMaterial(row.id, { description: e.target.value })}
                        className="w-full min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={row.quantity}
                        onChange={(e) => updateMaterial(row.id, { quantity: Number(e.target.value) })}
                        className="w-24 min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={row.unit}
                        onChange={(e) => updateMaterial(row.id, { unit: e.target.value })}
                        className="min-h-[40px] w-full rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      >
                        {MATERIAL_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={row.supplier ?? ""}
                        onChange={(e) => updateMaterial(row.id, { supplier: e.target.value })}
                        className="w-full min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={row.notes ?? ""}
                        onChange={(e) => updateMaterial(row.id, { notes: e.target.value })}
                        className="w-full min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => removeMaterial(row.id)}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-red-500"
                        aria-label={tl["delete"] ?? "Delete"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Equipment */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-zinc-900 dark:text-white">{tl.equipmentSection ?? ""}</h2>
            <button
              type="button"
              onClick={addEquipment}
              className="flex min-h-[44px] items-center gap-1 rounded-lg border border-amber-500 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300"
            >
              <Plus className="h-4 w-4" /> {tl.addEquipment ?? ""}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-700">
                  <th className="py-2 pr-2">{tl.equipmentName ?? ""}</th>
                  <th className="py-2 pr-2">{tl.hoursUsed ?? ""}</th>
                  <th className="py-2 pr-2">{tl.operator ?? ""}</th>
                  <th className="py-2 pr-2">{tl.checklistComments ?? ""}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {draft.equipmentEntries.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateEquipment(row.id, { name: e.target.value })}
                        className="w-full min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        value={row.hoursUsed}
                        onChange={(e) => updateEquipment(row.id, { hoursUsed: Number(e.target.value) })}
                        className="w-24 min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={row.operator ?? ""}
                        onChange={(e) => updateEquipment(row.id, { operator: e.target.value })}
                        className="w-full min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={row.notes ?? ""}
                        onChange={(e) => updateEquipment(row.id, { notes: e.target.value })}
                        className="w-full min-h-[40px] rounded-lg border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => removeEquipment(row.id)}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-red-500"
                        aria-label={tl["delete"] ?? "Delete"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 space-y-3">
          <h2 className="font-semibold text-zinc-900 dark:text-white">{tl.incidentsAndNotes ?? "Notes"}</h2>
          <label className="block text-sm">
            <span className="text-xs text-zinc-500">{tl.visitorsOnSite ?? ""}</span>
            <input
              type="text"
              value={draft.visitors}
              onChange={(e) => updateDraft({ visitors: e.target.value })}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-900"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-zinc-500">{tl.delaysReasons ?? ""}</span>
            <textarea
              value={draft.delays}
              onChange={(e) => updateDraft({ delays: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-900"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-zinc-500">{tl.safetyIncidents ?? ""}</span>
            <textarea
              value={draft.safetyIncidents}
              onChange={(e) => updateDraft({ safetyIncidents: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-900"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-zinc-500">{tl.inspectionsReceived ?? ""}</span>
            <textarea
              value={draft.inspections}
              onChange={(e) => updateDraft({ inspections: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-900"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-zinc-500">{tl.generalNotes ?? ""}</span>
            <textarea
              value={draft.notes}
              onChange={(e) => updateDraft({ notes: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-900"
            />
          </label>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-slate-900/95 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="min-h-[44px] flex-1 rounded-xl border-2 border-zinc-300 px-4 py-3 text-sm font-medium dark:border-zinc-600"
          >
            {tl.saveDraft ?? "Save draft"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="min-h-[44px] flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500"
          >
            {tl.submitReport ?? "Submit"}
          </button>
          <button
            type="button"
            onClick={handlePdf}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white hover:bg-amber-500"
          >
            <FileDown className="h-4 w-4" />
            {tl.printReport ?? "PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
