"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  GraduationCap,
  Loader2,
  Plus,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CustomRole } from "@/types/roles";
import type { UserRole } from "@/types/shared";
import {
  TRAINING_COURSE_CATEGORIES,
  type TrainingAssignmentRow,
  type TrainingCourseCategory,
  type TrainingCourseRow,
  type TrainingDisplayStatus,
  trainingDisplayStatus,
} from "@/types/training";
import { useToast } from "@/components/Toast";
import { ALL_TRANSLATIONS } from "@/lib/i18n";

export type TrainingEmployeeOption = {
  id: string;
  name: string;
  role?: string;
  customRoleId?: string;
};

export interface TrainingHubModuleProps {
  t: Record<string, string>;
  companyId: string | null;
  userProfileId: string | null;
  userName: string;
  /** Solo administradores gestionan cursos y asignaciones (alineado con RLS). */
  canManageTraining: boolean;
  employees: TrainingEmployeeOption[];
  customRoles: CustomRole[];
  dateLocale: string;
  cloudinaryCloudName: string;
  cloudinaryUploadPreset: string;
}

function L(t: Record<string, string>, key: string, fb: string) {
  return (
    (t[key] as string | undefined) ||
    (ALL_TRANSLATIONS.en as Record<string, string>)[key] ||
    fb
  );
}

function categoryLabel(t: Record<string, string>, cat: string | null): string {
  if (!cat) return L(t, "training_cat_other", "Other");
  const k = `training_cat_${cat}` as keyof typeof t;
  return (t[k as string] as string | undefined) || cat;
}

function expiresAtForAssignment(
  createdAt: string,
  course: TrainingCourseRow | undefined
): string | null {
  const days = course?.expires_after_days;
  if (days == null || days <= 0) return null;
  const d = new Date(createdAt);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function roleLabel(
  t: Record<string, string>,
  role: string,
  customRoles: CustomRole[],
  customRoleId?: string
): string {
  if (customRoleId) {
    const cr = customRoles.find((r) => r.id === customRoleId);
    if (cr?.name) return cr.name;
  }
  const m: Record<string, string> = {
    admin: L(t, "admin", "Admin"),
    supervisor: L(t, "supervisor", "Supervisor"),
    worker: L(t, "worker", "Worker"),
    logistic: L(t, "warehouse", "Logistics"),
    projectManager: L(t, "project_manager", "Project manager"),
  };
  return m[role] ?? role;
}

export function TrainingHubModule({
  t,
  companyId,
  userProfileId,
  userName,
  canManageTraining,
  employees,
  customRoles,
  dateLocale,
  cloudinaryCloudName,
  cloudinaryUploadPreset,
}: TrainingHubModuleProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<TrainingCourseRow[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignmentRow[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | TrainingDisplayStatus>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const [courseModal, setCourseModal] = useState<TrainingCourseRow | "new" | null>(null);
  const [assignModalCourse, setAssignModalCourse] = useState<TrainingCourseRow | null>(null);
  const [assignMode, setAssignMode] = useState<"people" | "role">("people");
  const [assignSelectedIds, setAssignSelectedIds] = useState<Set<string>>(new Set());
  const [assignRoleKey, setAssignRoleKey] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const courseById = useMemo(() => {
    const m = new Map<string, TrainingCourseRow>();
    for (const c of courses) m.set(c.id, c);
    return m;
  }, [courses]);

  const load = useCallback(async () => {
    if (!supabase || !companyId) {
      setCourses([]);
      setAssignments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [cRes, aRes] = await Promise.all([
      supabase.from("training_courses").select("*").eq("company_id", companyId).order("created_at", {
        ascending: false,
      }),
      supabase.from("training_assignments").select("*").eq("company_id", companyId),
    ]);
    if (cRes.error) {
      console.error("[TrainingHub] courses", cRes.error);
      showToast("error", L(t, "training_load_error", "Could not load training data"));
    } else {
      setCourses((cRes.data as TrainingCourseRow[]) ?? []);
    }
    if (aRes.error) {
      console.error("[TrainingHub] assignments", aRes.error);
    } else {
      setAssignments((aRes.data as TrainingAssignmentRow[]) ?? []);
    }
    setLoading(false);
  }, [companyId, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCourses = useMemo(() => {
    if (canManageTraining && showArchived) return courses;
    return courses.filter((c) => !c.is_archived);
  }, [courses, canManageTraining, showArchived]);

  const assignmentRows = useMemo(() => {
    let rows = assignments.map((a) => {
      const c = courseById.get(a.course_id);
      const disp = trainingDisplayStatus(a, c?.expires_after_days);
      return { a, c, disp };
    });
    if (!canManageTraining && userProfileId) {
      rows = rows.filter((r) => r.a.user_id === userProfileId);
    }
    if (filterEmployee !== "all") {
      rows = rows.filter((r) => r.a.user_id === filterEmployee);
    }
    if (filterStatus !== "all") {
      rows = rows.filter((r) => r.disp === filterStatus);
    }
    if (filterCategory !== "all") {
      rows = rows.filter((r) => r.c?.category === filterCategory);
    }
    rows.sort((x, y) => new Date(y.a.created_at).getTime() - new Date(x.a.created_at).getTime());
    return rows;
  }, [
    assignments,
    courseById,
    canManageTraining,
    userProfileId,
    filterEmployee,
    filterStatus,
    filterCategory,
  ]);

  const employeeName = useCallback(
    (id: string) => employees.find((e) => e.id === id)?.name ?? id.slice(0, 8),
    [employees]
  );

  const uploadPdf = async (file: File): Promise<string | null> => {
    if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
      showToast("error", L(t, "training_cloudinary_missing", "Cloudinary is not configured"));
      return null;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", cloudinaryUploadPreset);
    fd.append("folder", "machinpro/training");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/raw/upload`, {
      method: "POST",
      body: fd,
    });
    const data = (await res.json()) as { secure_url?: string };
    if (!data.secure_url) {
      showToast("error", L(t, "training_upload_failed", "Upload failed"));
      return null;
    }
    return data.secure_url;
  };

  const markComplete = async (assignmentId: string) => {
    if (!supabase) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("training_assignments")
      .update({ status: "completed", completed_at: now })
      .eq("id", assignmentId);
    setSaving(false);
    if (error) {
      showToast("error", error.message);
      return;
    }
    showToast("success", L(t, "training_saved", "Saved"));
    void load();
  };

  const toggleArchiveCourse = async (c: TrainingCourseRow) => {
    if (!supabase || !canManageTraining) return;
    setSaving(true);
    const { error } = await supabase
      .from("training_courses")
      .update({ is_archived: !c.is_archived })
      .eq("id", c.id);
    setSaving(false);
    if (error) {
      showToast("error", error.message);
      return;
    }
    void load();
  };

  const saveCourse = async (payload: {
    id?: string;
    title: string;
    description: string;
    category: TrainingCourseCategory;
    duration_minutes: number | "";
    expires_after_days: number | "";
    document_url: string;
    is_archived: boolean;
  }) => {
    if (!supabase || !companyId || !canManageTraining) return;
    setSaving(true);
    const base = {
      title: payload.title.trim(),
      description: payload.description.trim() || null,
      category: payload.category,
      duration_minutes: payload.duration_minutes === "" ? null : Number(payload.duration_minutes),
      expires_after_days:
        payload.expires_after_days === "" ? null : Number(payload.expires_after_days),
      document_url: payload.document_url.trim() || null,
      is_archived: payload.is_archived,
    };
    if (payload.id) {
      const { error } = await supabase.from("training_courses").update(base).eq("id", payload.id);
      setSaving(false);
      if (error) showToast("error", error.message);
      else {
        showToast("success", L(t, "training_saved", "Saved"));
        setCourseModal(null);
        void load();
      }
      return;
    }
    const { error } = await supabase.from("training_courses").insert({
      ...base,
      company_id: companyId,
      created_by: userProfileId,
    });
    setSaving(false);
    if (error) showToast("error", error.message);
    else {
      showToast("success", L(t, "training_saved", "Saved"));
      setCourseModal(null);
      void load();
    }
  };

  const submitAssign = async () => {
    if (!supabase || !companyId || !assignModalCourse || !userProfileId || !canManageTraining) return;
    const course = assignModalCourse;
    let userIds: string[] = [];
    if (assignMode === "people") {
      userIds = [...assignSelectedIds];
    } else {
      if (!assignRoleKey) {
        showToast("error", L(t, "training_pick_role", "Select a role"));
        return;
      }
      if (assignRoleKey.startsWith("custom:")) {
        const crId = assignRoleKey.slice("custom:".length);
        userIds = employees.filter((e) => e.customRoleId === crId).map((e) => e.id);
      } else {
        userIds = employees.filter((e) => (e.role ?? "worker") === assignRoleKey).map((e) => e.id);
      }
    }
    if (userIds.length === 0) {
      showToast("error", L(t, "training_no_assignees", "No people to assign"));
      return;
    }
    const existing = new Set(
      assignments.filter((a) => a.course_id === course.id).map((a) => a.user_id)
    );
    const toInsert = userIds.filter((id) => !existing.has(id));
    if (toInsert.length === 0) {
      showToast("error", L(t, "training_already_assigned", "Already assigned"));
      return;
    }
    setSaving(true);
    const createdIso = new Date().toISOString();
    const rows = toInsert.map((user_id) => ({
      company_id: companyId,
      course_id: course.id,
      user_id,
      assigned_by: userProfileId,
      status: "pending" as const,
      completed_at: null as string | null,
      expires_at: expiresAtForAssignment(createdIso, course),
    }));
    const { error } = await supabase.from("training_assignments").insert(rows);
    setSaving(false);
    if (error) {
      showToast("error", error.message);
      return;
    }
    showToast("success", L(t, "training_saved", "Saved"));
    setAssignModalCourse(null);
    setAssignSelectedIds(new Set());
    setAssignRoleKey("");
    void load();
  };

  const statusBadge = (disp: TrainingDisplayStatus) => {
    if (disp === "completed")
      return (
        <span className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:text-emerald-100">
          {L(t, "training_completed", "Completed")}
        </span>
      );
    if (disp === "expired")
      return (
        <span className="inline-flex rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-900 dark:text-red-100">
          {L(t, "training_expired", "Expired")}
        </span>
      );
    return (
      <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-950 dark:text-amber-100">
        {L(t, "training_pending", "Pending")}
      </span>
    );
  };

  if (!companyId) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
        {L(t, "training_no_company", "Select a company")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white truncate">
            {L(t, "training_courses", "Courses")}
          </h3>
        </div>
        {canManageTraining ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCourseModal("new")}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              {L(t, "training_new_course", "New course")}
            </button>
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              {L(t, "training_show_archived", "Show archived")}
            </label>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {L(t, "loading", "Loading…")}
        </div>
      ) : null}

      {canManageTraining && visibleCourses.length > 0 ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visibleCourses.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-white truncate">{c.title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {categoryLabel(t, c.category)}
                    {c.duration_minutes != null ? ` · ${c.duration_minutes} min` : ""}
                  </p>
                  {c.is_archived ? (
                    <span className="mt-1 inline-block text-xs text-zinc-500">
                      {L(t, "training_archived", "Archived")}
                    </span>
                  ) : null}
                </div>
                <BookOpen className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
              </div>
              {c.description ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 line-clamp-3">{c.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {c.document_url ? (
                  <a
                    href={c.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-amber-600 dark:text-amber-400 underline"
                  >
                    {L(t, "training_open_pdf", "Open PDF")}
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={!canManageTraining || saving}
                  onClick={() => setCourseModal(c)}
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-200 underline"
                >
                  {L(t, "common_edit", "Edit")}
                </button>
                <button
                  type="button"
                  disabled={!canManageTraining || saving}
                  onClick={() => void toggleArchiveCourse(c)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                >
                  {c.is_archived ? (
                    <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Archive className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {c.is_archived
                    ? L(t, "training_unarchive", "Restore")
                    : L(t, "training_archive", "Archive")}
                </button>
                {!c.is_archived ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setAssignModalCourse(c);
                      setAssignMode("people");
                      setAssignSelectedIds(new Set());
                      setAssignRoleKey("");
                    }}
                    className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-300"
                  >
                    <UserPlus className="h-3.5 w-3.5" aria-hidden />
                    {L(t, "training_assign", "Assign")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : canManageTraining && !loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
          {L(t, "training_no_courses", "No courses yet")}
        </p>
      ) : null}

      {!canManageTraining && !loading && visibleCourses.length === 0 && assignmentRows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
          {L(t, "training_no_assignments", "No assignments")}
        </p>
      ) : null}

      <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/80 dark:bg-slate-900/50 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {L(t, "training_assignments_title", "Assignments")}
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {canManageTraining ? (
            <label className="block text-xs text-zinc-600 dark:text-zinc-400">
              {L(t, "training_filter_employee", "Employee")}
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="all">{L(t, "training_all", "All")}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-zinc-500 sm:col-span-2">
              {userName} · {L(t, "training_my_assignments", "My assignments")}
            </p>
          )}
          <label className="block text-xs text-zinc-600 dark:text-zinc-400">
            {L(t, "training_filter_status", "Status")}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            >
              <option value="all">{L(t, "training_all", "All")}</option>
              <option value="pending">{L(t, "training_pending", "Pending")}</option>
              <option value="completed">{L(t, "training_completed", "Completed")}</option>
              <option value="expired">{L(t, "training_expired", "Expired")}</option>
            </select>
          </label>
          <label className="block text-xs text-zinc-600 dark:text-zinc-400">
            {L(t, "training_filter_category", "Category")}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            >
              <option value="all">{L(t, "training_all", "All")}</option>
              {TRAINING_COURSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(t, c)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className="space-y-2 sm:hidden">
          {assignmentRows.length === 0 ? (
            <li className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-slate-900 py-6 text-center text-sm text-zinc-500 italic">
              {L(t, "training_no_rows", "No rows")}
            </li>
          ) : (
            assignmentRows.map(({ a, c, disp }) => (
              <li
                key={a.id}
                className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 text-sm space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{c?.title ?? L(t, "common_dash", "—")}</p>
                    {canManageTraining ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{employeeName(a.user_id)}</p>
                    ) : null}
                  </div>
                  {statusBadge(disp)}
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  {L(t, "training_col_completed", "Completed")}:{" "}
                  {a.completed_at
                    ? new Date(a.completed_at).toLocaleDateString(dateLocale)
                    : L(t, "common_dash", "—")}
                </p>
                {disp !== "completed" && a.user_id === userProfileId ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void markComplete(a.id)}
                    className="w-full min-h-[44px] rounded-lg border border-amber-500/60 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  >
                    {L(t, "training_mark_complete", "Mark complete")}
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>

        <div className="hidden sm:block overflow-x-auto rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-slate-900">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50">
                <th className="text-left py-2 px-3 font-medium text-zinc-600 dark:text-zinc-400">
                  {L(t, "training_col_course", "Course")}
                </th>
                {canManageTraining ? (
                  <th className="text-left py-2 px-3 font-medium text-zinc-600 dark:text-zinc-400">
                    {L(t, "training_col_employee", "Employee")}
                  </th>
                ) : null}
                <th className="text-left py-2 px-3 font-medium text-zinc-600 dark:text-zinc-400">
                  {L(t, "training_filter_status", "Status")}
                </th>
                <th className="text-left py-2 px-3 font-medium text-zinc-600 dark:text-zinc-400">
                  {L(t, "training_col_completed", "Completed")}
                </th>
                <th className="w-32 py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {assignmentRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageTraining ? 5 : 4}
                    className="py-6 px-3 text-center text-zinc-500 italic"
                  >
                    {L(t, "training_no_rows", "No rows")}
                  </td>
                </tr>
              ) : (
                assignmentRows.map(({ a, c, disp }) => (
                  <tr
                    key={a.id}
                    className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30"
                  >
                    <td className="py-2 px-3 text-zinc-900 dark:text-zinc-100">
                      {c?.title ?? L(t, "common_dash", "—")}
                    </td>
                    {canManageTraining ? (
                      <td className="py-2 px-3 text-zinc-700 dark:text-zinc-200">
                        {employeeName(a.user_id)}
                      </td>
                    ) : null}
                    <td className="py-2 px-3">{statusBadge(disp)}</td>
                    <td className="py-2 px-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                      {a.completed_at
                        ? new Date(a.completed_at).toLocaleDateString(dateLocale)
                        : L(t, "common_dash", "—")}
                    </td>
                    <td className="py-2 px-3">
                      {disp !== "completed" && a.user_id === userProfileId ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void markComplete(a.id)}
                          className="rounded-lg border border-amber-500/60 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        >
                          {L(t, "training_mark_complete", "Mark complete")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {courseModal ? (
        <CourseEditModal
          t={t}
          initial={courseModal === "new" ? null : courseModal}
          saving={saving}
          onClose={() => setCourseModal(null)}
          onSave={(p) => void saveCourse(p)}
          uploadPdf={uploadPdf}
        />
      ) : null}

      {assignModalCourse ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center bg-black/50 p-0 sm:p-4"
          role="dialog"
          aria-modal
          aria-labelledby="assign-training-title"
        >
          <div className="max-h-[min(90dvh,100svh)] w-full min-w-0 max-w-none overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-slate-900 sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2">
              <h4 id="assign-training-title" className="text-lg font-semibold text-zinc-900 dark:text-white">
                {L(t, "training_assign", "Assign")}: {assignModalCourse.title}
              </h4>
              <button
                type="button"
                onClick={() => setAssignModalCourse(null)}
                className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label={L(t, "common_close", "Close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setAssignMode("people")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                  assignMode === "people"
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100"
                    : "border border-zinc-300 dark:border-zinc-600"
                }`}
              >
                {L(t, "training_assign_people", "People")}
              </button>
              <button
                type="button"
                onClick={() => setAssignMode("role")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                  assignMode === "role"
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100"
                    : "border border-zinc-300 dark:border-zinc-600"
                }`}
              >
                {L(t, "training_assign_role", "By role")}
              </button>
            </div>
            {assignMode === "people" ? (
              <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 dark:border-white/10 p-2">
                {employees.map((e) => (
                  <li key={e.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <input
                        type="checkbox"
                        checked={assignSelectedIds.has(e.id)}
                        onChange={() => {
                          setAssignSelectedIds((prev) => {
                            const n = new Set(prev);
                            if (n.has(e.id)) n.delete(e.id);
                            else n.add(e.id);
                            return n;
                          });
                        }}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      <span className="text-sm text-zinc-800 dark:text-zinc-100">{e.name}</span>
                      <span className="text-xs text-zinc-500">
                        {roleLabel(t, e.role ?? "worker", customRoles, e.customRoleId)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3">
                <label className="block text-xs text-zinc-600 dark:text-zinc-400">
                  {L(t, "training_role", "Role")}
                  <select
                    value={assignRoleKey}
                    onChange={(e) => setAssignRoleKey(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="">{L(t, "training_pick_role", "Select a role")}</option>
                    {(["admin", "supervisor", "worker", "logistic", "projectManager"] as UserRole[]).map(
                      (r) => (
                        <option key={r} value={r}>
                          {roleLabel(t, r, customRoles)}
                        </option>
                      )
                    )}
                    {customRoles
                      .filter((r) => !r.isSystem)
                      .map((r) => (
                        <option key={r.id} value={`custom:${r.id}`}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="mt-2 text-xs text-zinc-500">{L(t, "training_role_hint", "")}</p>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignModalCourse(null)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
              >
                {L(t, "common_cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitAssign()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {L(t, "training_assign", "Assign")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CourseEditModal({
  t,
  initial,
  saving,
  onClose,
  onSave,
  uploadPdf,
}: {
  t: Record<string, string>;
  initial: TrainingCourseRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (p: {
    id?: string;
    title: string;
    description: string;
    category: TrainingCourseCategory;
    duration_minutes: number | "";
    expires_after_days: number | "";
    document_url: string;
    is_archived: boolean;
  }) => void;
  uploadPdf: (f: File) => Promise<string | null>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<TrainingCourseCategory>(() => {
    const c = initial?.category;
    if (c && TRAINING_COURSE_CATEGORIES.includes(c as TrainingCourseCategory)) {
      return c as TrainingCourseCategory;
    }
    return "safety";
  });
  const [duration, setDuration] = useState<number | "">(
    initial?.duration_minutes ?? ""
  );
  const [expDays, setExpDays] = useState<number | "">(initial?.expires_after_days ?? "");
  const [documentUrl, setDocumentUrl] = useState(initial?.document_url ?? "");
  const [isArchived, setIsArchived] = useState(!!initial?.is_archived);
  const [uploading, setUploading] = useState(false);

  const categoryLabelLocal = (cat: TrainingCourseCategory) => {
    const k = `training_cat_${cat}`;
    return L(t, k, cat);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal
    >
      <div className="max-h-[min(92dvh,100svh)] w-full min-w-0 max-w-none overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-slate-900 sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {initial ? L(t, "common_edit", "Edit") : L(t, "training_new_course", "New course")}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label={L(t, "common_close", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{L(t, "training_title", "Title")}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{L(t, "training_description", "Description")}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{L(t, "training_filter_category", "Category")}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TrainingCourseCategory)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            >
              {TRAINING_COURSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabelLocal(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {(t.training_duration_min as string) || "Duration (min)"}
            </span>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) =>
                setDuration(e.target.value === "" ? "" : parseInt(e.target.value, 10) || 0)
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{L(t, "training_expires_days", "Expires after (days)")}</span>
            <input
              type="number"
              min={0}
              value={expDays}
              onChange={(e) =>
                setExpDays(e.target.value === "" ? "" : parseInt(e.target.value, 10) || 0)
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{L(t, "training_document_url", "Document URL")}</span>
            <input
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            />
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setUploading(true);
                  const url = await uploadPdf(f);
                  setUploading(false);
                  if (url) setDocumentUrl(url);
                }}
              />
              {uploading ? L(t, "training_uploading", "Uploading…") : L(t, "training_upload_pdf", "Upload PDF")}
            </label>
          </label>
          {initial ? (
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={isArchived}
                onChange={(e) => setIsArchived(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              {L(t, "training_archived", "Archived")}
            </label>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm min-h-[44px]"
          >
            {L(t, "common_cancel", "Cancel")}
          </button>
          <button
            type="button"
            disabled={saving || !title.trim()}
            onClick={() =>
              onSave({
                id: initial?.id,
                title,
                description,
                category,
                duration_minutes: duration,
                expires_after_days: expDays,
                document_url: documentUrl,
                is_archived: isArchived,
              })
            }
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 min-h-[44px]"
          >
            {L(t, "employees_save_changes", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
