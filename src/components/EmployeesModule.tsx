"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  ChevronLeft,
  Mail,
  Phone,
  Camera,
  Shield,
  FolderKanban,
  Palmtree,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CustomRole, RolePermissions } from "@/types/roles";
import { ROLE_PERMISSION_KEYS, ROLE_PERMISSION_LABELS } from "@/types/roles";

export interface EmployeesModuleProps {
  companyId: string | null;
  labels: Record<string, string>;
  customRoles: CustomRole[];
  projects: { id: string; name: string }[];
  canManageEmployees: boolean;
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
}

type ProfileRow = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  role?: string | null;
  company_id?: string | null;
  employee_id?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  vacation_days_allowed?: number | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  custom_role_id?: string | null;
  custom_permissions?: Partial<RolePermissions> | null;
  profile_status?: string | null;
  created_at?: string | null;
};

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function EmployeesModule({
  companyId,
  labels: t,
  customRoles,
  projects,
  canManageEmployees,
  cloudinaryCloudName = "",
  cloudinaryUploadPreset = "",
}: EmployeesModuleProps) {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<ProfileRow>>({});

  const load = useCallback(async () => {
    if (!supabase || !companyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data ?? []) as ProfileRow[]);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (selected) setDraft({ ...selected });
  }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const name = (r.full_name || r.display_name || "").toLowerCase();
      if (q && !name.includes(q) && !r.id.toLowerCase().includes(q)) return false;
      if (roleFilter !== "all" && (r.role ?? "") !== roleFilter) return false;
      const st = r.profile_status ?? "active";
      if (statusFilter !== "all" && st !== statusFilter) return false;
      return true;
    });
  }, [rows, search, roleFilter, statusFilter]);

  const displayName = (r: ProfileRow) =>
    (r.full_name || r.display_name || "").trim() || (t.employees_anonymous ?? "Member");

  const saveProfile = async () => {
    if (!supabase || !selected || !canManageEmployees) return;
    setSaving(true);
    const payload = {
      full_name: draft.full_name ?? selected.full_name,
      phone: draft.phone ?? null,
      avatar_url: draft.avatar_url ?? selected.avatar_url,
      vacation_days_allowed: draft.vacation_days_allowed ?? null,
      emergency_contact_name: draft.emergency_contact_name ?? null,
      emergency_contact_phone: draft.emergency_contact_phone ?? null,
      emergency_contact_relation: draft.emergency_contact_relation ?? null,
      custom_role_id: draft.custom_role_id ?? null,
      custom_permissions: draft.custom_permissions ?? null,
      profile_status: draft.profile_status ?? "active",
    };
    const { error } = await supabase.from("user_profiles").update(payload).eq("id", selected.id);
    setSaving(false);
    if (!error) void load();
  };

  const uploadAvatar = async (file: File) => {
    if (!cloudinaryCloudName || !cloudinaryUploadPreset || !selected) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", cloudinaryUploadPreset);
    fd.append("folder", "machinpro/avatars");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
      method: "POST",
      body: fd,
    });
    const data = (await res.json()) as { secure_url?: string };
    if (data.secure_url) {
      setDraft((d) => ({ ...d, avatar_url: data.secure_url }));
    }
  };

  const togglePermission = (key: keyof RolePermissions) => {
    if (!canManageEmployees) return;
    const base = (draft.custom_permissions ?? {}) as Partial<RolePermissions>;
    const next = { ...base, [key]: !base[key] };
    setDraft((d) => ({ ...d, custom_permissions: next }));
  };

  if (!companyId) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {(t as Record<string, string>).employees_no_company ?? "No company selected."}
      </p>
    );
  }

  if (selected) {
    const name = displayName(selected);
    return (
      <div className="space-y-4 max-w-3xl">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200"
        >
          <ChevronLeft className="h-4 w-4" />
          {t.cancel ?? "Back"}
        </button>

        <div className="flex flex-wrap items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-lg font-semibold overflow-hidden">
            {draft.avatar_url || selected.avatar_url ? (
              <img
                src={(draft.avatar_url || selected.avatar_url) as string}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initials(name)
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{name}</h2>
            <p className="text-sm text-zinc-500">{selected.role}</p>
          </div>
          {canManageEmployees && (
            <label className="ml-auto cursor-pointer min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm">
              <Camera className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadAvatar(f);
                }}
              />
              {(t as Record<string, string>).employees_change_photo ?? "Change photo"}
            </label>
          )}
        </div>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Users className="h-4 w-4" />
            {(t as Record<string, string>).employees_basic_info ?? "Basic information"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-zinc-500">{t.personnel ?? "Name"}</span>
              <input
                value={draft.full_name ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
                disabled={!canManageEmployees}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500 flex items-center gap-1">
                <Phone className="h-3 w-3" /> {t.phone ?? "Phone"}
              </span>
              <input
                value={draft.phone ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                disabled={!canManageEmployees}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <p className="text-sm sm:col-span-2">
              <span className="text-zinc-500 flex items-center gap-1">
                <Mail className="h-3 w-3" /> {t.email ?? "Email"}
              </span>
              <span className="block mt-1 text-zinc-800 dark:text-zinc-100">
                {(t as Record<string, string>).employees_email_hint ?? "Managed via account / invitation."}
              </span>
            </p>
            <p className="text-sm">
              <span className="text-zinc-500">{(t as Record<string, string>).employees_joined ?? "Joined"}</span>
              <span className="block mt-1">
                {selected.created_at ? new Date(selected.created_at).toLocaleDateString() : "—"}
              </span>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-100 dark:border-slate-700">
            <label className="block text-sm">
              <span className="text-zinc-500">{t.employees_emergency_contact ?? "Emergency contact"}</span>
              <input
                value={draft.emergency_contact_name ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, emergency_contact_name: e.target.value }))}
                disabled={!canManageEmployees}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{t.phone ?? "Phone"}</span>
              <input
                value={draft.emergency_contact_phone ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, emergency_contact_phone: e.target.value }))}
                disabled={!canManageEmployees}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{t.employees_emergency_relation ?? "Relation"}</span>
              <input
                value={draft.emergency_contact_relation ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, emergency_contact_relation: e.target.value }))}
                disabled={!canManageEmployees}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {(t as Record<string, string>).employees_role_permissions ?? "Role & permissions"}
          </h3>
          <label className="block text-sm max-w-md">
            <span className="text-zinc-500">{(t as Record<string, string>).employees_role ?? "Role"}</span>
            <select
              value={draft.custom_role_id ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, custom_role_id: e.target.value || null }))}
              disabled={!canManageEmployees}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            >
              <option value="">—</option>
              {customRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {ROLE_PERMISSION_KEYS.map((key) => (
              <label key={key} className="flex items-center justify-between gap-3 text-sm py-1">
                <span className="text-zinc-600 dark:text-zinc-300">{ROLE_PERMISSION_LABELS[key]}</span>
                <input
                  type="checkbox"
                  checked={Boolean((draft.custom_permissions ?? {})[key])}
                  onChange={() => togglePermission(key)}
                  disabled={!canManageEmployees}
                  className="h-5 w-5 rounded border-zinc-300"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            {(t as Record<string, string>).employees_projects ?? "Assigned projects"}
          </h3>
          <p className="text-xs text-zinc-500">
            {(t as Record<string, string>).employees_projects_hint ?? "Link `employee_id` in profile to project rosters in Operations."}
          </p>
          <ul className="text-sm space-y-1">
            {projects.slice(0, 12).map((p) => (
              <li key={p.id} className="text-zinc-700 dark:text-zinc-200">
                · {p.name}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Palmtree className="h-4 w-4" />
            {t.employees_vacation_days_allowed ?? "Annual vacation days"}
          </h3>
          <label className="block text-sm max-w-xs">
            <input
              type="number"
              min={0}
              value={draft.vacation_days_allowed ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  vacation_days_allowed: e.target.value === "" ? null : parseInt(e.target.value, 10),
                }))
              }
              disabled={!canManageEmployees}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            />
          </label>
          <p className="text-xs text-zinc-500">
            {t.employees_vacation_used ?? "Used this year"}: — · {t.employees_vacation_pending ?? "Pending"}: —
          </p>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-center">
          <div>
            <span className="text-xs text-zinc-500">{(t as Record<string, string>).employees_status ?? "Status"}</span>
            <select
              value={draft.profile_status ?? "active"}
              onChange={(e) => setDraft((d) => ({ ...d, profile_status: e.target.value }))}
              disabled={!canManageEmployees}
              className="block mt-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            >
              <option value="active">{(t as Record<string, string>).employees_status_active ?? "Active"}</option>
              <option value="inactive">{(t as Record<string, string>).employees_status_inactive ?? "Inactive"}</option>
              <option value="invited">{(t as Record<string, string>).employees_status_invited ?? "Invited"}</option>
            </select>
          </div>
          {canManageEmployees && (
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={saving}
              className="min-h-[44px] rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-medium"
            >
              {saving ? "…" : (t.accept ?? "Save")}
            </button>
          )}
          {canManageEmployees && (
            <button
              type="button"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
            >
              <UserPlus className="h-4 w-4" />
              {t.employees_invite ?? "Invite"}
            </button>
          )}
        </section>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t.employees_title ?? "Employees"}
        </h2>
        {canManageEmployees && (
          <button
            type="button"
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-medium"
          >
            <UserPlus className="h-4 w-4" />
            {t.employees_new ?? "New employee"}
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={(t as Record<string, string>).employees_search ?? "Search"}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 pl-10 pr-3 py-2.5 text-sm min-h-[44px]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px]"
        >
          <option value="all">{t.whFilterAll ?? "All"}</option>
          <option value="admin">admin</option>
          <option value="supervisor">supervisor</option>
          <option value="worker">worker</option>
          <option value="logistic">logistic</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px]"
        >
          <option value="all">{t.whFilterAll ?? "All"}</option>
          <option value="active">{(t as Record<string, string>).employees_status_active ?? "Active"}</option>
          <option value="inactive">{(t as Record<string, string>).employees_status_inactive ?? "Inactive"}</option>
          <option value="invited">{(t as Record<string, string>).employees_status_invited ?? "Invited"}</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{t.loading ?? "Loading…"}</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-slate-700 rounded-xl border border-zinc-200 dark:border-slate-700 overflow-hidden">
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-slate-800 min-h-[56px]"
              >
                <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium shrink-0">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                  ) : (
                    initials(displayName(r))
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-white truncate">{displayName(r)}</p>
                  <p className="text-xs text-zinc-500 truncate">{r.role}</p>
                </div>
                <span className="text-xs rounded-full px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {r.profile_status ?? "active"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-8">
          {(t as Record<string, string>).employees_empty ?? "No employees found."}
        </p>
      )}
    </section>
  );
}
