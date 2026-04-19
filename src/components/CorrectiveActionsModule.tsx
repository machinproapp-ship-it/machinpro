"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCheck, Plus, Search, X, ImagePlus, Star, ExternalLink } from "lucide-react";
import { useToast } from "@/components/Toast";
import { FilterGrid } from "@/components/FilterGrid";
import { supabase } from "@/lib/supabase";
import { logAuditEvent } from "@/lib/useAuditLog";
import type { UserRole } from "@/types/shared";
import {
  type CorrectiveAction,
  type CorrectiveActionFormData,
  type ActionPriority,
  type ActionStatus,
  type ActionType,
} from "@/types/correctiveAction";
import { formatDateTime } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";

const CLOUDINARY_CLOUD = "dwdlmxmkt";
const CLOUDINARY_PRESET = "i5dmd07o";
const MAX_PHOTOS = 5;

const ACTION_TYPES: ActionType[] = ["immediate", "corrective", "preventive"];
const PRIORITIES: ActionPriority[] = ["low", "medium", "high", "critical"];
const STATUSES: ActionStatus[] = [
  "open",
  "in_progress",
  "pending_review",
  "verified",
  "closed",
];

export interface CorrectiveActionsPrefill {
  hazardId?: string | null;
  projectId?: string | null;
  projectName?: string | null;
}

export interface CorrectiveActionsModuleProps {
  t: Record<string, string>;
  companyId: string | null;
  companyName?: string | null;
  userRole: UserRole;
  userName: string;
  userProfileId: string | null;
  projects: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  prefill?: CorrectiveActionsPrefill | null;
  onConsumePrefill?: () => void;
  onNavigateToHazard?: (hazardId: string) => void;
  /** Increment desde el dashboard para abrir el alta de acción. */
  openCreateSignal?: number;
  lockedProjectId?: string | null;
  dateLocale: string;
  timeZone: string;
  manageCorrectiveActions?: boolean;
}

type AuditRow = {
  id: string;
  action: string;
  user_name?: string | null;
  created_at: string;
  new_value?: unknown;
};

function emptyForm(): CorrectiveActionFormData {
  return {
    title: "",
    description: "",
    root_cause: "",
    action_type: "corrective",
    priority: "medium",
    hazard_id: "",
    project_id: "",
    project_name: "",
    assigned_to: "",
    assigned_to_name: "",
    due_date: "",
    evidence_notes: "",
    tags: "",
  };
}

async function uploadPhoto(file: File): Promise<string> {
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

function isOverdue(row: CorrectiveAction): boolean {
  if (!row.due_date || row.status === "closed" || row.status === "verified") return false;
  const d = new Date(row.due_date + "T12:00:00");
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < t;
}

function isTerminal(s: ActionStatus): boolean {
  return s === "closed" || s === "verified";
}

export function CorrectiveActionsModule({
  t,
  companyId,
  companyName,
  userRole,
  userName,
  userProfileId,
  projects,
  employees,
  prefill,
  onConsumePrefill,
  onNavigateToHazard,
  openCreateSignal = 0,
  lockedProjectId = null,
  dateLocale,
  timeZone,
  manageCorrectiveActions,
}: CorrectiveActionsModuleProps) {
  void useMachinProDisplayPrefs();
  const readOnly =
    manageCorrectiveActions === undefined
      ? userRole === "worker"
      : !manageCorrectiveActions;
  const { showToast } = useToast();
  const lastCreateSig = useRef(0);
  const [rows, setRows] = useState<CorrectiveAction[]>([]);
  const [hazardTitles, setHazardTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState(() =>
    lockedProjectId ? lockedProjectId : "all"
  );
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
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

  const [detail, setDetail] = useState<CorrectiveAction | null>(null);
  const [form, setForm] = useState<CorrectiveActionFormData>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [profileOptions, setProfileOptions] = useState<{ id: string; name: string }[]>([]);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [statusDraft, setStatusDraft] = useState<ActionStatus>("open");
  const [verificationDraft, setVerificationDraft] = useState("");
  const [effectivenessDraft, setEffectivenessDraft] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !companyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("corrective_actions")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as CorrectiveAction[];
    setRows(list);
    const hIds = [...new Set(list.map((r) => r.hazard_id).filter(Boolean))] as string[];
    if (hIds.length) {
      const { data: hz } = await supabase.from("hazards").select("id,title").in("id", hIds);
      const map: Record<string, string> = {};
      for (const h of hz ?? []) {
        const row = h as { id: string; title: string };
        map[row.id] = row.title;
      }
      setHazardTitles(map);
    } else {
      setHazardTitles({});
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!prefill || !companyId) return;
    const hasLink = Boolean(prefill.hazardId || prefill.projectId);
    if (!hasLink) {
      onConsumePrefill?.();
      return;
    }
    setForm({
      ...emptyForm(),
      hazard_id: prefill.hazardId ?? "",
      project_id: prefill.projectId ?? "",
      project_name: prefill.projectName ?? "",
    });
    setCreateOpen(true);
    onConsumePrefill?.();
  }, [prefill, companyId, onConsumePrefill]);

  useEffect(() => {
    if (!supabase || !companyId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, employee_id")
        .eq("company_id", companyId);
      if (cancelled || !data) return;
      setProfileOptions(
        (data as { id: string; employee_id: string | null }[]).map((p) => ({
          id: p.id,
          name:
            employees.find((e) => e.id === p.employee_id)?.name ??
            p.id.slice(0, 8) + "…",
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, employees]);

  const loadHistory = useCallback(async (id: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from("audit_logs")
      .select("id, action, user_name, created_at, new_value")
      .eq("entity_type", "corrective_action")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data as AuditRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (detail?.id) void loadHistory(detail.id);
    else setHistory([]);
  }, [detail?.id, loadHistory]);

  useEffect(() => {
    if (detail) {
      setStatusDraft(detail.status);
      setVerificationDraft(detail.verification_notes ?? "");
      setEffectivenessDraft(detail.effectiveness_rating ?? null);
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
      if (filterType !== "all" && r.action_type !== filterType) return false;
      if (filterPriority !== "all" && r.priority !== filterPriority) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterAssignee !== "all") {
        if (filterAssignee === "unassigned" && r.assigned_to) return false;
        if (filterAssignee !== "unassigned" && r.assigned_to !== filterAssignee)
          return false;
      }
      if (q) {
        const a = (r.title ?? "").toLowerCase();
        const b = (r.description ?? "").toLowerCase();
        if (!a.includes(q) && !b.includes(q)) return false;
      }
      return true;
    });
  }, [
    rowsScoped,
    search,
    filterProject,
    filterType,
    filterPriority,
    filterStatus,
    filterAssignee,
  ]);

  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const stats = useMemo(() => {
    const open = rowsScoped.filter((r) => r.status === "open").length;
    const inProg = rowsScoped.filter((r) => r.status === "in_progress").length;
    const overdue = rowsScoped.filter(isOverdue).length;
    const closedWeek = rowsScoped.filter(
      (r) =>
        r.status === "closed" &&
        r.updated_at &&
        new Date(r.updated_at) >= weekAgo
    ).length;
    const typeDist: Record<ActionType, number> = {
      immediate: 0,
      corrective: 0,
      preventive: 0,
    };
    for (const r of rowsScoped) {
      if (!isTerminal(r.status)) typeDist[r.action_type] = (typeDist[r.action_type] ?? 0) + 1;
    }
    return { open, inProg, overdue, closedWeek, typeDist };
  }, [rowsScoped, weekAgo]);

  const maxType = Math.max(1, ...Object.values(stats.typeDist));

  const typeLabel = (x: ActionType) =>
    (t as Record<string, string>)[`actions_type_${x}`] ?? x;
  const priLabel = (x: ActionPriority) =>
    (t as Record<string, string>)[`actions_priority_${x}`] ?? x;
  const stLabel = (x: ActionStatus) =>
    (t as Record<string, string>)[
      x === "pending_review" ? "actions_status_pending" : `actions_status_${x}`
    ] ?? x;

  const priBadge = (p: ActionPriority) => {
    switch (p) {
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

  const stBadge = (s: ActionStatus) => {
    if (s === "closed" || s === "verified")
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    if (s === "pending_review")
      return "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300";
    return "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  };

  const submitCreate = async () => {
    if (!supabase || !companyId || readOnly || !form.title.trim()) return;
    setSaving(true);
    const tags = form.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      company_id: companyId,
      hazard_id: form.hazard_id || null,
      project_id: form.project_id || null,
      project_name: form.project_name || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      root_cause: form.root_cause.trim() || null,
      action_type: form.action_type,
      priority: form.priority,
      status: "open" as const,
      assigned_to: form.assigned_to || null,
      assigned_to_name: form.assigned_to_name.trim() || null,
      created_by: userProfileId,
      created_by_name: userName,
      due_date: form.due_date || null,
      photos: [] as string[],
      evidence_notes: form.evidence_notes.trim() || null,
      tags,
    };
    const { data, error } = await supabase
      .from("corrective_actions")
      .insert(payload)
      .select("id")
      .single();
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
      action: "action_created",
      entity_type: "corrective_action",
      entity_id: id,
      entity_name: form.title.trim(),
      new_value: { details: payload },
    });
    showToast("success", t.toast_saved ?? "Saved");
    setCreateOpen(false);
    setForm(emptyForm());
    void load();
  };

  const saveDetailStatus = async () => {
    if (!supabase || !companyId || !detail || readOnly) return;
    const prev = detail.status;
    const now = new Date().toISOString();
    const patch: Partial<CorrectiveAction> = {
      status: statusDraft,
      verification_notes: verificationDraft.trim() || null,
      effectiveness_rating: effectivenessDraft,
    };
    if (statusDraft === "verified") {
      patch.verified_at = detail.verified_at ?? now;
      patch.verified_by_name = userName;
    }
    if (statusDraft === "closed") {
      patch.completed_at = detail.completed_at ?? now;
    }

    const { error } = await supabase
      .from("corrective_actions")
      .update(patch)
      .eq("id", detail.id);
    if (error) {
      console.error(error);
      showToast("error", t.toast_error ?? "Error");
      return;
    }

    showToast("success", t.toast_saved ?? "Saved");

    let action: "action_status_changed" | "action_verified" | "action_closed" =
      "action_status_changed";
    if (statusDraft === "verified" && prev !== "verified") action = "action_verified";
    else if (statusDraft === "closed" && prev !== "closed") action = "action_closed";

    void logAuditEvent({
      company_id: companyId,
      user_id: userProfileId ?? "",
      user_name: userName,
      action,
      entity_type: "corrective_action",
      entity_id: detail.id,
      entity_name: detail.title,
      old_value: { details: { status: prev } },
      new_value: {
        details: {
          status: statusDraft,
          verification_notes: verificationDraft.trim() || null,
          effectiveness_rating: effectivenessDraft,
        },
      },
    });
    void load();
    setDetail((d) => (d ? { ...d, ...patch } : null));
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files || !detail || readOnly || !supabase) return;
    const room = MAX_PHOTOS - (detail.photos?.length ?? 0);
    if (room <= 0) return;
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, room)) {
      try {
        urls.push(await uploadPhoto(f));
      } catch {
        /* ignore */
      }
    }
    if (!urls.length) return;
    const next = [...(detail.photos ?? []), ...urls];
    const { error } = await supabase
      .from("corrective_actions")
      .update({ photos: next })
      .eq("id", detail.id);
    if (error) {
      showToast("error", t.toast_error ?? "Error");
      return;
    }
    showToast("success", t.toast_saved ?? "Saved");
    setDetail({ ...detail, photos: next });
    void load();
  };

  if (!companyId) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center text-gray-600 dark:text-gray-400">
        {t.actions_no_company ?? t.hazards_no_company ?? "—"}
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center text-gray-600 dark:text-gray-400">
        {t.actions_error ?? t.hazards_error ?? "—"}
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-amber-500 shrink-0" />
            {t.actions_title ?? "Corrective actions"}
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
            {t.actions_new ?? "New"}
          </button>
        )}
      </div>

      {stats.overdue > 0 && (
        <div
          className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-medium text-red-800 dark:text-red-200"
          role="alert"
        >
          {t.actions_overdue ?? "Overdue"}: {stats.overdue}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t.actions_stats_open ?? "Open"}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {stats.open}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t.actions_status_in_progress ?? "In progress"}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {stats.inProg}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t.actions_stats_overdue ?? "Overdue"}
          </p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {stats.overdue}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t.actions_stats_closed_week ?? "Closed (7d)"}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {stats.closedWeek}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {t.actions_dist_type ?? t.actions_type ?? "Types"}
        </h3>
        <div className="space-y-2">
          {ACTION_TYPES.map((ty) => (
            <div key={ty} className="flex items-center gap-2">
              <span className="text-xs w-28 shrink-0 truncate text-gray-600 dark:text-gray-400">
                {typeLabel(ty)}
              </span>
              <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{
                    width: `${((stats.typeDist[ty] ?? 0) / maxType) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs tabular-nums w-6 text-right text-gray-600 dark:text-gray-300">
                {stats.typeDist[ty] ?? 0}
              </span>
            </div>
          ))}
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
          <span className="text-gray-600 dark:text-gray-400">{t.actions_type ?? "Type"}</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{t.hazards_filter_all ?? "All"}</option>
            {ACTION_TYPES.map((x) => (
              <option key={x} value={x}>
                {typeLabel(x)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[140px]">
          <span className="text-gray-600 dark:text-gray-400">{t.actions_priority ?? "Priority"}</span>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{t.hazards_filter_all ?? "All"}</option>
            {PRIORITIES.map((x) => (
              <option key={x} value={x}>
                {priLabel(x)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[140px]">
          <span className="text-gray-600 dark:text-gray-400">{t.actions_status ?? "Status"}</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{t.hazards_filter_all ?? "All"}</option>
            {STATUSES.map((x) => (
              <option key={x} value={x}>
                {stLabel(x)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[160px]">
          <span className="text-gray-600 dark:text-gray-400">{t.actions_assigned ?? "Assigned"}</span>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{t.hazards_filter_all ?? "All"}</option>
            <option value="unassigned">{t.hazards_no_assignee ?? "—"}</option>
            {profileOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800/50 py-14 px-4 text-center">
            <ClipboardCheck className="h-16 w-16 text-gray-300 dark:text-gray-600" aria-hidden />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              {t.empty_no_actions ?? t.actions_no_results ?? "No corrective actions yet"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
              {t.empty_actions_sub ?? ""}
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                {t.empty_add_first ?? t.actions_new ?? "Add"}
              </button>
            )}
          </div>
        ) : (
          filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setDetail(r)}
              className={`w-full text-left rounded-xl border bg-white dark:bg-gray-800 p-4 space-y-2 min-h-[44px] ${
                isOverdue(r)
                  ? "border-red-400 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-900"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-gray-900 dark:text-white">{r.title}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${priBadge(r.priority)}`}>
                  {priLabel(r.priority)}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {typeLabel(r.action_type)} · {stLabel(r.status)} ·{" "}
                {r.due_date ?? "—"}
                {isOverdue(r) && (
                  <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                    {t.actions_overdue ?? "Overdue"}
                  </span>
                )}
              </p>
              {r.hazard_id && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t.actions_hazard_linked ?? "Hazard"}: {hazardTitles[r.hazard_id] ?? r.hazard_id.slice(0, 8)}
                </p>
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 px-4 text-center">
            <ClipboardCheck className="h-16 w-16 text-gray-300 dark:text-gray-600" aria-hidden />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              {t.empty_no_actions ?? t.actions_no_results ?? "No corrective actions yet"}
            </h3>
            <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
              {t.empty_actions_sub ?? ""}
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                {t.empty_add_first ?? t.actions_new ?? "Add"}
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t.actions_title_col ?? "Title"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.actions_type ?? "Type"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.actions_priority ?? "Pri"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.actions_status ?? "Status"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.actions_assigned ?? "Assign"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.actions_hazard_linked ?? "Hazard"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.actions_due_date ?? "Due"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    isOverdue(r) ? "bg-red-50/50 dark:bg-red-950/20" : ""
                  }`}
                  onClick={() => setDetail(r)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                    {r.title}
                    {isOverdue(r) && (
                      <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                        ({t.actions_overdue ?? "!"})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{typeLabel(r.action_type)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priBadge(r.priority)}`}>
                      {priLabel(r.priority)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stBadge(r.status)}`}>
                      {stLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 truncate max-w-[120px]">
                    {r.assigned_to_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 truncate max-w-[140px]">
                    {r.hazard_id ? hazardTitles[r.hazard_id] ?? "—" : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {r.due_date ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="mx-auto max-h-[95vh] w-full max-w-[calc(100vw-2rem)] space-y-4 overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:max-w-lg sm:rounded-2xl md:max-w-xl lg:max-w-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t.actions_new ?? "New"}
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
              <span className="text-gray-600 dark:text-gray-400">{t.actions_title_col ?? "Title"} *</span>
              <input
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t.hazards_description ?? "Desc"}</span>
              <textarea
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[72px] text-sm"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t.actions_root_cause ?? "Root cause"}</span>
              <textarea
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[60px] text-sm"
                value={form.root_cause}
                onChange={(e) => setForm((f) => ({ ...f, root_cause: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t.actions_type ?? "Type"}</span>
                <select
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                  value={form.action_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, action_type: e.target.value as ActionType }))
                  }
                >
                  {ACTION_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {typeLabel(x)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t.actions_priority ?? "Priority"}</span>
                <select
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: e.target.value as ActionPriority }))
                  }
                >
                  {PRIORITIES.map((x) => (
                    <option key={x} value={x}>
                      {priLabel(x)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-gray-600 dark:text-gray-400">{t.actions_due_date ?? "Due"}</span>
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
                    setForm((f) => ({
                      ...f,
                      project_id: id,
                      project_name: projects.find((p) => p.id === id)?.name ?? "",
                    }));
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
              <span className="text-gray-600 dark:text-gray-400">
                {t.actions_hazard_linked ?? "Hazard"} (ID)
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm font-mono text-xs"
                placeholder={(t as Record<string, string>).hazards_hazard_id_placeholder ?? "Hazard UUID"}
                value={form.hazard_id}
                onChange={(e) => setForm((f) => ({ ...f, hazard_id: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t.actions_assigned ?? "Assigned"}</span>
              <select
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                value={form.assigned_to}
                onChange={(e) => {
                  const id = e.target.value;
                  setForm((f) => ({
                    ...f,
                    assigned_to: id,
                    assigned_to_name: profileOptions.find((p) => p.id === id)?.name ?? "",
                  }));
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
              <span className="text-gray-600 dark:text-gray-400">{t.actions_evidence ?? "Evidence notes"}</span>
              <textarea
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[60px] text-sm"
                value={form.evidence_notes}
                onChange={(e) => setForm((f) => ({ ...f, evidence_notes: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t.hazards_tags ?? "Tags"}</span>
              <input
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </label>
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
          <div className="h-full w-full min-w-0 max-w-[min(28rem,calc(100vw-2rem))] space-y-4 overflow-y-auto overflow-x-hidden border-l border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:max-w-md sm:p-6 md:max-w-lg lg:max-w-xl xl:max-w-2xl lg:p-8">
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
            {detail.hazard_id && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  <span className="font-medium">{t.actions_hazard_linked ?? "Hazard"}:</span>{" "}
                  {hazardTitles[detail.hazard_id] ?? detail.hazard_id}
                </p>
                {onNavigateToHazard && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToHazard(detail.hazard_id!);
                      setDetail(null);
                    }}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 px-3 py-2 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t.actions_open_hazard ?? "Open"}
                  </button>
                )}
              </div>
            )}
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{t.actions_root_cause ?? ""}</dt>
                <dd className="text-gray-900 dark:text-white">{detail.root_cause ?? "—"}</dd>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priBadge(detail.priority)}`}>
                  {priLabel(detail.priority)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stBadge(detail.status)}`}>
                  {stLabel(detail.status)}
                </span>
              </div>
            </dl>

            {!readOnly && (
              <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t.hazards_change_status ?? "Status"}
                </h4>
                <select
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value as ActionStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {stLabel(s)}
                    </option>
                  ))}
                </select>
                <label className="block text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t.actions_verify ?? t.actions_verified ?? "Verification"}
                  </span>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[72px] text-sm"
                    value={verificationDraft}
                    onChange={(e) => setVerificationDraft(e.target.value)}
                  />
                </label>
                {(statusDraft === "closed" || statusDraft === "verified") && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {t.actions_effectiveness ?? "Effectiveness"} (1–5)
                    </p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setEffectivenessDraft(n)}
                          className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center ${
                            effectivenessDraft === n
                              ? "border-amber-500 bg-amber-100 dark:bg-amber-900/40"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                          aria-label={`${n}`}
                        >
                          <Star
                            className={`h-5 w-5 ${
                              effectivenessDraft != null && n <= effectivenessDraft
                                ? "text-amber-500 fill-amber-500"
                                : "text-gray-400"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void saveDetailStatus()}
                  className="w-full min-h-[44px] rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm py-3"
                >
                  {t.hazards_save_status ?? "Save"}
                </button>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                {t.actions_evidence ?? "Evidence"}
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {t.hazards_history ?? "History"}
              </h4>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t.hazards_history_empty ?? "—"}</p>
              ) : (
                <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400 max-h-48 overflow-y-auto">
                  {history.map((h) => (
                    <li key={h.id} className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{h.action}</span> ·{" "}
                      {h.user_name ?? "—"} · {formatDateTime(h.created_at, dateLocale, timeZone)}
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
