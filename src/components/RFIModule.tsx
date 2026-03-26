"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileQuestion,
  Plus,
  Search,
  Filter,
  X,
  FileDown,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "@/lib/supabase";
import { logAuditEvent } from "@/lib/useAuditLog";
import type { UserRole } from "@/types/shared";
import type { Rfi, RfiCategory, RfiFormState, RfiPriority, RfiStatus } from "@/types/rfi";

const CATEGORIES: RfiCategory[] = [
  "structural",
  "electrical",
  "mechanical",
  "civil",
  "architectural",
  "other",
];
const PRIORITIES: RfiPriority[] = ["low", "medium", "high", "urgent"];
const STATUSES: RfiStatus[] = ["draft", "submitted", "under_review", "answered", "closed"];

function emptyForm(): RfiFormState {
  return {
    project_id: "",
    project_name: "",
    title: "",
    description: "",
    category: "other",
    priority: "medium",
    status: "draft",
    assigned_to_name: "",
    assigned_to_email: "",
    due_date: "",
    tags: "",
  };
}

export interface RFIModuleProps {
  t: Record<string, string>;
  companyId: string | null;
  companyName?: string | null;
  userRole: UserRole;
  userName: string;
  userProfileId: string | null;
  projects: { id: string; name: string }[];
  /** When set, list and new RFI are scoped to this project (e.g. pestaña en obra). */
  projectIdFilter?: string | null;
}

export function RFIModule({
  t,
  companyId,
  companyName,
  userRole,
  userName,
  userProfileId,
  projects,
  projectIdFilter = null,
}: RFIModuleProps) {
  const l = (k: string, fb: string) => t[k] ?? fb;
  const rfiCatLabel = (c: RfiCategory) =>
    c === "other" ? l("common_other", "Other") : l(`rfi_cat_${c}`, c);
  const canEdit = userRole === "admin" || userRole === "supervisor";

  const [rows, setRows] = useState<Rfi[]>([]);
  const [companyProfiles, setCompanyProfiles] = useState<{ id: string; full_name: string | null; email: string | null }[]>(
    []
  );
  const [assigneeProfileId, setAssigneeProfileId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Rfi | null>(null);
  const [form, setForm] = useState<RfiFormState>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [answerDraft, setAnswerDraft] = useState("");
  const [answerNameDraft, setAnswerNameDraft] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !companyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("rfis")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.error(error);
      setRows([]);
      return;
    }
    setRows((data ?? []) as Rfi[]);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (projectIdFilter) setFilterProject(projectIdFilter);
  }, [projectIdFilter]);

  useEffect(() => {
    if (!supabase || !companyId) {
      setCompanyProfiles([]);
      return;
    }
    void supabase
      .from("user_profiles")
      .select("id,full_name,email")
      .eq("company_id", companyId)
      .order("full_name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          return;
        }
        setCompanyProfiles((data ?? []) as { id: string; full_name: string | null; email: string | null }[]);
      });
  }, [companyId]);

  const nextNumber = useCallback(async (): Promise<string> => {
    if (!supabase || !companyId) return "RFI-001";
    const { data } = await supabase
      .from("rfis")
      .select("rfi_number")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    let max = 0;
    for (const r of data ?? []) {
      const m = /^RFI-(\d+)$/i.exec((r as { rfi_number: string }).rfi_number);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `RFI-${String(max + 1).padStart(3, "0")}`;
  }, [companyId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterProject !== "all" && (r.project_id ?? "") !== filterProject) return false;
      if (filterCat !== "all" && r.category !== filterCat) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterPriority !== "all" && r.priority !== filterPriority) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const blob = `${r.title} ${r.description} ${r.rfi_number}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterProject, filterCat, filterStatus, filterPriority, search]);

  const submitCreate = async () => {
    if (!supabase || !companyId || !canEdit || !form.title.trim() || !form.description.trim()) return;
    const resolvedProjectId = (form.project_id || projectIdFilter || "").trim() || null;
    if (projectIdFilter && !resolvedProjectId) return;
    setSaving(true);
    const num = await nextNumber();
    const tags = form.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      company_id: companyId,
      project_id: resolvedProjectId,
      project_name:
        form.project_name ||
        projects.find((p) => p.id === resolvedProjectId)?.name ||
        null,
      rfi_number: num,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
      status: form.status,
      submitted_by: userProfileId,
      submitted_by_name: userName,
      assigned_to_name: form.assigned_to_name.trim() || null,
      assigned_to_email: form.assigned_to_email.trim() || null,
      due_date: form.due_date || null,
      photos: [] as string[],
      documents: [] as string[],
      tags,
    };
    const { data, error } = await supabase.from("rfis").insert(payload).select("*").single();
    setSaving(false);
    if (error) {
      console.error(error);
      return;
    }
    const row = data as Rfi;
    void logAuditEvent({
      company_id: companyId,
      user_id: userProfileId ?? "",
      user_name: userName,
      action: form.status === "draft" ? "rfi_created" : "rfi_submitted",
      entity_type: "rfi",
      entity_id: row.id,
      entity_name: row.title,
      new_value: { details: { rfi_number: row.rfi_number, status: row.status } },
    });
    setCreateOpen(false);
    setForm(emptyForm());
    setAssigneeProfileId("");
    void load();
    setDetail(row);
  };

  const saveAnswer = async () => {
    if (!supabase || !companyId || !detail || !canEdit) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("rfis")
      .update({
        answer: answerDraft.trim() || null,
        answered_by_name: answerNameDraft.trim() || userName,
        answered_at: answerDraft.trim() ? now : null,
        status: answerDraft.trim() ? "answered" : detail.status,
        updated_at: now,
      })
      .eq("id", detail.id);
    if (error) {
      console.error(error);
      return;
    }
    void logAuditEvent({
      company_id: companyId,
      user_id: userProfileId ?? "",
      user_name: userName,
      action: "rfi_answered",
      entity_type: "rfi",
      entity_id: detail.id,
      entity_name: detail.title,
    });
    void load();
    setDetail(null);
  };

  const exportPdf = (r: Rfi) => {
    const doc = new jsPDF();
    const line = (y: number, txt: string) => {
      doc.text(txt, 14, y);
      return y + 7;
    };
    let y = 16;
    doc.setFontSize(16);
    y = line(y, l("rfi_title", "RFI"));
    doc.setFontSize(10);
    y = line(y, companyName ?? "MachinPro");
    y = line(y, `${l("rfi_number", "No.")}: ${r.rfi_number}`);
    y = line(y, r.title);
    y = line(y, r.description.slice(0, 500));
    doc.save(`${r.rfi_number}.pdf`);
  };

  const badge = (status: RfiStatus) => {
    const map: Record<RfiStatus, string> = {
      draft: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
      submitted: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
      under_review: "bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100",
      answered: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
      closed: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return map[status] ?? map.draft;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FileQuestion className="h-8 w-8 shrink-0 text-amber-600 dark:text-amber-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {l("rfi_title", "RFI")}
          </h2>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (projectIdFilter) {
                const pn = projects.find((p) => p.id === projectIdFilter)?.name ?? "";
                setForm((f) => ({ ...f, project_id: projectIdFilter, project_name: pn }));
              }
              setCreateOpen(true);
            }}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
          >
            <Plus className="h-5 w-5" />
            {l("rfi_new", "New")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        {!projectIdFilter && (
        <label className="flex flex-col gap-1 text-sm min-w-[160px]">
          <span className="text-gray-600 dark:text-gray-400">{l("rfi_project", "Project")}</span>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{l("rfi_filter_all", "All")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        )}
        <label className="flex flex-col gap-1 text-sm min-w-[140px]">
          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> {l("rfi_status", "Status")}
          </span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{l("rfi_filter_all", "All")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {l(`rfi_${s}`, s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[140px]">
          <span className="text-gray-600 dark:text-gray-400">{l("rfi_category", "Category")}</span>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{l("rfi_filter_all", "All")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {rfiCatLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[140px]">
          <span className="text-gray-600 dark:text-gray-400">{l("rfi_priority", "Priority")}</span>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{l("rfi_filter_all", "All")}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {l(`rfi_pri_${p}`, p)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-[200px]">
          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <Search className="h-3.5 w-3.5" /> {l("rfi_search", "Search")}
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-sm"
          />
        </label>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <FileQuestion className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {l("rfi_empty_title", "No RFIs")}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md">
              {l("rfi_empty_sub", "")}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 font-medium">{l("rfi_number", "#")}</th>
                <th className="px-4 py-3 font-medium">{l("rfi_list_title", "Title")}</th>
                <th className="px-4 py-3 font-medium">{l("rfi_category", "Cat")}</th>
                <th className="px-4 py-3 font-medium">{l("rfi_priority", "Pri")}</th>
                <th className="px-4 py-3 font-medium">{l("rfi_status", "Status")}</th>
                <th className="px-4 py-3 font-medium">{l("rfi_due_date", "Due")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => {
                    setDetail(r);
                    setAnswerDraft(r.answer ?? "");
                    setAnswerNameDraft(r.answered_by_name ?? userName);
                  }}
                >
                  <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{r.rfi_number}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[220px] truncate">
                    {r.title}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {r.category ? l(`rfi_cat_${r.category}`, r.category) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {l(`rfi_pri_${r.priority}`, r.priority)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge(r.status)}`}>
                      {l(`rfi_${r.status}`, r.status)}
                    </span>
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
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 bg-black/50">
          <div className="w-full max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6 shadow-xl space-y-4 sm:max-w-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{l("rfi_new", "New")}</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{l("rfi_auto_number", "")}</p>
            {!projectIdFilter ? (
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{l("rfi_project", "Project")}</span>
              <select
                value={form.project_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const name = projects.find((p) => p.id === id)?.name ?? "";
                  setForm((f) => ({ ...f, project_id: id, project_name: name }));
                }}
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 min-h-[44px] text-sm"
              >
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            ) : (
              <input type="hidden" name="rfi_project" value={projectIdFilter} readOnly aria-hidden />
            )}
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{l("rfi_list_title", "Title")}</span>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 min-h-[44px] text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{l("rfi_description", "Description")}</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{l("rfi_status", "Status")}</span>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RfiStatus }))}
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 min-h-[44px] text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {l(`rfi_${s}`, s)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">{l("rfi_category", "")}</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as RfiCategory }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 min-h-[44px] text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {rfiCatLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">{l("rfi_priority", "")}</span>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as RfiPriority }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 min-h-[44px] text-sm"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {l(`rfi_pri_${p}`, p)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{l("rfi_assigned", "")}</span>
              <select
                value={assigneeProfileId}
                onChange={(e) => {
                  const id = e.target.value;
                  setAssigneeProfileId(id);
                  const p = companyProfiles.find((x) => x.id === id);
                  setForm((f) => ({
                    ...f,
                    assigned_to_name: p ? (p.full_name?.trim() || p.email?.split("@")[0] || "") : "",
                    assigned_to_email: p?.email ?? "",
                  }));
                }}
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 min-h-[44px] text-sm"
              >
                <option value="">{l("rfi_assignee_none", "—")}</option>
                {companyProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name?.trim() || p.email || p.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{l("rfi_assigned_email", "Email")}</span>
              <input
                type="email"
                value={form.assigned_to_email}
                onChange={(e) => setForm((f) => ({ ...f, assigned_to_email: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 min-h-[44px] text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-400">{l("rfi_due_date", "")}</span>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 min-h-[44px] text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => void submitCreate()}
                disabled={saving}
                className="min-h-[44px] rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {l("rfi_submit", "Submit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-mono text-amber-600 dark:text-amber-400">{detail.rfi_number}</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{detail.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{detail.description}</p>
            {canEdit && (
              <>
                <label className="block text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{l("rfi_answer", "Answer")}</span>
                  <textarea
                    value={answerDraft}
                    onChange={(e) => setAnswerDraft(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveAnswer()}
                  className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  {l("rfi_save_answer", "Save")}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => exportPdf(detail)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-200"
            >
              <FileDown className="h-4 w-4" />
              {l("rfi_export_pdf", "PDF")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
