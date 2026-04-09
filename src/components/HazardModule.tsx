"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Plus,
  Search,
  X,
  ImagePlus,
  ClipboardList,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAuditEvent } from "@/lib/useAuditLog";
import type { UserRole } from "@/types/shared";
import {
  type Hazard,
  type HazardCategory,
  type HazardFormData,
  type HazardProbability,
  type HazardSeverity,
  type HazardStatus,
  getRiskLevel,
  getRiskScore,
} from "@/types/hazard";
import { useToast } from "@/components/Toast";
import { postAppNotification } from "@/lib/clientNotifications";
import { FilterGrid } from "@/components/FilterGrid";
import { formatDateTime } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";

const CLOUDINARY_CLOUD = "dwdlmxmkt";
const CLOUDINARY_PRESET = "i5dmd07o";
const MAX_PHOTOS = 5;

const SEVERITIES: HazardSeverity[] = ["low", "medium", "high", "critical"];
const PROBS: HazardProbability[] = ["low", "medium", "high"];
const CATEGORIES: HazardCategory[] = [
  "electrical",
  "chemical",
  "physical",
  "ergonomic",
  "biological",
  "fire",
  "other",
];
const STATUSES: HazardStatus[] = ["open", "in_progress", "resolved", "closed"];

export interface HazardModuleProps {
  t: Record<string, string>;
  companyId: string | null;
  companyName?: string | null;
  userRole: UserRole;
  userName: string;
  userProfileId: string | null;
  projects: { id: string; name: string }[];
  employees: { id: string; name: string; role?: string }[];
  /** Abre el módulo de acciones correctivas con peligro/proyecto pre-rellenados. */
  onOpenCorrectiveFromHazard?: (p: {
    hazardId: string;
    projectId: string | null;
    projectName: string | null;
  }) => void;
  /** Al volver desde acciones correctivas, abre el detalle de este peligro. */
  focusHazardId?: string | null;
  onFocusHazardConsumed?: () => void;
  /** Increment from parent (p. ej. dashboard) para abrir el formulario de alta. */
  openCreateSignal?: number;
  /** Si se define, la lista y filtros quedan acotados a ese proyecto (p. ej. pestaña Seguridad en Operaciones). */
  lockedProjectId?: string | null;
  dateLocale: string;
  timeZone: string;
}

type SortKey = "date" | "score" | "severity" | "status";

type AuditRow = {
  id: string;
  action: string;
  user_name?: string | null;
  created_at: string;
  new_value?: unknown;
  old_value?: unknown;
};

async function uploadHazardPhoto(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: fd }
  );
  if (!res.ok) throw new Error("upload failed");
  const j = (await res.json()) as { secure_url?: string };
  if (!j.secure_url) throw new Error("no url");
  return j.secure_url;
}

function sevOrder(s: HazardSeverity): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[s];
}

function statusOrder(s: HazardStatus): number {
  return { open: 0, in_progress: 1, resolved: 2, closed: 3 }[s];
}

function emptyForm(): HazardFormData {
  return {
    title: "",
    description: "",
    category: "other",
    severity: "medium",
    probability: "medium",
    project_id: "",
    project_name: "",
    location: "",
    assigned_to: "",
    assigned_to_name: "",
    due_date: "",
    tags: "",
  };
}

export function HazardModule({
  t,
  companyId,
  companyName,
  userRole,
  userName,
  userProfileId,
  projects,
  employees,
  onOpenCorrectiveFromHazard,
  focusHazardId,
  onFocusHazardConsumed,
  openCreateSignal = 0,
  lockedProjectId = null,
  dateLocale,
  timeZone,
}: HazardModuleProps) {
  const readOnly = userRole === "worker";
  const { showToast } = useToast();
  void useMachinProDisplayPrefs();
  const lastCreateSig = useRef(0);
  const [rows, setRows] = useState<Hazard[]>([]);
  const [caByHazard, setCaByHazard] = useState<
    Record<string, { count: number; allDone: boolean }>
  >({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>(() =>
    lockedProjectId ? lockedProjectId : "all"
  );
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (lockedProjectId) setFilterProject(lockedProjectId);
  }, [lockedProjectId]);

  useEffect(() => {
    if (openCreateSignal > lastCreateSig.current && !readOnly) {
      setCreateOpen(true);
    }
    lastCreateSig.current = openCreateSignal;
  }, [openCreateSignal, readOnly]);

  useEffect(() => {
    if (!lockedProjectId || !createOpen) return;
    const name = projects.find((p) => p.id === lockedProjectId)?.name ?? "";
    setForm((f) =>
      f.project_id === lockedProjectId && f.project_name === name
        ? f
        : { ...f, project_id: lockedProjectId, project_name: name }
    );
  }, [lockedProjectId, createOpen, projects]);
  const [detail, setDetail] = useState<Hazard | null>(null);
  const [form, setForm] = useState<HazardFormData>(() => emptyForm());
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileOptions, setProfileOptions] = useState<{ id: string; name: string }[]>([]);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [statusDraft, setStatusDraft] = useState<HazardStatus>("open");
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [correctiveDraft, setCorrectiveDraft] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !companyId) {
      setRows([]);
      setCaByHazard({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("hazards")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      setRows([]);
      setCaByHazard({});
    } else {
      setRows((data ?? []) as Hazard[]);
    }
    const { data: caRows } = await supabase
      .from("corrective_actions")
      .select("hazard_id, status")
      .eq("company_id", companyId)
      .not("hazard_id", "is", null);
    const caMap: Record<string, { count: number; allDone: boolean }> = {};
    for (const r of caRows ?? []) {
      const row = r as { hazard_id: string | null; status: string };
      const hid = row.hazard_id;
      if (!hid) continue;
      if (!caMap[hid]) caMap[hid] = { count: 0, allDone: true };
      caMap[hid].count += 1;
      if (row.status !== "closed" && row.status !== "verified") {
        caMap[hid].allDone = false;
      }
    }
    setCaByHazard(caMap);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!supabase || !companyId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, employee_id")
        .eq("company_id", companyId);
      if (cancelled || !data) return;
      const opts = (data as { id: string; employee_id: string | null }[]).map((p) => ({
        id: p.id,
        name:
          employees.find((e) => e.id === p.employee_id)?.name ??
          p.id.slice(0, 8) + "…",
      }));
      setProfileOptions(opts);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, employees]);

  const loadHistory = useCallback(
    async (hazardId: string) => {
      if (!supabase) return;
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, user_name, created_at, new_value, old_value")
        .eq("entity_type", "hazard")
        .eq("entity_id", hazardId)
        .order("created_at", { ascending: false })
        .limit(50);
      setHistory((data as AuditRow[]) ?? []);
    },
    []
  );

  useEffect(() => {
    if (detail?.id) void loadHistory(detail.id);
    else setHistory([]);
  }, [detail?.id, loadHistory]);

  useEffect(() => {
    if (!focusHazardId || rows.length === 0) return;
    const h = rows.find((r) => r.id === focusHazardId);
    if (h) {
      setDetail(h);
      onFocusHazardConsumed?.();
    }
  }, [focusHazardId, rows, onFocusHazardConsumed]);

  useEffect(() => {
    if (detail) {
      setStatusDraft(detail.status);
      setResolutionDraft(detail.resolution_notes ?? "");
    }
  }, [detail]);

  const rowsScoped = useMemo(() => {
    if (!lockedProjectId) return rows;
    return rows.filter((r) => r.project_id === lockedProjectId);
  }, [rows, lockedProjectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rowsScoped.filter((r) => {
      if (filterProject !== "all" && r.project_id !== filterProject) return false;
      if (filterCategory !== "all" && r.category !== filterCategory) return false;
      if (filterSeverity !== "all" && r.severity !== filterSeverity) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterAssignee !== "all") {
        if (filterAssignee === "unassigned" && r.assigned_to) return false;
        if (filterAssignee !== "unassigned" && r.assigned_to !== filterAssignee)
          return false;
      }
      if (q) {
        const t1 = (r.title ?? "").toLowerCase();
        const t2 = (r.description ?? "").toLowerCase();
        if (!t1.includes(q) && !t2.includes(q)) return false;
      }
      return true;
    });
  }, [
    rowsScoped,
    search,
    filterProject,
    filterCategory,
    filterSeverity,
    filterStatus,
    filterAssignee,
  ]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "date")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortKey === "score") return b.risk_score - a.risk_score;
      if (sortKey === "severity") return sevOrder(b.severity) - sevOrder(a.severity);
      return statusOrder(a.status) - statusOrder(b.status);
    });
    return copy;
  }, [filtered, sortKey]);

  const activeHazards = useMemo(
    () => rowsScoped.filter((r) => r.status === "open" || r.status === "in_progress"),
    [rowsScoped]
  );

  const matrixCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const sev of SEVERITIES) {
      for (const prob of PROBS) {
        m[`${sev}-${prob}`] = 0;
      }
    }
    for (const h of activeHazards) {
      const k = `${h.severity}-${h.probability}`;
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [activeHazards]);

  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const stats = useMemo(() => {
    const open = rowsScoped.filter((r) => r.status === "open").length;
    const inProg = rowsScoped.filter((r) => r.status === "in_progress").length;
    const resolvedWeek = rowsScoped.filter(
      (r) =>
        (r.status === "resolved" || r.status === "closed") &&
        r.resolved_at &&
        new Date(r.resolved_at) >= weekAgo
    ).length;
    const catCounts: Record<string, number> = {};
    for (const c of CATEGORIES) catCounts[c] = 0;
    for (const h of activeHazards) {
      catCounts[h.category] = (catCounts[h.category] ?? 0) + 1;
    }
    const criticalUnassigned = activeHazards.filter(
      (h) => h.severity === "critical" && !h.assigned_to
    ).length;
    return { open, inProg, resolvedWeek, catCounts, criticalUnassigned };
  }, [rowsScoped, activeHazards, weekAgo]);

  const catLabel = (c: HazardCategory) =>
    (t as Record<string, string>)[`hazards_cat_${c}`] ?? c;

  const sevLabel = (s: HazardSeverity) =>
    (t as Record<string, string>)[`hazards_sev_${s}`] ?? s;

  const probLabel = (p: HazardProbability) =>
    (t as Record<string, string>)[`hazards_prob_${p}`] ?? p;

  const statusLabel = (s: HazardStatus) =>
    (t as Record<string, string>)[`hazards_status_${s}`] ?? s;

  const sevBadgeClass = (s: HazardSeverity) => {
    switch (s) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300";
      case "medium":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
      default:
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
    }
  };

  const matrixCellClass = (sev: HazardSeverity, prob: HazardProbability) => {
    const score = getRiskScore(sev, prob);
    const lvl = getRiskLevel(score);
    if (lvl === "critical") return "bg-red-500/90 text-white";
    if (lvl === "high") return "bg-orange-500/90 text-white";
    if (lvl === "medium") return "bg-amber-400/90 text-gray-900";
    return "bg-emerald-500/90 text-white";
  };

  const submitCreate = async () => {
    if (!supabase || !companyId || readOnly) return;
    if (!form.title.trim()) return;
    setSaving(true);
    const score = getRiskScore(form.severity, form.probability);
    const tags = form.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const lat = parseFloat(formLat);
    const lng = parseFloat(formLng);
    const payload = {
      company_id: companyId,
      project_id: form.project_id || null,
      project_name: form.project_name || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      severity: form.severity,
      probability: form.probability,
      risk_score: score,
      status: "open" as const,
      location: form.location.trim() || null,
      reported_by: userProfileId,
      reported_by_name: userName,
      assigned_to: form.assigned_to || null,
      assigned_to_name: form.assigned_to_name.trim() || null,
      due_date: form.due_date || null,
      photos: [] as string[],
      corrective_actions: [] as string[],
      tags,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
    };

    const { data, error } = await supabase.from("hazards").insert(payload).select("id").single();
    setSaving(false);
    if (error) {
      console.error(error);
      showToast("error", t.toast_error ?? "Error");
      return;
    }
    const id = data?.id as string;
    void logAuditEvent({
      company_id: companyId,
      user_id: userProfileId ?? "",
      user_name: userName,
      action: "hazard_created",
      entity_type: "hazard",
      entity_id: id,
      entity_name: form.title.trim(),
      new_value: { details: { payload } },
    });
    showToast("success", t.toast_saved ?? "Saved");
    const title = t.new_hazard ?? t.push_new_hazard ?? "New hazard";
    const body = form.title.trim();
    for (const emp of employees) {
      const r = (emp.role ?? "").toLowerCase();
      if (r !== "admin" && r !== "supervisor") continue;
      void postAppNotification(supabase, {
        companyId,
        targetUserId: emp.id,
        type: "hazard_reported",
        title,
        body,
        data: { hazardId: id, projectId: form.project_id || undefined },
      });
    }
    setCreateOpen(false);
    setForm(emptyForm());
    setFormLat("");
    setFormLng("");
    void load();
  };

  const saveDetailStatus = async () => {
    if (!supabase || !companyId || !detail || readOnly) return;
    const prev = detail.status;
    const now = new Date().toISOString();
    const isResolved = statusDraft === "resolved" || statusDraft === "closed";
    const patch: Partial<Hazard> = {
      status: statusDraft,
      resolution_notes: resolutionDraft.trim() || null,
      risk_score: getRiskScore(detail.severity, detail.probability),
    };
    if (isResolved) {
      patch.resolved_at = detail.resolved_at ?? now;
      patch.resolved_by_name = userName;
    } else {
      patch.resolved_at = null;
      patch.resolved_by_name = null;
    }

    const { error } = await supabase.from("hazards").update(patch).eq("id", detail.id);
    if (error) {
      console.error(error);
      showToast("error", t.toast_error ?? "Error");
      return;
    }

    showToast("success", t.toast_saved ?? "Saved");

    const becameResolved =
      isResolved && prev !== "resolved" && prev !== "closed";
    const action = becameResolved ? "hazard_resolved" : "hazard_status_changed";
    void logAuditEvent({
      company_id: companyId,
      user_id: userProfileId ?? "",
      user_name: userName,
      action,
      entity_type: "hazard",
      entity_id: detail.id,
      entity_name: detail.title,
      old_value: { details: { status: prev } },
      new_value: {
        details: {
          status: statusDraft,
          resolution_notes: resolutionDraft.trim() || null,
        },
      },
    });
    void load();
    setDetail((d) => (d ? { ...d, ...patch } : null));
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files || !detail || readOnly || !companyId) return;
    const room = MAX_PHOTOS - (detail.photos?.length ?? 0);
    if (room <= 0) return;
    const list = Array.from(files).slice(0, room);
    const urls: string[] = [];
    for (const f of list) {
      try {
        urls.push(await uploadHazardPhoto(f));
      } catch {
        /* ignore */
      }
    }
    if (!urls.length || !supabase) return;
    const next = [...(detail.photos ?? []), ...urls];
    const { error } = await supabase
      .from("hazards")
      .update({ photos: next })
      .eq("id", detail.id);
    if (error) {
      showToast("error", t.toast_error ?? "Error");
      return;
    }
    setDetail({ ...detail, photos: next });
    showToast("success", t.toast_saved ?? "Saved");
    void load();
  };

  const addCorrective = async () => {
    if (!correctiveDraft.trim() || !detail || readOnly || !supabase) return;
    const next = [...(detail.corrective_actions ?? []), correctiveDraft.trim()];
    const { error } = await supabase
      .from("hazards")
      .update({ corrective_actions: next })
      .eq("id", detail.id);
    if (error) {
      showToast("error", t.toast_error ?? "Error");
      return;
    }
    setDetail({ ...detail, corrective_actions: next });
    setCorrectiveDraft("");
    showToast("success", t.toast_saved ?? "Saved");
    void load();
  };

  const maxCat = Math.max(1, ...Object.values(stats.catCounts));

  if (!companyId) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center text-gray-600 dark:text-gray-400">
        {t.hazards_no_company ?? t.billing_no_company ?? "—"}
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center text-gray-600 dark:text-gray-400">
        {t.hazards_error ?? "—"}
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
            {t.hazards_title ?? "Hazards"}
          </h2>
          {companyName ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{companyName}</p>
          ) : null}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-3 text-sm w-full sm:w-auto"
          >
            <Plus className="h-5 w-5" />
            {t.hazards_new ?? "New"}
          </button>
        )}
      </div>

      {stats.criticalUnassigned > 0 && (
        <div
          className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-medium text-red-800 dark:text-red-200"
          role="alert"
        >
          {t.hazards_critical_alert ?? "Critical"}: {stats.criticalUnassigned}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t.hazards_open ?? "Open"}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {stats.open}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t.hazards_in_progress ?? "In progress"}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {stats.inProg}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t.hazards_week_resolved ?? "Resolved (7d)"}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {stats.resolvedWeek}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t.hazards_closed ?? "Closed total"}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {rowsScoped.filter((r) => r.status === "closed").length}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {t.hazards_bar_categories ?? t.hazards_stats ?? "Stats"}
        </h3>
        <div className="space-y-2">
          {CATEGORIES.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <span className="text-xs w-28 shrink-0 truncate text-gray-600 dark:text-gray-400">
                {catLabel(c)}
              </span>
              <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{
                    width: `${((stats.catCounts[c] ?? 0) / maxCat) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs tabular-nums w-6 text-right text-gray-600 dark:text-gray-300">
                {stats.catCounts[c] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          {t.hazards_matrix ?? "Matrix"}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t.hazards_matrix_prob_axis ?? "Probability →"}</p>
        <div className="inline-block min-w-[320px]">
          <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-1 text-center text-xs">
            <div />
            {PROBS.map((p) => (
              <div key={p} className="font-medium text-gray-600 dark:text-gray-400 py-1">
                {probLabel(p)}
              </div>
            ))}
            {SEVERITIES.map((sev) => (
              <div key={sev} className="contents">
                <div className="flex items-center font-medium text-gray-600 dark:text-gray-400 pr-2 text-left">
                  {sevLabel(sev)}
                </div>
                {PROBS.map((prob) => {
                  const n = matrixCounts[`${sev}-${prob}`] ?? 0;
                  return (
                    <div
                      key={`${sev}-${prob}`}
                      className={`rounded-lg min-h-[44px] flex items-center justify-center font-semibold text-sm ${matrixCellClass(sev, prob)}`}
                    >
                      {n}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <FilterGrid>
        {!lockedProjectId ? (
          <label className="flex flex-col gap-1 text-sm min-w-0">
            <span className="text-gray-600 dark:text-gray-400">
              {t.hazards_filter_project ?? "Project"}
            </span>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
            >
              <option value="all">{t.hazards_filter_all ?? "All"}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex flex-col gap-1 text-sm min-w-0">
            <span className="text-gray-600 dark:text-gray-400">
              {t.hazards_filter_project ?? "Project"}
            </span>
            <span className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 px-3 py-2.5 min-h-[44px] text-sm flex items-center text-gray-800 dark:text-gray-200">
              {projects.find((p) => p.id === lockedProjectId)?.name ?? lockedProjectId}
            </span>
          </div>
        )}
        <label className="flex flex-col gap-1 text-sm min-w-[140px]">
          <span className="text-gray-600 dark:text-gray-400">
            {t.hazards_filter_category ?? "Category"}
          </span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{t.hazards_filter_all ?? "All"}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {catLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[140px]">
          <span className="text-gray-600 dark:text-gray-400">
            {t.hazards_filter_severity ?? "Severity"}
          </span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{t.hazards_filter_all ?? "All"}</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {sevLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[140px]">
          <span className="text-gray-600 dark:text-gray-400">
            {t.hazards_filter_status ?? "Status"}
          </span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{t.hazards_filter_all ?? "All"}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[160px]">
          <span className="text-gray-600 dark:text-gray-400">
            {t.hazards_filter_assignee ?? "Assignee"}
          </span>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{t.hazards_filter_all ?? "All"}</option>
            <option value="unassigned">{t.hazards_no_assignee ?? "Unassigned"}</option>
            {profileOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[160px]">
          <span className="text-gray-600 dark:text-gray-400">{t.hazards_sort ?? "Sort"}</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="date">{t.hazards_sort_date ?? "Date"}</option>
            <option value="score">{t.hazards_sort_score ?? "Score"}</option>
            <option value="severity">{t.hazards_sort_severity ?? "Severity"}</option>
            <option value="status">{t.hazards_sort_status ?? "Status"}</option>
          </select>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm min-w-0 lg:col-span-4">
          <span className="text-gray-600 dark:text-gray-400">{t.hazards_search ?? "Search"}</span>
          <span className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-10 pr-3 py-2.5 min-h-[44px] text-sm"
            />
          </span>
        </label>
      </FilterGrid>

      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 animate-pulse"
              />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800/50 py-14 px-4 text-center">
            <AlertTriangle className="h-16 w-16 text-gray-300 dark:text-gray-600" aria-hidden />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              {t.empty_state_hazards ?? t.empty_no_hazards ?? t.hazards_no_results ?? ""}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
              {t.empty_hazards_sub ?? ""}
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                {t.empty_add_first ?? t.hazards_new ?? "Add"}
              </button>
            )}
          </div>
        ) : (
          sorted.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setDetail(h)}
              className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2 min-h-[44px]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-gray-900 dark:text-white">{h.title}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${sevBadgeClass(h.severity)}`}>
                  {sevLabel(h.severity)}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {catLabel(h.category)} · {t.hazards_risk_score ?? "Score"}: {h.risk_score} ·{" "}
                {statusLabel(h.status)}
              </p>
              {(caByHazard[h.id]?.count ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t.hazards_linked_corrective_count ?? t.actions_title ?? "Acciones"}:{" "}
                    {caByHazard[h.id]!.count}
                  </span>
                  {caByHazard[h.id]!.allDone &&
                    (h.status === "open" || h.status === "in_progress") && (
                      <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 font-medium text-emerald-800 dark:text-emerald-200">
                        {t.actions_ready_to_close_hazard ?? "Listo para cerrar"}
                      </span>
                    )}
                </div>
              )}
            </button>
          ))
        )}
      </div>

      <div className="hidden md:block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-10 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse"
              />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center py-14 px-4 text-center">
            <AlertTriangle className="h-16 w-16 text-gray-300 dark:text-gray-600" aria-hidden />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              {t.empty_state_hazards ?? t.empty_no_hazards ?? t.hazards_no_results ?? ""}
            </h3>
            <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
              {t.empty_hazards_sub ?? ""}
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                {t.empty_add_first ?? t.hazards_new ?? "Add"}
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm min-w-[1040px]">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t.hazards_title_col ?? "Title"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.hazards_category ?? "Cat"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.hazards_severity ?? "Sev"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.hazards_probability ?? "Prob"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.hazards_risk_score ?? "Score"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.hazards_status ?? "Status"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.hazards_assigned_to ?? "Assign"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.hazards_due_date ?? "Due"}</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                  {t.hazards_corrective_actions_col ?? t.actions_title ?? "Acciones"}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => (
                <tr
                  key={h.id}
                  className="border-t border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => setDetail(h)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                    {h.title}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{catLabel(h.category)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sevBadgeClass(h.severity)}`}>
                      {sevLabel(h.severity)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{probLabel(h.probability)}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold">{h.risk_score}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{statusLabel(h.status)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 truncate max-w-[120px]">
                    {h.assigned_to_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {h.due_date ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className="tabular-nums">{caByHazard[h.id]?.count ?? 0}</span>
                      {caByHazard[h.id] &&
                        caByHazard[h.id]!.count > 0 &&
                        caByHazard[h.id]!.allDone &&
                        (h.status === "open" || h.status === "in_progress") && (
                          <span className="inline-flex w-fit rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-200">
                            {t.actions_ready_to_close_hazard ?? "OK"}
                          </span>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t.hazards_new ?? "New"}
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600"
                aria-label={t.hazards_close ?? "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t.hazards_title_col ?? "Title"} *</span>
              <input
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t.hazards_description ?? "Description"}</span>
              <textarea
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[88px] text-sm"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t.hazards_category ?? "Category"}</span>
                <select
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as HazardCategory }))
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {catLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t.hazards_severity ?? "Severity"}</span>
                <select
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                  value={form.severity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, severity: e.target.value as HazardSeverity }))
                  }
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {sevLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {t.hazards_probability ?? "Probability"}
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                  value={form.probability}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, probability: e.target.value as HazardProbability }))
                  }
                >
                  {PROBS.map((p) => (
                    <option key={p} value={p}>
                      {probLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t.hazards_due_date ?? "Due"}</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t.hazards_filter_project ?? "Project"}</span>
              {lockedProjectId ? (
                <div className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 px-3 py-2.5 min-h-[44px] text-sm flex items-center text-gray-800 dark:text-gray-200">
                  {projects.find((p) => p.id === lockedProjectId)?.name ?? lockedProjectId}
                </div>
              ) : (
                <select
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                  value={form.project_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const name = projects.find((p) => p.id === id)?.name ?? "";
                    setForm((f) => ({ ...f, project_id: id, project_name: name }));
                  }}
                >
                  <option value="">{t.hazards_filter_all ?? "—"}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t.hazards_location ?? "Location"}</span>
              <input
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t.hazards_assigned_to ?? "Assign"}</span>
              <select
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                value={form.assigned_to}
                onChange={(e) => {
                  const id = e.target.value;
                  const name = profileOptions.find((p) => p.id === id)?.name ?? "";
                  setForm((f) => ({ ...f, assigned_to: id, assigned_to_name: name }));
                }}
              >
                <option value="">{t.hazards_no_assignee ?? "—"}</option>
                {profileOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t.hazards_tags ?? "Tags"}</span>
              <input
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                placeholder={t.hazards_tags_hint ?? "a, b, c"}
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t.hazards_lat ?? "Lat"}</span>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t.hazards_lng ?? "Lng"}</span>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                  value={formLng}
                  onChange={(e) => setFormLng(e.target.value)}
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t.hazards_risk_score ?? "Score"}: {getRiskScore(form.severity, form.probability)} (
              {getRiskLevel(getRiskScore(form.severity, form.probability))})
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => setCreateOpen(false)}
                className="w-full sm:w-auto min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t.cancel ?? "Cancel"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitCreate()}
                className="w-full sm:w-auto min-h-[44px] rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-sm py-3 px-4"
              >
                {saving ? `${t.hazards_save ?? "Save"}…` : (t.hazards_save ?? "Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <div className="w-full max-w-md h-full overflow-y-auto bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white pr-2">{detail.title}</h3>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600 shrink-0"
                aria-label={t.hazards_close ?? "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{t.hazards_category ?? ""}</dt>
                <dd className="text-gray-900 dark:text-white">{catLabel(detail.category)}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{t.hazards_description ?? ""}</dt>
                <dd className="text-gray-900 dark:text-white whitespace-pre-wrap">
                  {detail.description ?? "—"}
                </dd>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sevBadgeClass(detail.severity)}`}>
                  {sevLabel(detail.severity)}
                </span>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700">
                  {probLabel(detail.probability)}
                </span>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700">
                  {t.hazards_risk_score ?? "Score"}: {detail.risk_score}
                </span>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{t.hazards_status ?? ""}</dt>
                <dd className="text-gray-900 dark:text-white">{statusLabel(detail.status)}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{t.hazards_location ?? ""}</dt>
                <dd className="text-gray-900 dark:text-white">{detail.location ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{t.hazards_reported_by ?? ""}</dt>
                <dd className="text-gray-900 dark:text-white">{detail.reported_by_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{t.hazards_assigned_to ?? ""}</dt>
                <dd className="text-gray-900 dark:text-white">{detail.assigned_to_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{t.hazards_due_date ?? ""}</dt>
                <dd className="text-gray-900 dark:text-white">{detail.due_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{t.hazards_resolved ?? ""}</dt>
                <dd className="text-gray-900 dark:text-white">
                  {detail.resolved_at ? formatDateTime(detail.resolved_at, dateLocale, timeZone) : "—"}
                </dd>
              </div>
            </dl>

            {!readOnly && onOpenCorrectiveFromHazard && (
              <button
                type="button"
                onClick={() => {
                  onOpenCorrectiveFromHazard({
                    hazardId: detail.id,
                    projectId: detail.project_id,
                    projectName: detail.project_name,
                  });
                  setDetail(null);
                }}
                className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-gray-800 text-zinc-800 dark:text-zinc-100 font-semibold text-sm py-3 hover:bg-zinc-50 dark:hover:bg-gray-700"
              >
                {t.hazards_new_corrective_action ?? t.actions_new ?? "Nueva acción correctiva"}
              </button>
            )}

            {!readOnly && (
              <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t.hazards_change_status ?? "Change status"}
                </h4>
                <select
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value as HazardStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
                <label className="block text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t.hazards_resolution_notes ?? "Notes"}
                  </span>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[80px] text-sm"
                    value={resolutionDraft}
                    onChange={(e) => setResolutionDraft(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveDetailStatus()}
                  className="w-full min-h-[44px] rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm py-3"
                >
                  {t.hazards_save_status ?? "Save status"}
                </button>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                {t.hazards_photos ?? "Photos"}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {(detail.photos ?? []).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="rounded-lg border border-gray-200 dark:border-gray-600 w-full h-28 object-cover"
                  />
                ))}
              </div>
              {!readOnly && (detail.photos?.length ?? 0) < MAX_PHOTOS && (
                <label className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void addPhotos(e.target.files)}
                  />
                  {t.hazards_add_photo ?? "Add photo"}
                </label>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                {t.hazards_corrective_actions ?? "Corrective"}
              </h4>
              <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                {(detail.corrective_actions ?? []).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
              {!readOnly && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                    value={correctiveDraft}
                    onChange={(e) => setCorrectiveDraft(e.target.value)}
                    placeholder={t.hazards_corrective_placeholder ?? ""}
                  />
                  <button
                    type="button"
                    onClick={() => void addCorrective()}
                    className="min-h-[44px] rounded-xl border border-amber-600 text-amber-700 dark:text-amber-400 font-medium px-4 py-2.5 text-sm"
                  >
                    {t.hazards_add_corrective ?? "Add"}
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {t.hazards_history ?? "History"}
              </h4>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t.hazards_history_empty ?? "—"}</p>
              ) : (
                <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400 max-h-48 overflow-y-auto">
                  {history.map((h) => (
                    <li key={h.id} className="border-b border-gray-100 dark:border-gray-800 pb-2">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{h.action}</span> ·{" "}
                      {h.user_name ?? "—"} · {formatDateTime(h.created_at, dateLocale, timeZone)}
                      {h.new_value != null && (
                        <pre className="mt-1 text-[10px] overflow-x-auto whitespace-pre-wrap break-all opacity-80">
                          {JSON.stringify(h.new_value, null, 0).slice(0, 200)}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
