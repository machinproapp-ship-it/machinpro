"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Search,
  ChevronLeft,
  Plus,
  Phone,
  Mail,
  FileText,
  Calendar,
  AlertTriangle,
  Star,
  X,
  UserPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CustomRole } from "@/types/roles";

export interface SubcontractorsModuleProps {
  companyId: string | null;
  labels: Record<string, string>;
  projects: { id: string; name: string; archived?: boolean }[];
  canManage: boolean;
  customRoles?: CustomRole[];
  /** Subcontractors only: limited app roles (e.g. worker / custom) */
  inviteRoleOptions?: { id: string; label: string }[];
}

type SubRow = {
  id: string;
  company_id: string;
  name: string;
  company_name?: string | null;
  trade?: string | null;
  status: string;
  created_at?: string | null;
  gst_hst?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
  rating?: number | null;
  work_history?: unknown;
};

type WorkHistoryEntry = {
  project_id?: string;
  title?: string;
  completed_at?: string;
};

type ContactRow = {
  id: string;
  subcontractor_id: string;
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  is_primary?: boolean | null;
};

type DocRow = {
  id: string;
  subcontractor_id: string;
  name: string;
  type?: string | null;
  file_url?: string | null;
  expires_at?: string | null;
  status?: string | null;
};

type ContactDraft = {
  name: string;
  role: string;
  phone: string;
  email: string;
  is_primary: boolean;
};

type ComplianceDraft = {
  name: string;
  file_url: string;
  expires_at: string;
};

function docTone(expiresAt: string | null | undefined, t: Record<string, string>): { cls: string; label: string } {
  if (!expiresAt)
    return {
      cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
      label: t.subcontractors_status_valid ?? "",
    };
  const d = new Date(expiresAt);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0)
    return {
      cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
      label: t.subcontractors_expired ?? "",
    };
  if (days <= 30)
    return {
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
      label: t.subcontractors_expires_soon ?? "",
    };
  return {
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    label: t.subcontractors_status_valid ?? "",
  };
}

function parseWorkHistory(raw: unknown): WorkHistoryEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as WorkHistoryEntry[];
  return [];
}

function StarRow({
  value,
  onChange,
  disabled,
  labels,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  labels: Record<string, string>;
}) {
  const tl = labels as Record<string, string>;
  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label={tl.subcontractors_rating ?? ""}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg ${
            n <= value ? "text-amber-500" : "text-zinc-300 dark:text-zinc-600"
          }`}
        >
          <Star className={`h-6 w-6 ${n <= value ? "fill-current" : ""}`} aria-hidden />
        </button>
      ))}
    </div>
  );
}

const emptyContact = (): ContactDraft => ({
  name: "",
  role: "",
  phone: "",
  email: "",
  is_primary: false,
});

const emptyCompliance = (): ComplianceDraft => ({
  name: "",
  file_url: "",
  expires_at: "",
});

export function SubcontractorsModule({
  companyId,
  labels: t,
  projects,
  canManage,
  customRoles = [],
  inviteRoleOptions,
}: SubcontractorsModuleProps) {
  const [list, setList] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [tradeFilter, setTradeFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [projCounts, setProjCounts] = useState<Record<string, number>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [savingModal, setSavingModal] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTitleDraft, setHistoryTitleDraft] = useState("");
  const [detailProjectIds, setDetailProjectIds] = useState<string[]>([]);

  const [formName, setFormName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formTrade, setFormTrade] = useState("");
  const [formGst, setFormGst] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formContacts, setFormContacts] = useState<ContactDraft[]>([emptyContact()]);
  const [formCompliance, setFormCompliance] = useState<ComplianceDraft[]>([emptyCompliance()]);
  const [formProjectIds, setFormProjectIds] = useState<string[]>([]);
  const [formEmergencyName, setFormEmergencyName] = useState("");
  const [formEmergencyPhone, setFormEmergencyPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formRating, setFormRating] = useState(3);

  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  const load = useCallback(async () => {
    if (!supabase || !companyId) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("subcontractors")
      .select("*")
      .eq("company_id", companyId)
      .order("name");
    if (error) {
      console.error(error);
      setList([]);
    } else {
      setList((data ?? []) as SubRow[]);
    }
    const { data: pj } = await supabase.from("subcontractor_projects").select("subcontractor_id");
    const counts: Record<string, number> = {};
    for (const row of pj ?? []) {
      const sid = (row as { subcontractor_id: string }).subcontractor_id;
      counts[sid] = (counts[sid] ?? 0) + 1;
    }
    setProjCounts(counts);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (sid: string) => {
    if (!supabase) return;
    const [{ data: c }, { data: d }, { data: pj }] = await Promise.all([
      supabase.from("subcontractor_contacts").select("*").eq("subcontractor_id", sid),
      supabase.from("subcontractor_documents").select("*").eq("subcontractor_id", sid),
      supabase.from("subcontractor_projects").select("project_id").eq("subcontractor_id", sid),
    ]);
    setContacts((c ?? []) as ContactRow[]);
    setDocs((d ?? []) as DocRow[]);
    setDetailProjectIds((pj ?? []).map((r) => String((r as { project_id: string }).project_id)));
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const tradeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const x of list) {
      const tr = (x.trade ?? "").trim();
      if (tr) s.add(tr);
    }
    return Array.from(s).sort();
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (tradeFilter !== "all" && (s.trade ?? "").trim() !== tradeFilter) return false;
      const hay = `${s.name} ${s.company_name ?? ""} ${s.trade ?? ""}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (projectFilter !== "all") {
        const n = projCounts[s.id] ?? 0;
        if (projectFilter === "none" && n > 0) return false;
        if (projectFilter === "any" && n === 0) return false;
      }
      return true;
    });
  }, [list, search, statusFilter, projectFilter, projCounts, tradeFilter]);

  const selected = list.find((s) => s.id === selectedId) ?? null;

  const openNewModal = () => {
    setFormName("");
    setFormCompany("");
    setFormTrade("");
    setFormGst("");
    setFormAddress("");
    setFormStatus("active");
    setFormContacts([emptyContact()]);
    setFormCompliance([emptyCompliance()]);
    setFormProjectIds([]);
    setFormEmergencyName("");
    setFormEmergencyPhone("");
    setFormNotes("");
    setFormRating(3);
    setModalOpen(true);
  };

  const saveNewSubcontractor = async () => {
    if (!supabase || !companyId || !canManage) return;
    const name = formName.trim();
    if (!name) return;
    setSavingModal(true);
    const { data: ins, error } = await supabase
      .from("subcontractors")
      .insert({
        company_id: companyId,
        name,
        company_name: formCompany.trim() || null,
        trade: formTrade.trim() || null,
        status: formStatus,
        gst_hst: formGst.trim() || null,
        address: formAddress.trim() || null,
        emergency_contact_name: formEmergencyName.trim() || null,
        emergency_contact_phone: formEmergencyPhone.trim() || null,
        notes: formNotes.trim() || null,
        rating: formRating,
        work_history: [],
      })
      .select("id")
      .single();
    if (error || !ins) {
      console.error(error);
      setSavingModal(false);
      return;
    }
    const sid = (ins as { id: string }).id;

    for (const c of formContacts) {
      if (!c.name.trim()) continue;
      await supabase.from("subcontractor_contacts").insert({
        subcontractor_id: sid,
        name: c.name.trim(),
        role: c.role.trim() || null,
        phone: c.phone.trim() || null,
        email: c.email.trim() || null,
        is_primary: c.is_primary,
      });
    }

    for (const row of formCompliance) {
      if (!row.name.trim()) continue;
      await supabase.from("subcontractor_documents").insert({
        subcontractor_id: sid,
        company_id: companyId,
        name: row.name.trim(),
        file_url: row.file_url.trim() || null,
        expires_at: row.expires_at ? row.expires_at.slice(0, 10) : null,
        status: "valid",
      });
    }

    for (const pid of formProjectIds) {
      await supabase.from("subcontractor_projects").insert({
        subcontractor_id: sid,
        project_id: pid,
      });
    }

    setSavingModal(false);
    setModalOpen(false);
    void load();
    setSelectedId(sid);
  };

  const appendWorkHistoryEntry = async (entry: WorkHistoryEntry) => {
    if (!supabase || !selected || !canManage) return;
    const cur = parseWorkHistory(selected.work_history);
    const next = [...cur, entry];
    await supabase.from("subcontractors").update({ work_history: next }).eq("id", selected.id);
    void load();
  };

  const deleteSubcontractor = async (id: string) => {
    const lx = t as Record<string, string>;
    if (!supabase || !canManage) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(lx.common_confirm_delete ?? lx.confirmDeleteSubcontractor ?? "")
    )
      return;
    await supabase.from("subcontractors").delete().eq("id", id);
    if (selectedId === id) setSelectedId(null);
    void load();
  };

  const defaultInviteRoles = useMemo(() => {
    if (inviteRoleOptions?.length) return inviteRoleOptions;
    const fromCustom = customRoles.slice(0, 6).map((r) => ({ id: r.id, label: r.name }));
    return [{ id: "worker", label: "worker" }, ...fromCustom];
  }, [inviteRoleOptions, customRoles]);

  useEffect(() => {
    if (defaultInviteRoles.length && !inviteRoleId) setInviteRoleId(defaultInviteRoles[0].id);
  }, [defaultInviteRoles, inviteRoleId]);

  if (!companyId) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {(t as Record<string, string>).subcontractors_no_company ?? ""}
      </p>
    );
  }

  const tl = t as Record<string, string>;

  if (selected) {
    const history = parseWorkHistory(selected.work_history);
    console.log("[SubcontractorsModule] detail view render", { selectedId: selected.id });
    const backLabel = ((tl?.nav_back ?? "Atrás").replace(/^\s*←\s*/, "").trim() || "Atrás").trim();
    return (
      <div className="space-y-4 max-w-3xl">
        <div
          className="border-b border-zinc-200 dark:border-white/10"
          style={{
            marginBottom: "16px",
            paddingBottom: "16px",
          }}
        >
          <button
            type="button"
            className="border border-zinc-300 bg-transparent text-inherit dark:border-white/20"
            style={{
              minHeight: "44px",
              minWidth: "44px",
              padding: "8px 16px",
              cursor: "pointer",
              borderRadius: "8px",
              fontSize: "14px",
            }}
            onClick={() => setSelectedId(null)}
          >
            ← {backLabel}
          </button>
        </div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{selected.name}</h2>
        <p className="text-sm text-zinc-500">
          {selected.company_name ?? "—"} · {selected.trade ?? "—"}
        </p>
        {(selected.rating ?? 0) > 0 && (
          <div className="flex items-center gap-1 text-amber-500">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${i < (selected.rating ?? 0) ? "fill-current" : "text-zinc-300 dark:text-zinc-600"}`}
              />
            ))}
          </div>
        )}

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-2 text-sm">
          <h3 className="text-sm font-semibold">{tl.subcontractors_profile_section ?? ""}</h3>
          {selected.gst_hst && (
            <p>
              <span className="text-zinc-500">{tl.subcontractors_gst_hst ?? ""}:</span> {selected.gst_hst}
            </p>
          )}
          {selected.address && (
            <p>
              <span className="text-zinc-500">{tl.subcontractors_address ?? ""}:</span> {selected.address}
            </p>
          )}
          {(selected.emergency_contact_name || selected.emergency_contact_phone) && (
            <p>
              <span className="text-zinc-500">{tl.subcontractors_emergency ?? ""}:</span>{" "}
              {selected.emergency_contact_name} {selected.emergency_contact_phone}
            </p>
          )}
          {selected.notes && (
            <p>
              <span className="text-zinc-500">{tl.subcontractors_notes ?? ""}:</span> {selected.notes}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {t.subcontractors_contacts ?? ""}
          </h3>
          <ul className="space-y-2 text-sm">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap gap-2 items-center border-b border-zinc-100 dark:border-slate-800 pb-2"
              >
                <span className="font-medium">{c.name}</span>
                {c.role && <span className="text-zinc-500">{c.role}</span>}
                {c.phone && (
                  <span className="inline-flex items-center gap-1 text-zinc-600">
                    <Phone className="h-3 w-3" />
                    {c.phone}
                  </span>
                )}
                {c.email && (
                  <span className="inline-flex items-center gap-1 text-zinc-600">
                    <Mail className="h-3 w-3" />
                    {c.email}
                  </span>
                )}
                {c.is_primary && (
                  <span className="text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5">
                    {tl.subcontractors_primary ?? ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t.subcontractors_documents ?? ""}
          </h3>
          <ul className="space-y-2">
            {docs.map((d) => {
              const tone = docTone(d.expires_at ?? null, t as Record<string, string>);
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-zinc-100 dark:border-slate-800 pb-2"
                >
                  <span>{d.name}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${tone.cls}`}>{tone.label}</span>
                  {d.file_url && (
                    <a
                      href={d.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-600 text-xs underline"
                    >
                      {tl.open ?? "Open"}
                    </a>
                  )}
                  {d.expires_at && (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <Calendar className="h-3 w-3" />
                      {d.expires_at}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {docs.length === 0 && (
            <p className="text-sm text-zinc-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {tl.subcontractors_no_docs ?? ""}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold mb-2">{tl.subcontractors_work_history ?? ""}</h3>
          <ul className="text-sm space-y-2">
            {history.length === 0 ? (
              <li className="text-zinc-500 italic">{tl.subcontractors_no_history ?? ""}</li>
            ) : (
              history.map((h, idx) => (
                <li key={idx} className="border-b border-zinc-100 dark:border-slate-800 pb-2">
                  <span className="font-medium">{h.title ?? "—"}</span>
                  {h.project_id && (
                    <span className="text-zinc-500 ml-2">
                      · {activeProjects.find((p) => p.id === h.project_id)?.name ?? h.project_id}
                    </span>
                  )}
                  {h.completed_at && (
                    <span className="block text-xs text-zinc-500">{h.completed_at}</span>
                  )}
                </li>
              ))
            )}
          </ul>
          {canManage && (
            <button
              type="button"
              className="mt-3 min-h-[44px] text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 px-3"
              onClick={() => {
                setHistoryTitleDraft("");
                setHistoryModalOpen(true);
              }}
            >
              + {tl.subcontractors_add_history ?? ""}
            </button>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold mb-2">{t.projects ?? ""}</h3>
          <ul className="text-sm space-y-1 text-zinc-700 dark:text-zinc-200">
            {detailProjectIds.length === 0 ? (
              <li className="text-zinc-500 italic">{tl.subcontractors_no_projects_assigned ?? ""}</li>
            ) : (
              detailProjectIds.map((pid) => (
                <li key={pid}>· {activeProjects.find((p) => p.id === pid)?.name ?? pid}</li>
              ))
            )}
          </ul>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            {tl.subcontractors_invite_app ?? ""}
          </button>
        </div>

        {historyModalOpen && (
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/50"
              aria-hidden
              onClick={() => setHistoryModalOpen(false)}
            />
            <div className="fixed z-[61] left-4 right-4 bottom-4 sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 max-w-md rounded-xl border bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3">
              <p className="text-sm font-medium">{tl.subcontractors_history_title_prompt ?? ""}</p>
              <input
                value={historyTitleDraft}
                onChange={(e) => setHistoryTitleDraft(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 min-h-[44px]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="min-h-[44px] px-4 rounded-lg border"
                  onClick={() => setHistoryModalOpen(false)}
                >
                  {t.cancel ?? ""}
                </button>
                <button
                  type="button"
                  className="min-h-[44px] px-4 rounded-lg bg-amber-600 text-white"
                  onClick={() => {
                    const title = historyTitleDraft.trim();
                    if (!title) return;
                    void appendWorkHistoryEntry({
                      title,
                      completed_at: new Date().toISOString().slice(0, 10),
                    });
                    setHistoryModalOpen(false);
                  }}
                >
                  {t.accept ?? ""}
                </button>
              </div>
            </div>
          </>
        )}

        {inviteOpen && (
          <>
            <div className="fixed inset-0 z-[60] bg-black/50" aria-hidden onClick={() => setInviteOpen(false)} />
            <div className="fixed z-[61] left-4 right-4 bottom-4 sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 max-w-md rounded-xl border bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3">
              <p className="text-sm font-medium">{tl.subcontractors_invite_app ?? ""}</p>
              <label className="block text-xs">
                {tl.subcontractors_invite_role ?? ""}
                <select
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 min-h-[44px] bg-white dark:bg-slate-800"
                >
                  {defaultInviteRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-zinc-500">{tl.subcontractors_invite_hint ?? ""}</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="min-h-[44px] px-4 rounded-lg border"
                  onClick={() => setInviteOpen(false)}
                >
                  {t.cancel ?? ""}
                </button>
                <button
                  type="button"
                  className="min-h-[44px] px-4 rounded-lg bg-amber-600 text-white"
                  onClick={() => {
                    const roleLabel =
                      defaultInviteRoles.find((r) => r.id === inviteRoleId)?.label ?? inviteRoleId;
                    const subj = encodeURIComponent(
                      `${tl.subcontractors_invite_app ?? ""} — ${selected.name}`
                    );
                    const body = encodeURIComponent(
                      `${tl.subcontractors_invite_body ?? ""}\n${roleLabel}\n${selected.name}`
                    );
                    const mail = contacts.find((c) => c.email)?.email ?? "";
                    window.location.href = `mailto:${encodeURIComponent(mail)}?subject=${subj}&body=${body}`;
                    setInviteOpen(false);
                  }}
                >
                  {tl.subcontractors_invite_open_mail ?? ""}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {t.subcontractors_title ?? ""}
        </h2>
        {canManage && (
          <button
            type="button"
            onClick={openNewModal}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            {tl.subcontractors_new_modal ?? t.subcontractors_new ?? ""}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tl.subcontractors_search ?? ""}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 pl-10 pr-3 py-2.5 text-sm min-h-[44px]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2.5 text-sm min-h-[44px]"
        >
          <option value="all">{t.whFilterAll ?? ""}</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="pending">pending</option>
        </select>
        <select
          value={tradeFilter}
          onChange={(e) => setTradeFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2.5 text-sm min-h-[44px]"
        >
          <option value="all">{tl.subcontractors_filter_trade_all ?? ""}</option>
          {tradeOptions.map((tr) => (
            <option key={tr} value={tr}>
              {tr}
            </option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="col-span-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2.5 text-sm min-h-[44px]"
        >
          <option value="all">{t.whFilterAll ?? ""}</option>
          <option value="none">{tl.subcontractors_no_projects ?? ""}</option>
          <option value="any">{tl.subcontractors_with_projects ?? ""}</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{t.loading ?? ""}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="flex flex-col rounded-xl border border-zinc-200 dark:border-slate-700 overflow-hidden hover:border-amber-400/60"
            >
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="flex-1 p-4 text-left min-h-[44px]"
              >
                <p className="font-semibold text-zinc-900 dark:text-white">{s.name}</p>
                <p className="text-xs text-zinc-500">{s.company_name ?? "—"}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">{s.trade ?? "—"}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">{s.status}</span>
                  <span className="text-zinc-500">
                    {tl.subcontractors_project_count ?? ""}: {projCounts[s.id] ?? 0}
                  </span>
                </div>
              </button>
              {canManage && (
                <div className="flex justify-end gap-0.5 border-t border-zinc-200 dark:border-slate-700 px-2 py-2">
                  <button
                    type="button"
                    aria-label={tl.common_edit ?? ""}
                    onClick={() => setSelectedId(s.id)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={tl.common_delete ?? ""}
                    onClick={() => void deleteSubcontractor(s.id)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-8">{tl.subcontractors_empty ?? ""}</p>
      )}

      {modalOpen && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/50 overflow-y-auto"
            aria-hidden
            onClick={() => !savingModal && setModalOpen(false)}
          />
          <div
            className="fixed z-[71] inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:inset-auto sm:left-1/2 sm:top-8 sm:-translate-x-1/2 sm:w-full sm:max-w-xl sm:rounded-xl shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="mb-3 inline-flex min-h-[44px] items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300"
              onClick={() => !savingModal && setModalOpen(false)}
              disabled={savingModal}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              {tl.nav_back ?? t.cancel ?? ""}
            </button>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{tl.subcontractors_modal_title ?? ""}</h3>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                onClick={() => setModalOpen(false)}
                disabled={savingModal}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <section className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase">{tl.subcontractors_tab_profile ?? ""}</p>
              <label className="block text-sm">
                {tl.subcontractors_field_name ?? ""}
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 min-h-[44px] bg-white dark:bg-slate-800"
                />
              </label>
              <label className="block text-sm">
                {tl.subcontractors_field_company ?? ""}
                <input
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 min-h-[44px]"
                />
              </label>
              <label className="block text-sm">
                {tl.subcontractors_field_trade ?? ""}
                <input
                  value={formTrade}
                  onChange={(e) => setFormTrade(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 min-h-[44px]"
                />
              </label>
              <label className="block text-sm">
                {tl.subcontractors_gst_hst ?? ""}
                <input
                  value={formGst}
                  onChange={(e) => setFormGst(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 min-h-[44px]"
                />
              </label>
              <label className="block text-sm">
                {tl.subcontractors_address ?? ""}
                <textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 bg-white dark:bg-slate-800"
                />
              </label>
              <label className="block text-sm">
                {tl.subcontractors_field_status ?? ""}
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 min-h-[44px]"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="pending">pending</option>
                </select>
              </label>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase">{tl.subcontractors_tab_contacts ?? ""}</p>
              {formContacts.map((c, i) => (
                <div key={i} className="rounded-lg border border-zinc-200 dark:border-slate-700 p-3 space-y-2">
                  <input
                    placeholder={tl.subcontractors_contact_name ?? ""}
                    value={c.name}
                    onChange={(e) => {
                      const next = [...formContacts];
                      next[i] = { ...c, name: e.target.value };
                      setFormContacts(next);
                    }}
                    className="w-full rounded border px-2 py-2 min-h-[44px] text-sm"
                  />
                  <input
                    placeholder={tl.subcontractors_contact_role ?? ""}
                    value={c.role}
                    onChange={(e) => {
                      const next = [...formContacts];
                      next[i] = { ...c, role: e.target.value };
                      setFormContacts(next);
                    }}
                    className="w-full rounded border px-2 py-2 min-h-[44px] text-sm"
                  />
                  <input
                    placeholder={t.phone ?? ""}
                    value={c.phone}
                    onChange={(e) => {
                      const next = [...formContacts];
                      next[i] = { ...c, phone: e.target.value };
                      setFormContacts(next);
                    }}
                    className="w-full rounded border px-2 py-2 min-h-[44px] text-sm"
                  />
                  <input
                    placeholder={t.email ?? ""}
                    value={c.email}
                    onChange={(e) => {
                      const next = [...formContacts];
                      next[i] = { ...c, email: e.target.value };
                      setFormContacts(next);
                    }}
                    className="w-full rounded border px-2 py-2 min-h-[44px] text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={c.is_primary}
                      onChange={(e) => {
                        const next = formContacts.map((row, j) =>
                          j === i ? { ...row, is_primary: e.target.checked } : { ...row, is_primary: false }
                        );
                        setFormContacts(next);
                      }}
                    />
                    {tl.subcontractors_primary ?? ""}
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="min-h-[44px] text-sm text-amber-600"
                onClick={() => setFormContacts((prev) => [...prev, emptyContact()])}
              >
                + {tl.subcontractors_add_contact ?? ""}
              </button>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase">{tl.subcontractors_tab_compliance ?? ""}</p>
              {formCompliance.map((row, i) => (
                <div key={i} className="rounded-lg border border-zinc-200 dark:border-slate-700 p-3 space-y-2">
                  <input
                    placeholder={tl.subcontractors_doc_name ?? ""}
                    value={row.name}
                    onChange={(e) => {
                      const next = [...formCompliance];
                      next[i] = { ...row, name: e.target.value };
                      setFormCompliance(next);
                    }}
                    className="w-full rounded border px-2 py-2 min-h-[44px] text-sm"
                  />
                  <input
                    placeholder={tl.subcontractors_doc_url ?? ""}
                    value={row.file_url}
                    onChange={(e) => {
                      const next = [...formCompliance];
                      next[i] = { ...row, file_url: e.target.value };
                      setFormCompliance(next);
                    }}
                    className="w-full rounded border px-2 py-2 min-h-[44px] text-sm"
                  />
                  <input
                    type="date"
                    value={row.expires_at.slice(0, 10)}
                    onChange={(e) => {
                      const next = [...formCompliance];
                      next[i] = { ...row, expires_at: e.target.value };
                      setFormCompliance(next);
                    }}
                    className="w-full rounded border px-2 py-2 min-h-[44px] text-sm"
                  />
                </div>
              ))}
              <button
                type="button"
                className="min-h-[44px] text-sm text-amber-600"
                onClick={() => setFormCompliance((prev) => [...prev, emptyCompliance()])}
              >
                + {tl.subcontractors_add_document ?? ""}
              </button>
            </section>

            <section>
              <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">
                {tl.subcontractors_tab_projects ?? ""}
              </p>
              <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-2">
                {activeProjects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={formProjectIds.includes(p.id)}
                      onChange={(e) => {
                        setFormProjectIds((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                        );
                      }}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <p className="col-span-full text-xs font-semibold text-zinc-500 uppercase">
                {tl.subcontractors_emergency ?? ""}
              </p>
              <input
                placeholder={tl.subcontractors_emergency_name ?? ""}
                value={formEmergencyName}
                onChange={(e) => setFormEmergencyName(e.target.value)}
                className="rounded border px-3 py-2 min-h-[44px]"
              />
              <input
                placeholder={t.phone ?? ""}
                value={formEmergencyPhone}
                onChange={(e) => setFormEmergencyPhone(e.target.value)}
                className="rounded border px-3 py-2 min-h-[44px]"
              />
            </section>

            <section>
              <label className="block text-sm">
                {tl.subcontractors_notes ?? ""}
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            </section>

            <section>
              <p className="text-sm mb-1">{tl.subcontractors_rating ?? ""}</p>
              <StarRow value={formRating} onChange={setFormRating} labels={t} />
            </section>

            <button
              type="button"
              disabled={savingModal || !formName.trim()}
              onClick={() => void saveNewSubcontractor()}
              className="w-full min-h-[44px] rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {savingModal ? "…" : (t.accept ?? "")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
