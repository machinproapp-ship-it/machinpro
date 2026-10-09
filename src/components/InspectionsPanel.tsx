"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, Copy, FileDown, History, ListChecks, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { EquipmentInspectionFlow, type InspectableItemRef } from "@/components/EquipmentInspectionFlow";
import type { InventoryItem, Vehicle } from "@/components/LogisticsModule";
import {
  archiveCompanyTemplate,
  checklistLabel,
  fetchInspectionStatus,
  fetchInspectionTemplates,
  fetchInspections,
  flushPendingInspections,
  INSPECTION_CATEGORIES,
  listPendingInspections,
  regulationRefFor,
  saveCompanyTemplate,
  templateLabel,
  verifyChain,
  type EquipmentInspection,
  type EquipmentInspectionStatus,
  type InspectionCategory,
  type InspectionTemplate,
} from "@/lib/inspections";
import { generateEquipmentInspectionsPdf } from "@/lib/generateEquipmentInspectionsPdf";

type View = "equipment" | "history" | "templates";

type Props = {
  companyId: string;
  companyName: string;
  companyLogoUrl?: string | null;
  countryCode?: string | null;
  locale?: string | null;
  labels: Record<string, string>;
  inventoryItems: InventoryItem[];
  vehicles: Vehicle[];
  projectNameById?: Record<string, string>;
  /** Empleado del usuario actual (para "Mis equipos"). */
  currentEmployeeId?: string | null;
  /** Proyectos asignados al usuario actual. */
  myProjectIds?: string[];
  canPerform: boolean;
  canView: boolean;
  canManageTemplates: boolean;
  /** Avisar al resto cuando un equipo sale NO APTO (notificaciones de la app). */
  onFailedInspection?: (insp: EquipmentInspection) => void;
  /** Abre la inspección de este equipo nada más montar (p. ej. desde el botón de una tarjeta o un QR). */
  initialItem?: InspectableItemRef | null;
  onInitialItemConsumed?: () => void;
};

const card = "rounded-xl border border-zinc-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900";
const btn =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500";

function freqLabel(f: string | null, t: Record<string, string>): string {
  switch (f) {
    case "daily":
      return t.freq_daily ?? "Diaria";
    case "weekly":
      return t.freq_weekly ?? "Semanal";
    case "monthly":
      return t.freq_monthly ?? "Mensual";
    case "yearly":
      return t.freq_yearly ?? "Anual";
    default:
      return t.freq_before_each_use ?? "Antes de cada uso";
  }
}

export function InspectionsPanel(props: Props) {
  const {
    companyId,
    companyName,
    companyLogoUrl,
    countryCode,
    locale,
    labels: t,
    inventoryItems,
    vehicles,
    projectNameById,
    currentEmployeeId,
    myProjectIds,
    canPerform,
    canView,
    canManageTemplates,
    onFailedInspection,
    initialItem,
    onInitialItemConsumed,
  } = props;

  const [view, setView] = useState<View>("equipment");
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [status, setStatus] = useState<EquipmentInspectionStatus[]>([]);
  const [history, setHistory] = useState<EquipmentInspection[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flowItem, setFlowItem] = useState<InspectableItemRef | null>(null);
  const [supersedes, setSupersedes] = useState<EquipmentInspection | null>(null);
  const [detail, setDetail] = useState<EquipmentInspection | null>(null);
  const [onlyMine, setOnlyMine] = useState(!canView);
  const [resultFilter, setResultFilter] = useState<"all" | "pass" | "pass_with_notes" | "fail">("all");
  const [search, setSearch] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [editing, setEditing] = useState<(Omit<InspectionTemplate, "id" | "companyId" | "isBase"> & { id?: string }) | null>(null);
  const [tplError, setTplError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await flushPendingInspections(companyId).catch(() => 0);
      const [tpls, st, hist, pend] = await Promise.all([
        fetchInspectionTemplates(),
        fetchInspectionStatus(companyId),
        fetchInspections(companyId, { limit: 300 }),
        listPendingInspections(companyId),
      ]);
      setTemplates(tpls);
      setStatus(st);
      setHistory(hist);
      setPendingCount(pend.length);
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
    const onOnline = () => void load();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [load]);

  useEffect(() => {
    if (!initialItem || loading) return;
    if (canPerform) {
      setSupersedes(null);
      setFlowItem(initialItem);
    }
    onInitialItemConsumed?.();
  }, [initialItem, loading, canPerform, onInitialItemConsumed]);

  const myItemKeys = useMemo(() => {
    const keys = new Set<string>();
    const projects = new Set(myProjectIds ?? []);
    for (const i of inventoryItems) {
      if (i.deletedAt) continue;
      if ((currentEmployeeId && i.assignedToEmployeeId === currentEmployeeId) || (i.assignedToProjectId && projects.has(i.assignedToProjectId))) {
        keys.add(`inventory:${i.id}`);
      }
    }
    for (const v of vehicles) {
      if ((currentEmployeeId && v.usualDriverId === currentEmployeeId) || (v.currentProjectId && projects.has(v.currentProjectId))) {
        keys.add(`fleet:${v.id}`);
      }
    }
    return keys;
  }, [inventoryItems, vehicles, currentEmployeeId, myProjectIds]);

  const visibleStatus = useMemo(() => {
    const list = onlyMine ? status.filter((s) => myItemKeys.has(`${s.itemKind}:${s.itemId}`)) : status;
    return [...list].sort((a, b) => {
      const rank = (s: EquipmentInspectionStatus) => (s.lastResult === "fail" ? 0 : s.needsInspection ? 1 : 2);
      return rank(a) - rank(b) || a.itemLabel.localeCompare(b.itemLabel);
    });
  }, [status, onlyMine, myItemKeys]);

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter(
      (h) =>
        (resultFilter === "all" || h.result === resultFilter) &&
        (!q || `${h.itemLabel ?? ""} ${h.itemSerial ?? ""} ${h.inspectorName ?? ""}`.toLowerCase().includes(q))
    );
  }, [history, resultFilter, search]);

  const correctedIds = useMemo(() => new Set(history.map((h) => h.supersedesId).filter(Boolean) as string[]), [history]);
  const chain = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.serverRecordedAt.localeCompare(b.serverRecordedAt));
    return verifyChain(sorted);
  }, [history]);

  const failCount = status.filter((s) => s.lastResult === "fail").length;
  const dueCount = status.filter((s) => s.needsInspection && s.lastResult !== "fail").length;

  function openFlow(s: EquipmentInspectionStatus) {
    setSupersedes(null);
    setFlowItem({
      kind: s.itemKind,
      id: s.itemId,
      label: s.itemLabel,
      serial: s.itemSerial,
      projectId: s.projectId,
      templateId: s.inspectionTemplateId,
    });
  }

  function openCorrection(h: EquipmentInspection) {
    setDetail(null);
    setSupersedes(h);
    setFlowItem({
      kind: h.itemKind,
      id: h.itemId,
      label: h.itemLabel ?? "",
      serial: h.itemSerial,
      projectId: h.projectId,
      templateId: h.templateId,
    });
  }

  async function exportPdf(list: EquipmentInspection[], title: string, fileTag: string) {
    setPdfBusy(true);
    try {
      await generateEquipmentInspectionsPdf({
        inspections: list,
        title,
        companyName,
        companyLogoUrl,
        countryCode,
        locale,
        labels: t,
        chainSource: history,
        fileName: `inspecciones_${fileTag.replace(/[^\w-]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    } finally {
      setPdfBusy(false);
    }
  }

  async function saveTemplate() {
    if (!editing) return;
    setTplError(null);
    if (!editing.name.trim() || editing.checklist.length === 0) {
      setTplError(t.inspectionTemplateIncomplete ?? "Pon un nombre y al menos un punto de control.");
      return;
    }
    try {
      await saveCompanyTemplate(companyId, {
        ...editing,
        checklist: editing.checklist.filter((c) => c.fallback.trim()).map((c) => ({ ...c, fallback: c.fallback.trim() })),
      });
      setEditing(null);
      void load();
    } catch (e) {
      setTplError(e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e));
    }
  }

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale ?? undefined) : "—");
  const resultBadge = (r: string | null) =>
    r === "fail" ? (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">{t.inspectionResultFail ?? "NO APTO"}</span>
    ) : r === "pass_with_notes" ? (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">{t.inspectionResultPassWithNotes ?? "Apto con observaciones"}</span>
    ) : r === "pass" ? (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{t.inspectionResultPass ?? "Apto"}</span>
    ) : null;

  const tabBtn = (id: View, label: string, icon: React.ReactNode, badge?: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === id}
      onClick={() => setView(id)}
      className={`${btn} shrink-0 ${view === id ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-slate-700 dark:text-zinc-300 dark:hover:bg-slate-800"}`}
    >
      {icon}
      {label}
      {badge ? <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">{badge}</span> : null}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto" role="tablist">
          {tabBtn("equipment", t.inspectionEquipmentTab ?? "Equipos", <ClipboardCheck className="h-4 w-4" />, failCount + dueCount)}
          {tabBtn("history", t.inspectionHistory ?? "Historial", <History className="h-4 w-4" />)}
          {tabBtn("templates", t.inspectionTemplates ?? "Plantillas", <ListChecks className="h-4 w-4" />)}
        </div>
        <button type="button" onClick={() => void load()} className={`${btn} border-zinc-200 text-zinc-600 dark:border-slate-700 dark:text-zinc-300`} aria-label={t.common_refresh ?? "Actualizar"}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      {pendingCount > 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {(t.inspectionPendingCount ?? "{n} inspecciones guardadas en este dispositivo pendientes de enviar.").replace("{n}", String(pendingCount))}
        </p>
      ) : null}
      {loadError ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200" role="alert">
          {t.inspectionLoadError ?? "No se pudieron cargar las inspecciones"}: {loadError}
        </p>
      ) : null}

      {view === "equipment" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {canView ? (
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="h-5 w-5 accent-orange-600" />
                {t.myEquipment ?? "Solo mis equipos"}
              </label>
            ) : null}
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {(t.inspectionSummary ?? "{fail} no aptos · {due} pendientes").replace("{fail}", String(failCount)).replace("{due}", String(dueCount))}
            </span>
          </div>
          {visibleStatus.length === 0 && !loading ? (
            <div className={`${card} text-sm text-zinc-600 dark:text-zinc-300`}>
              {t.inspectionNoEquipment ??
                "Ningún equipo requiere inspección todavía. Márcalo en Inventario, Flota o Alquileres con «Requiere inspección antes de usar»."}
            </div>
          ) : null}
          <ul className="grid gap-3 md:grid-cols-2">
            {visibleStatus.map((s) => (
              <li key={`${s.itemKind}:${s.itemId}`} className={`${card} flex flex-col gap-2`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900 dark:text-white">{s.itemLabel || "—"}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {s.itemSerial ? `${t.serialNumber ?? "N.º de serie"}: ${s.itemSerial} · ` : ""}
                      {freqLabel(s.inspectionFrequency, t)}
                      {s.projectId && projectNameById?.[s.projectId] ? ` · ${projectNameById[s.projectId]}` : ""}
                    </p>
                  </div>
                  {s.lastResult === "fail" ? (
                    <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t.inspectionLastFailed ?? "NO APTO"}
                    </span>
                  ) : s.needsInspection ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">{t.inspectionPending ?? "Inspección pendiente"}</span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{t.inspectionUpToDate ?? "Al día"}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t.inspectionLast ?? "Última"}: {fmt(s.lastInspectionAt)}
                  {s.lastInspectorName ? ` · ${s.lastInspectorName}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {canPerform ? (
                    <button type="button" onClick={() => openFlow(s)} className={`${btn} border-orange-600 bg-orange-600 text-white hover:bg-orange-700`}>
                      <ShieldCheck className="h-4 w-4" />
                      {t.inspect ?? "Inspeccionar"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch(s.itemLabel);
                      setView("history");
                    }}
                    className={`${btn} border-zinc-300 text-zinc-700 dark:border-slate-600 dark:text-zinc-200`}
                  >
                    <History className="h-4 w-4" />
                    {t.inspectionHistory ?? "Historial"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "history" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.common_search ?? "Buscar"}
              className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value as typeof resultFilter)}
              className="min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="all">{t.common_all ?? "Todos"}</option>
              <option value="pass">{t.inspectionResultPass ?? "Apto"}</option>
              <option value="pass_with_notes">{t.inspectionResultPassWithNotes ?? "Apto con observaciones"}</option>
              <option value="fail">{t.inspectionResultFail ?? "NO APTO"}</option>
            </select>
            <button
              type="button"
              disabled={pdfBusy || filteredHistory.length === 0}
              onClick={() => void exportPdf(filteredHistory, t.inspectionReportTitle ?? "Informe de inspecciones previas al uso", search || "todas")}
              className={`${btn} border-zinc-300 text-zinc-700 disabled:opacity-50 dark:border-slate-600 dark:text-zinc-200`}
            >
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {t.inspectionReportPdf ?? "Informe PDF"}
            </button>
          </div>
          {history.length > 1 ? (
            <p className={`text-xs ${chain.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              {chain.ok ? t.inspectionChainVerified ?? "Cadena de huellas verificada." : t.inspectionChainBroken ?? "La cadena de huellas presenta discrepancias."}
            </p>
          ) : null}
          {filteredHistory.length === 0 && !loading ? (
            <div className={`${card} text-sm text-zinc-600 dark:text-zinc-300`}>{t.inspectionNoHistory ?? "Sin inspecciones registradas."}</div>
          ) : null}
          <ul className="space-y-2">
            {filteredHistory.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => setDetail(h)} className={`${card} flex w-full min-h-[44px] items-center justify-between gap-3 text-start hover:bg-zinc-50 dark:hover:bg-slate-800`}>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900 dark:text-white">{h.itemLabel ?? "—"}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {fmt(h.serverRecordedAt)} · {h.inspectorName ?? "—"}
                      {correctedIds.has(h.id) ? ` · ${t.inspectionCorrectedBy ?? "Corregida"}` : ""}
                    </p>
                  </div>
                  {resultBadge(h.result)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "templates" && (
        <div className="space-y-3">
          {canManageTemplates ? (
            <button
              type="button"
              onClick={() =>
                setEditing({ name: "", itemCategory: "other", countryCodes: null, regulationRefs: {}, checklist: [], requiresPhoto: true, minPhotos: 1 })
              }
              className={`${btn} border-orange-600 bg-orange-600 text-white hover:bg-orange-700`}
            >
              <Plus className="h-4 w-4" />
              {t.inspectionNewTemplate ?? "Nueva plantilla"}
            </button>
          ) : null}
          <ul className="grid gap-3 md:grid-cols-2">
            {templates.map((tpl) => (
              <li key={tpl.id} className={`${card} space-y-2`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-zinc-900 dark:text-white">{templateLabel(tpl, t)}</p>
                  {tpl.isBase ? (
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-slate-800 dark:text-zinc-300">MachinPro</span>
                  ) : null}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t[`insp_cat_${tpl.itemCategory}`] ?? tpl.itemCategory} · {tpl.checklist.length} {t.inspectionChecks ?? "puntos"}
                  {regulationRefFor(tpl.regulationRefs, countryCode) ? ` · ${regulationRefFor(tpl.regulationRefs, countryCode)}` : ""}
                </p>
                {canManageTemplates ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...(tpl.isBase ? {} : { id: tpl.id }),
                          name: tpl.isBase ? `${templateLabel(tpl, t)} (${companyName})` : tpl.name,
                          itemCategory: tpl.itemCategory,
                          countryCodes: tpl.countryCodes,
                          regulationRefs: tpl.regulationRefs,
                          checklist: tpl.checklist.map((c) => ({ id: c.id, fallback: checklistLabel(c, t) })),
                          requiresPhoto: tpl.requiresPhoto,
                          minPhotos: tpl.minPhotos,
                        })
                      }
                      className={`${btn} border-zinc-300 text-zinc-700 dark:border-slate-600 dark:text-zinc-200`}
                    >
                      {tpl.isBase ? <Copy className="h-4 w-4" /> : null}
                      {tpl.isBase ? t.inspectionDuplicateTemplate ?? "Duplicar y adaptar" : t.common_edit ?? "Editar"}
                    </button>
                    {!tpl.isBase ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(t.inspectionArchiveTemplateConfirm ?? "¿Archivar esta plantilla? Las inspecciones ya hechas no cambian.")) return;
                          await archiveCompanyTemplate(companyId, tpl.id).catch(() => undefined);
                          void load();
                        }}
                        className={`${btn} border-zinc-300 text-zinc-700 dark:border-slate-600 dark:text-zinc-200`}
                        aria-label={t.inspectionArchiveTemplate ?? "Archivar"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detalle de una inspección (solo lectura) */}
      {detail ? (
        <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="flex h-full w-full flex-col bg-white dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl">
            <header className="flex items-start justify-between gap-2 border-b border-zinc-200 p-4 dark:border-slate-700">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-zinc-900 dark:text-white">{detail.itemLabel ?? "—"}</h3>
                <div className="mt-1">{resultBadge(detail.result)}</div>
              </div>
              <button type="button" onClick={() => setDetail(null)} className={`${btn} border-transparent text-zinc-500`}>
                {t.common_close ?? "Cerrar"}
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm text-zinc-700 dark:text-zinc-200">
              <p>{t.inspectionInspector ?? "Inspector"}: {detail.inspectorName ?? "—"}</p>
              <p>{t.inspectionServerTime ?? "Hora del servidor"}: {fmt(detail.serverRecordedAt)}</p>
              <p>{t.inspectionDeviceTime ?? "Hora del móvil"}: {fmt(detail.clientRecordedAt)}</p>
              {detail.itemSerial ? <p>{t.serialNumber ?? "N.º de serie"}: {detail.itemSerial}</p> : null}
              {detail.gpsLat != null && detail.gpsLng != null ? (
                <p>
                  GPS:{" "}
                  <a
                    className="text-orange-700 underline dark:text-orange-300"
                    href={`https://www.google.com/maps?q=${detail.gpsLat},${detail.gpsLng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {detail.gpsLat.toFixed(5)}, {detail.gpsLng.toFixed(5)}
                  </a>
                </p>
              ) : null}
              {detail.templateSnapshot ? (
                <div className="space-y-1">
                  <p className="font-medium">{templateLabel(detail.templateSnapshot, t)}</p>
                  <ul className="space-y-1">
                    {(detail.templateSnapshot.checklist ?? []).map((c) => {
                      const a = detail.answers[c.id];
                      return (
                        <li key={c.id} className={a?.status === "defect" ? "text-red-700 dark:text-red-300" : ""}>
                          {checklistLabel(c, t)} —{" "}
                          {a?.status === "defect"
                            ? t.inspectionStatusDefect ?? "Defecto"
                            : a?.status === "na"
                              ? t.inspectionStatusNa ?? "No aplica"
                              : t.inspectionStatusOk ?? "Correcto"}
                          {a?.note ? `: ${a.note}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {detail.defects ? <p className="font-medium text-red-700 dark:text-red-300">{t.inspectionDefects ?? "Defectos"}: {detail.defects}</p> : null}
              {detail.notes ? <p>{t.inspectionNotes ?? "Observaciones"}: {detail.notes}</p> : null}
              <div className="flex flex-wrap gap-2">
                {detail.photoUrls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block h-24 w-24 overflow-hidden rounded-lg border border-zinc-200 dark:border-slate-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u.replace("/upload/", "/upload/w_240,c_fill,h_240/")} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
              {detail.declarationText ? <p className="text-xs text-zinc-500">{detail.declarationText}</p> : null}
              <p className="break-all font-mono text-xs text-zinc-500">
                {t.inspectionVerificationCode ?? "Código de verificación"}: {detail.contentHash}
              </p>
              <p className="text-xs text-zinc-500">{t.inspectionImmutableNote ?? "Este registro no se puede editar ni borrar."}</p>
            </div>
            <footer className="flex flex-wrap gap-2 border-t border-zinc-200 p-4 dark:border-slate-700">
              <button
                type="button"
                disabled={pdfBusy}
                onClick={() => void exportPdf([detail], t.inspectionReportTitle ?? "Informe de inspección", detail.itemLabel ?? "equipo")}
                className={`${btn} flex-1 border-zinc-300 text-zinc-700 dark:border-slate-600 dark:text-zinc-200`}
              >
                <FileDown className="h-4 w-4" />
                PDF
              </button>
              {canPerform ? (
                <button type="button" onClick={() => openCorrection(detail)} className={`${btn} flex-1 border-orange-600 text-orange-700 dark:text-orange-300`}>
                  {t.inspectionCorrect ?? "Registrar corrección"}
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      ) : null}

      {/* Editor de plantilla de la empresa */}
      {editing ? (
        <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="flex h-full w-full flex-col bg-white dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl">
            <header className="border-b border-zinc-200 p-4 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{t.inspectionTemplate ?? "Plantilla de inspección"}</h3>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder={t.inspectionTemplateName ?? "Nombre de la plantilla"}
                className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
              <select
                value={editing.itemCategory}
                onChange={(e) => setEditing({ ...editing, itemCategory: e.target.value as InspectionCategory })}
                className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                {INSPECTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t[`insp_cat_${c}`] ?? c}
                  </option>
                ))}
              </select>
              <input
                value={regulationRefFor(editing.regulationRefs, countryCode) ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, regulationRefs: { ...editing.regulationRefs, [(countryCode ?? "XX").toUpperCase()]: e.target.value } })
                }
                placeholder={t.inspectionRegulationRef ?? "Referencia normativa (opcional)"}
                className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex min-h-[44px] items-center gap-2 text-zinc-700 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={editing.requiresPhoto}
                    onChange={(e) => setEditing({ ...editing, requiresPhoto: e.target.checked })}
                    className="h-5 w-5 accent-orange-600"
                  />
                  {t.inspectionRequiresPhoto ?? "Foto obligatoria"}
                </label>
                {editing.requiresPhoto ? (
                  <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
                    {t.inspectionMinPhotos ?? "Mínimo de fotos"}
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={editing.minPhotos}
                      onChange={(e) => setEditing({ ...editing, minPhotos: Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)) })}
                      className="min-h-[44px] w-20 rounded-lg border border-zinc-300 bg-white px-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                ) : null}
              </div>
              <p className="font-medium text-zinc-700 dark:text-zinc-200">{t.inspectionChecklist ?? "Puntos de control"}</p>
              <ol className="space-y-2">
                {editing.checklist.map((c, i) => (
                  <li key={c.id} className="flex gap-2">
                    <input
                      value={c.fallback}
                      onChange={(e) =>
                        setEditing({ ...editing, checklist: editing.checklist.map((x, j) => (j === i ? { ...x, fallback: e.target.value } : x)) })
                      }
                      className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, checklist: editing.checklist.filter((_, j) => j !== i) })}
                      className={`${btn} border-zinc-300 text-zinc-600 dark:border-slate-600 dark:text-zinc-300`}
                      aria-label={t.common_delete ?? "Quitar"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    ...editing,
                    checklist: [...editing.checklist, { id: `c${Date.now().toString(36)}`, fallback: "" }],
                  })
                }
                className={`${btn} border-dashed border-orange-400 text-orange-700 dark:text-orange-300`}
              >
                <Plus className="h-4 w-4" />
                {t.inspectionAddCheck ?? "Añadir punto"}
              </button>
              {tplError ? <p className="text-red-700 dark:text-red-300">{tplError}</p> : null}
            </div>
            <footer className="flex gap-2 border-t border-zinc-200 p-4 dark:border-slate-700">
              <button type="button" onClick={() => setEditing(null)} className={`${btn} flex-1 border-zinc-300 text-zinc-700 dark:border-slate-600 dark:text-zinc-200`}>
                {t.common_cancel ?? "Cancelar"}
              </button>
              <button type="button" onClick={() => void saveTemplate()} className={`${btn} flex-1 border-orange-600 bg-orange-600 text-white`}>
                {t.common_save ?? "Guardar"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <EquipmentInspectionFlow
        open={!!flowItem}
        onClose={() => {
          setFlowItem(null);
          setSupersedes(null);
          void load();
        }}
        companyId={companyId}
        item={flowItem}
        templates={templates}
        labels={t}
        countryCode={countryCode}
        locale={locale}
        supersedes={supersedes}
        onSaved={(saved) => {
          if (saved && saved.result === "fail") onFailedInspection?.(saved);
        }}
      />
    </div>
  );
}
