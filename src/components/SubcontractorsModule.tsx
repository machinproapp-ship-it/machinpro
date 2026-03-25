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
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface SubcontractorsModuleProps {
  companyId: string | null;
  labels: Record<string, string>;
  projects: { id: string; name: string }[];
  canManage: boolean;
}

type SubRow = {
  id: string;
  company_id: string;
  name: string;
  company_name?: string | null;
  trade?: string | null;
  status: string;
  created_at?: string | null;
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

function docTone(expiresAt: string | null | undefined, t: Record<string, string>): { cls: string; label: string } {
  if (!expiresAt) return { cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", label: t.subcontractors_status_valid ?? "valid" };
  const d = new Date(expiresAt);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return { cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200", label: t.subcontractors_expired ?? "Expired" };
  if (days <= 30) return { cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200", label: t.subcontractors_expires_soon ?? "Expiring soon" };
  return { cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200", label: t.subcontractors_status_valid ?? "valid" };
}

export function SubcontractorsModule({
  companyId,
  labels: t,
  projects,
  canManage,
}: SubcontractorsModuleProps) {
  const [list, setList] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [projCounts, setProjCounts] = useState<Record<string, number>>({});

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

  const loadDetail = useCallback(
    async (sid: string) => {
      if (!supabase) return;
      const [{ data: c }, { data: d }] = await Promise.all([
        supabase.from("subcontractor_contacts").select("*").eq("subcontractor_id", sid),
        supabase.from("subcontractor_documents").select("*").eq("subcontractor_id", sid),
      ]);
      setContacts((c ?? []) as ContactRow[]);
      setDocs((d ?? []) as DocRow[]);
    },
    []
  );

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      const hay = `${s.name} ${s.company_name ?? ""} ${s.trade ?? ""}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (projectFilter !== "all") {
        const n = projCounts[s.id] ?? 0;
        if (projectFilter === "none" && n > 0) return false;
        if (projectFilter === "any" && n === 0) return false;
      }
      return true;
    });
  }, [list, search, statusFilter, projectFilter, projCounts]);

  const selected = list.find((s) => s.id === selectedId) ?? null;

  const addNew = async () => {
    if (!supabase || !companyId || !canManage) return;
    const name = window.prompt(t.subcontractors_new ?? "Name");
    if (!name?.trim()) return;
    const { data, error } = await supabase
      .from("subcontractors")
      .insert({ company_id: companyId, name: name.trim(), status: "active" })
      .select("id")
      .single();
    if (!error && data) {
      void load();
      setSelectedId((data as { id: string }).id);
    }
  };

  if (!companyId) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {(t as Record<string, string>).subcontractors_no_company ?? "No company."}
      </p>
    );
  }

  if (selected) {
    return (
      <div className="space-y-4 max-w-3xl">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          {t.cancel ?? "Back"}
        </button>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{selected.name}</h2>
        <p className="text-sm text-zinc-500">
          {selected.company_name ?? "—"} · {selected.trade ?? "—"}
        </p>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {t.subcontractors_contacts ?? "Contacts"}
          </h3>
          <ul className="space-y-2 text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-2 items-center border-b border-zinc-100 dark:border-slate-800 pb-2">
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
                  <span className="text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5">primary</span>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <button
              type="button"
              className="mt-3 min-h-[44px] text-sm text-amber-600"
              onClick={() => {
                /* extend: modal insert */
              }}
            >
              + {t.addNew ?? "Add"}
            </button>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t.subcontractors_documents ?? "Documents"}
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
              {(t as Record<string, string>).subcontractors_no_docs ?? "No documents."}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold mb-2">{t.projects ?? "Projects"}</h3>
          <ul className="text-sm space-y-1 text-zinc-700 dark:text-zinc-200">
            {projects.slice(0, 20).map((p) => (
              <li key={p.id}>· {p.name}</li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {t.subcontractors_title ?? "Subcontractors"}
        </h2>
        {canManage && (
          <button
            type="button"
            onClick={() => void addNew()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            {t.subcontractors_new ?? "New"}
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={(t as Record<string, string>).subcontractors_search ?? "Search"}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 pl-10 pr-3 py-2.5 text-sm min-h-[44px]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px]"
        >
          <option value="all">{t.whFilterAll ?? "All"}</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="pending">pending</option>
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px]"
        >
          <option value="all">{t.whFilterAll ?? "All"}</option>
          <option value="none">{(t as Record<string, string>).subcontractors_no_projects ?? "No projects"}</option>
          <option value="any">{(t as Record<string, string>).subcontractors_with_projects ?? "With projects"}</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{t.loading ?? "Loading…"}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedId(s.id)}
              className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 text-left hover:border-amber-400/60 min-h-[44px]"
            >
              <p className="font-semibold text-zinc-900 dark:text-white">{s.name}</p>
              <p className="text-xs text-zinc-500">{s.company_name ?? "—"}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">{s.trade ?? "—"}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">{s.status}</span>
                <span className="text-zinc-500">
                  {(t as Record<string, string>).subcontractors_project_count ?? "Projects"}: {projCounts[s.id] ?? 0}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-8">
          {(t as Record<string, string>).subcontractors_empty ?? "No subcontractors."}
        </p>
      )}
    </section>
  );
}
