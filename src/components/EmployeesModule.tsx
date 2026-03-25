"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  Mail,
  Phone,
  Camera,
  Shield,
  FolderKanban,
  Palmtree,
  UserPlus,
  Plus,
  FileText,
  Pencil,
  X,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CustomRole, RolePermissions } from "@/types/roles";
import { ROLE_PERMISSION_KEYS } from "@/types/roles";
import type { ComplianceField, ComplianceRecord, VacationRequestRow } from "@/app/page";

export interface EmployeesModuleProps {
  companyId: string | null;
  labels: Record<string, string>;
  customRoles: CustomRole[];
  projects: { id: string; name: string; archived?: boolean }[];
  canManageEmployees: boolean;
  /** admin o permiso canManageEmployees — botón invitar / nuevo */
  showNewEmployeeButton?: boolean;
  /** Perfil Supabase: permite cambiar propia foto */
  currentUserProfileId?: string | null;
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
  /** user_profiles.id → legacy employees.id (compliance targetId) */
  userProfileToEmployeeId?: Record<string, string>;
  complianceFields?: ComplianceField[];
  complianceRecords?: ComplianceRecord[];
  onComplianceRecordsChange?: (records: ComplianceRecord[]) => void;
  vacationRequests?: VacationRequestRow[];
}

type ProfileRow = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
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
  use_role_permissions?: boolean | null;
  profile_status?: string | null;
  created_at?: string | null;
  pay_type?: string | null;
  pay_amount?: number | null;
  pay_currency?: string | null;
  pay_period?: string | null;
  vacation_policy_enabled?: boolean | null;
};

type EmployeeDocRow = {
  id: string;
  user_id: string;
  name: string;
  file_url?: string | null;
  created_at?: string | null;
};

function emailLocalPart(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  if (!e) return "";
  const at = e.indexOf("@");
  if (at <= 0) return e;
  return e.slice(0, at).trim() || e;
}

/** full_name → display_name → local del email → "Empleado xxxx" (nunca UUID completo ni email entero como nombre). */
function employeeDisplayLabel(r: ProfileRow, labels?: Record<string, string>): string {
  const fn = (r.full_name ?? "").trim();
  const dn = (r.display_name ?? "").trim();
  const em = (r.email ?? "").trim();
  const local = emailLocalPart(em);
  const anonPrefix = (labels?.employees_display_anonymous ?? labels?.worker ?? "").trim() || "Employee";
  const idFrag = r.id.replace(/-/g, "").slice(0, 4).toLowerCase();
  if (fn) return fn;
  if (dn) return dn;
  if (local) return local;
  return `${anonPrefix} ${idFrag}`.trim();
}

function initialsFromPersonName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) {
    const w = p[0]!;
    return w.length >= 2 ? w.slice(0, 2).toUpperCase() : w.slice(0, 1).toUpperCase();
  }
  return (p[0]![0]! + p[p.length - 1]![0]!).toUpperCase();
}

function initialsFromEmailLocal(local: string): string {
  const s = local.trim();
  if (!s) return "?";
  const parts = s.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  if (s.length >= 2) return (s[0]! + s[s.length - 1]!).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function employeeInitials(r: ProfileRow): string {
  const fn = (r.full_name ?? "").trim();
  const dn = (r.display_name ?? "").trim();
  const fromName = fn || dn;
  if (fromName) return initialsFromPersonName(fromName);
  const em = (r.email ?? "").trim();
  if (em) return initialsFromEmailLocal(emailLocalPart(em) || em);
  return r.id.replace(/-/g, "").slice(0, 2).toUpperCase() || "?";
}

function permLabel(key: keyof RolePermissions, t: Record<string, string>): string {
  const lx = t as Record<string, string>;
  const map: Record<keyof RolePermissions, string> = {
    canViewCentral: lx.permViewCentral ?? "",
    canEditCentral: lx.permEditCentral ?? "",
    canViewLogistics: lx.permViewLogistics ?? "",
    canEditLogistics: lx.permEditLogistics ?? "",
    canViewProjects: lx.permViewProjects ?? "",
    canViewOnlyAssignedProjects: lx.permOnlyAssigned ?? "",
    canEditProjects: lx.permEditProjects ?? "",
    canViewSchedule: lx.permViewSchedule ?? "",
    canWriteSchedule: lx.permWriteSchedule ?? "",
    canViewBlueprints: lx.permViewBlueprints ?? "",
    canAnnotateBlueprints: lx.permAnnotate ?? "",
    canViewSettings: lx.permViewSettings ?? "",
    canEditSettings: lx.permEditSettings ?? "",
    canManageRoles: lx.permManageRoles ?? "",
    canManageEmployees: lx.permManageEmployees ?? "",
    canViewForms: lx.permViewForms ?? "",
    canManageForms: lx.permManageForms ?? "",
    canViewBinders: lx.permViewBinders ?? "",
    canManageBinders: lx.permManageBinders ?? "",
    canManageSubcontractors: lx.permManageSubcontractors ?? "",
    canApproveVacations: lx.permApproveVacations ?? "",
    canViewAttendance: lx.permViewAttendance ?? "",
    canViewTimeclock: lx.permViewTimeclock ?? "",
    canManageTimeclock: lx.permManageTimeclock ?? "",
  };
  return map[key] || String(key);
}

function emptyPermissions(): RolePermissions {
  return {
    canViewCentral: false,
    canEditCentral: false,
    canViewLogistics: false,
    canEditLogistics: false,
    canViewProjects: false,
    canViewOnlyAssignedProjects: false,
    canEditProjects: false,
    canViewSchedule: false,
    canWriteSchedule: false,
    canViewBlueprints: false,
    canAnnotateBlueprints: false,
    canViewSettings: false,
    canEditSettings: false,
    canManageRoles: false,
    canManageEmployees: false,
    canViewForms: false,
    canManageForms: false,
    canViewBinders: false,
    canManageBinders: false,
    canManageSubcontractors: false,
    canApproveVacations: false,
    canViewAttendance: false,
    canViewTimeclock: false,
    canManageTimeclock: false,
  };
}

function mergePerm(base: RolePermissions, partial?: Partial<RolePermissions> | null): RolePermissions {
  return { ...base, ...(partial ?? {}) };
}

function complianceTone(
  status: ComplianceRecord["status"],
  t: Record<string, string>
): { cls: string; label: string } {
  if (status === "valid")
    return {
      cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
      label: t.valid ?? "",
    };
  if (status === "expiring")
    return {
      cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
      label: t.expiring ?? "",
    };
  if (status === "expired")
    return { cls: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200", label: t.expired ?? "" };
  return {
    cls: "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300",
    label: t.missing ?? "",
  };
}

function recordStatusFromInputs(
  expiryDate: string | undefined,
  alertDaysBefore: number,
  fieldType: string
): ComplianceRecord["status"] {
  if (fieldType === "date" && expiryDate) {
    const d = new Date(expiryDate);
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
    if (days < 0) return "expired";
    if (days <= alertDaysBefore) return "expiring";
    return "valid";
  }
  if (expiryDate || fieldType === "document") return "valid";
  return "missing";
}

const YEAR_START = new Date(new Date().getFullYear(), 0, 1);
const YEAR_END = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);

const PAY_CURRENCIES = ["CAD", "USD", "EUR", "GBP", "MXN", "BRL", "ARS", "COP", "CLP", "PEN"] as const;

export function EmployeesModule({
  companyId,
  labels: t,
  customRoles,
  projects,
  canManageEmployees,
  showNewEmployeeButton = false,
  currentUserProfileId = null,
  cloudinaryCloudName = "",
  cloudinaryUploadPreset = "",
  userProfileToEmployeeId = {},
  complianceFields = [],
  complianceRecords = [],
  onComplianceRecordsChange,
  vacationRequests = [],
}: EmployeesModuleProps) {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<ProfileRow>>({});
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [employeeDocs, setEmployeeDocs] = useState<EmployeeDocRow[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    customRoleId: "role-worker",
    profileStatus: "active",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
    payType: "unspecified" as "unspecified" | "fixed" | "hourly",
    payAmount: "",
    payCurrency: "CAD",
    payPeriod: "monthly" as "monthly" | "biweekly" | "weekly",
    manageVacations: false,
    vacationDaysAnnual: "",
  });
  const [complianceEdit, setComplianceEdit] = useState<{
    field: ComplianceField;
    expiryDate: string;
    documentUrl: string;
    value: string;
  } | null>(null);

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.archived),
    [projects]
  );

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

  useEffect(() => {
    if (!createOpen || customRoles.length === 0) return;
    setCreateForm((f) =>
      f.customRoleId && customRoles.some((c) => c.id === f.customRoleId)
        ? f
        : {
            ...f,
            customRoleId:
              customRoles.find((c) => c.id === "role-worker")?.id ??
              customRoles[0]?.id ??
              "role-worker",
          }
    );
  }, [createOpen, customRoles]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (selected) {
      const inherit =
        selected.use_role_permissions != null
          ? selected.use_role_permissions
          : selected.custom_permissions == null;
      const pt = (selected.pay_type ?? "").trim();
      setDraft({
        ...selected,
        pay_type: pt === "" ? "unspecified" : pt,
        pay_currency: selected.pay_currency ?? "CAD",
        pay_period: selected.pay_period ?? "monthly",
        vacation_policy_enabled: selected.vacation_policy_enabled ?? Boolean(selected.vacation_days_allowed),
        use_role_permissions: inherit,
        custom_permissions: inherit ? {} : (selected.custom_permissions ?? {}) as Partial<RolePermissions>,
      });
    }
  }, [selected]);

  const loadAssignments = useCallback(async () => {
    if (!supabase || !companyId || !selectedId) {
      setAssignedProjectIds([]);
      setEmployeeDocs([]);
      return;
    }
    const { data: pj } = await supabase
      .from("employee_projects")
      .select("project_id")
      .eq("user_id", selectedId)
      .eq("company_id", companyId);
    if (pj) {
      setAssignedProjectIds((pj as { project_id: string }[]).map((r) => r.project_id));
    } else {
      setAssignedProjectIds([]);
    }
    const { data: docs } = await supabase
      .from("employee_documents")
      .select("*")
      .eq("user_id", selectedId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setEmployeeDocs((docs ?? []) as EmployeeDocRow[]);
  }, [companyId, selectedId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const complianceTargetId = (profileId: string) =>
    userProfileToEmployeeId[profileId] ?? profileId;

  const roleLabel = (r: ProfileRow) => {
    const cr = r.custom_role_id ? customRoles.find((x) => x.id === r.custom_role_id) : undefined;
    if (cr?.name) return cr.name;
    const lx = t as Record<string, string>;
    const roleMap: Record<string, string> = {
      admin: lx.admin ?? "",
      supervisor: lx.supervisor ?? "",
      worker: lx.worker ?? "",
      logistic: lx.logistic ?? "",
    };
    const base = (r.role ?? "").trim();
    return roleMap[base] ?? base ?? lx.personnel ?? "";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const label = employeeDisplayLabel(r, t as Record<string, string>).toLowerCase();
      const em = (r.email ?? "").toLowerCase();
      if (q && !label.includes(q) && !em.includes(q) && !r.id.toLowerCase().includes(q)) return false;

      if (roleFilter !== "all") {
        if (roleFilter.startsWith("custom:")) {
          const rid = roleFilter.slice(7);
          if ((r.custom_role_id ?? "") !== rid) return false;
        } else if ((r.role ?? "") !== roleFilter) return false;
      }

      const st = r.profile_status ?? "active";
      if (statusFilter !== "all" && st !== statusFilter) return false;
      return true;
    });
  }, [rows, search, roleFilter, statusFilter, t]);

  const vacationsForSelected = useMemo(() => {
    if (!selectedId) return [];
    return vacationRequests.filter((v) => v.user_id === selectedId);
  }, [vacationRequests, selectedId]);

  const vacationStats = useMemo(() => {
    const yStart = YEAR_START.toISOString().slice(0, 10);
    const yEnd = YEAR_END.toISOString().slice(0, 10);
    let used = 0;
    let pending = 0;
    for (const v of vacationsForSelected) {
      const overlapsYear = v.start_date <= yEnd && v.end_date >= yStart;
      if (!overlapsYear) continue;
      if (v.status === "approved") used += v.total_days;
      else if (v.status === "pending") pending += v.total_days;
    }
    return { used, pending };
  }, [vacationsForSelected]);

  const selectedRolePermissions = useMemo((): RolePermissions => {
    const rid = draft.custom_role_id ?? selected?.custom_role_id;
    const role = rid ? customRoles.find((x) => x.id === rid) : undefined;
    return role?.permissions ?? emptyPermissions();
  }, [draft.custom_role_id, selected?.custom_role_id, customRoles]);

  const effectivePermissionValue = (key: keyof RolePermissions): boolean => {
    const inherit = draft.use_role_permissions !== false;
    if (inherit) return Boolean(selectedRolePermissions[key]);
    return Boolean((draft.custom_permissions ?? {})[key]);
  };

  const saveProfile = async () => {
    if (!supabase || !selected) return;
    const isSelf = currentUserProfileId != null && selected.id === currentUserProfileId;
    const workerSelf = isSelf && !canManageEmployees;
    if (!canManageEmployees && !isSelf) return;
    setSaving(true);
    if (workerSelf) {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          full_name: draft.full_name ?? selected.full_name,
          phone: draft.phone ?? null,
          avatar_url: draft.avatar_url ?? selected.avatar_url ?? null,
          emergency_contact_name: draft.emergency_contact_name ?? null,
          emergency_contact_phone: draft.emergency_contact_phone ?? null,
          emergency_contact_relation: draft.emergency_contact_relation ?? null,
        })
        .eq("id", selected.id);
      setSaving(false);
      if (!error) void load();
      return;
    }
    const inherit = draft.use_role_permissions !== false;
    const payType = draft.pay_type ?? "unspecified";
    const payAmountRaw = draft.pay_amount;
    const payAmount =
      payType === "unspecified"
        ? null
        : typeof payAmountRaw === "number" && !Number.isNaN(payAmountRaw)
          ? payAmountRaw
          : payAmountRaw != null
            ? Number(payAmountRaw)
            : null;
    const payload = {
      full_name: draft.full_name ?? selected.full_name,
      phone: draft.phone ?? null,
      avatar_url: draft.avatar_url ?? selected.avatar_url,
      vacation_policy_enabled: Boolean(draft.vacation_policy_enabled),
      vacation_days_allowed: draft.vacation_policy_enabled ? draft.vacation_days_allowed ?? null : null,
      emergency_contact_name: draft.emergency_contact_name ?? null,
      emergency_contact_phone: draft.emergency_contact_phone ?? null,
      emergency_contact_relation: draft.emergency_contact_relation ?? null,
      custom_role_id: draft.custom_role_id ?? null,
      use_role_permissions: inherit,
      custom_permissions: inherit ? null : (draft.custom_permissions ?? {}) as Record<string, unknown>,
      profile_status: draft.profile_status ?? "active",
      pay_type: payType === "unspecified" ? null : payType,
      pay_amount:
        payType === "unspecified" || payAmount == null || Number.isNaN(payAmount as number) ? null : payAmount,
      pay_currency:
        payType === "unspecified" ? null : (draft.pay_currency ?? selected.pay_currency ?? "CAD") || null,
      pay_period:
        payType === "unspecified" ? null : (draft.pay_period ?? selected.pay_period ?? "monthly") || null,
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

  const uploadEmployeeDoc = async (file: File) => {
    if (!supabase || !cloudinaryCloudName || !cloudinaryUploadPreset || !selected || !companyId || !canManageEmployees)
      return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", cloudinaryUploadPreset);
    fd.append("folder", "machinpro/employee-docs");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/raw/upload`, {
      method: "POST",
      body: fd,
    });
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!data.secure_url) return;
    const name = file.name || "document";
    const { error } = await supabase.from("employee_documents").insert({
      company_id: companyId,
      user_id: selected.id,
      name,
      file_url: data.secure_url,
    });
    if (!error) void loadAssignments();
  };

  const togglePermission = (key: keyof RolePermissions) => {
    if (!canManageEmployees || draft.use_role_permissions !== false) return;
    const base = (draft.custom_permissions ?? {}) as Partial<RolePermissions>;
    const next = { ...base, [key]: !base[key] };
    setDraft((d) => ({ ...d, custom_permissions: next }));
  };

  const toggleProject = async (projectId: string) => {
    if (!supabase || !selected || !companyId || !canManageEmployees) return;
    const on = assignedProjectIds.includes(projectId);
    if (on) {
      await supabase
        .from("employee_projects")
        .delete()
        .eq("user_id", selected.id)
        .eq("project_id", projectId)
        .eq("company_id", companyId);
    } else {
      await supabase.from("employee_projects").insert({
        user_id: selected.id,
        project_id: projectId,
        company_id: companyId,
      });
    }
    void loadAssignments();
  };

  const confirmDeleteMsg = (t as Record<string, string>).common_confirm_delete ?? "";

  const deactivateProfile = async (id: string, displayNameForConfirm: string) => {
    if (!supabase || !canManageEmployees) return;
    const lx = t as Record<string, string>;
    const named =
      (lx.employees_confirm_deactivate?.replace(/\{name\}/g, displayNameForConfirm) ?? "").trim() ||
      confirmDeleteMsg;
    if (typeof window !== "undefined" && !window.confirm(named)) return;
    await supabase.from("user_profiles").update({ profile_status: "inactive" }).eq("id", id);
    if (selectedId === id) setSelectedId(null);
    void load();
  };

  const submitCreateEmployee = async () => {
    const lx = t as Record<string, string>;
    if (!companyId || !canManageEmployees) {
      console.warn("[EmployeesModule] create blocked: missing companyId or permission");
      setCreateError(lx.employees_create_error ?? "");
      return;
    }
    if (!supabase) {
      console.error("[EmployeesModule] create: Supabase client is null (check env)");
      setCreateError(lx.employees_create_error ?? "");
      return;
    }
    const name = createForm.fullName.trim();
    const mail = createForm.email.trim().toLowerCase();
    if (!name || !mail.includes("@")) {
      setCreateError(lx.employees_create_validation ?? "");
      return;
    }
    setCreateError(null);
    setCreateSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        console.error("[EmployeesModule] create: no session access_token");
        setCreateError(lx.employees_create_error ?? "");
        return;
      }
      const payT = createForm.payType;
      const payAmt =
        payT === "unspecified" || createForm.payAmount.trim() === ""
          ? null
          : parseFloat(createForm.payAmount.replace(",", "."));
      const res = await fetch("/api/employees/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId,
          fullName: name,
          email: mail,
          phone: createForm.phone.trim() || null,
          customRoleId: createForm.customRoleId,
          profileStatus: createForm.profileStatus,
          emergencyContactName: createForm.emergencyName.trim() || null,
          emergencyContactPhone: createForm.emergencyPhone.trim() || null,
          emergencyContactRelation: createForm.emergencyRelation.trim() || null,
          payType: payT,
          payAmount: payAmt != null && !Number.isNaN(payAmt) ? payAmt : null,
          payCurrency: payT === "unspecified" ? null : createForm.payCurrency,
          payPeriod: payT === "unspecified" ? null : createForm.payPeriod,
          vacationPolicyEnabled: createForm.manageVacations,
          vacationDaysAnnual:
            createForm.manageVacations && createForm.vacationDaysAnnual.trim() !== ""
              ? parseInt(createForm.vacationDaysAnnual, 10)
              : null,
        }),
      });
      const rawText = await res.text();
      let j: { error?: string; warning?: string; id?: string } = {};
      try {
        j = rawText ? (JSON.parse(rawText) as typeof j) : {};
      } catch (parseErr) {
        console.error("[EmployeesModule] create: response is not JSON", res.status, rawText?.slice(0, 200), parseErr);
        setCreateError(lx.employees_create_error ?? "");
        return;
      }
      console.log("[EmployeesModule] POST /api/employees/create", res.status, j);
      if (!res.ok) {
        console.error("[EmployeesModule] create failed:", j.error ?? res.status);
        setCreateError(j.error ?? lx.employees_create_error ?? "");
        return;
      }
      if (j.warning) {
        console.warn("[EmployeesModule] create: extended fields warning:", j.warning);
      }
      setCreateOpen(false);
      setCreateForm({
        fullName: "",
        email: "",
        phone: "",
        customRoleId: customRoles.find((c) => c.id === "role-worker")?.id ?? "role-worker",
        profileStatus: "active",
        emergencyName: "",
        emergencyPhone: "",
        emergencyRelation: "",
        payType: "unspecified",
        payAmount: "",
        payCurrency: "CAD",
        payPeriod: "monthly",
        manageVacations: false,
        vacationDaysAnnual: "",
      });
      void load();
    } catch (e) {
      console.error("[EmployeesModule] create employee exception:", e);
      setCreateError((t as Record<string, string>).employees_create_error ?? "");
    } finally {
      setCreateSaving(false);
    }
  };

  const openInviteMailto = () => {
    const subj = encodeURIComponent((t as Record<string, string>).employees_invite ?? "");
    const body = encodeURIComponent(inviteEmail.trim());
    window.location.href = `mailto:${encodeURIComponent(inviteEmail.trim())}?subject=${subj}&body=${body}`;
    setInviteOpen(false);
    setInviteEmail("");
  };

  if (!companyId) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {(t as Record<string, string>).employees_no_company ?? ""}
      </p>
    );
  }

  if (selected) {
    const name = employeeDisplayLabel(selected, t as Record<string, string>);
    const emailShown = (selected.email ?? "").trim() || emailLocalPart(selected.email);
    const inheritPerms = draft.use_role_permissions !== false;
    const tl = t as Record<string, string>;
    const isSelf = currentUserProfileId != null && selected.id === currentUserProfileId;
    const workerSelf = isSelf && !canManageEmployees;
    const canEditBasicFields = canManageEmployees || isSelf;

    const formatPayReadOnly = (sel: ProfileRow): string => {
      const pt = (sel.pay_type ?? "unspecified").trim();
      if (!pt || pt === "unspecified") return tl.employees_pay_type_unspecified ?? "";
      const cur = sel.pay_currency ?? "";
      const amt = sel.pay_amount != null ? String(sel.pay_amount) : tl.common_dash ?? "";
      const per =
        sel.pay_period === "monthly"
          ? tl.pay_period_monthly ?? ""
          : sel.pay_period === "biweekly"
            ? tl.pay_period_biweekly ?? ""
            : sel.pay_period === "weekly"
              ? tl.pay_period_weekly ?? ""
              : "";
      if (pt === "fixed")
        return `${tl.employees_fixed_salary ?? ""}: ${amt} ${cur}${per ? ` · ${per}` : ""}`;
      if (pt === "hourly")
        return `${tl.employees_hourly_rate ?? ""}: ${amt} ${cur}${per ? ` · ${per}` : ""}`;
      return tl.common_dash ?? "";
    };

    return (
      <div className="space-y-4 max-w-3xl">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex min-h-[44px] items-center rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200"
        >
          {tl.nav_back ?? "← Atrás"}
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
              employeeInitials(selected)
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{name}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{roleLabel(selected)}</p>
          </div>
          {(canManageEmployees || selected.id === currentUserProfileId) && (
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
              {tl.employees_change_photo ?? ""}
            </label>
          )}
        </div>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Users className="h-4 w-4" />
            {tl.employees_basic_info ?? ""}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-zinc-500">{t.personnel ?? ""}</span>
              <input
                value={draft.full_name ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
                disabled={!canEditBasicFields}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500 flex items-center gap-1">
                <Phone className="h-3 w-3" /> {t.phone ?? ""}
              </span>
              <input
                value={draft.phone ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                disabled={!canEditBasicFields}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <div className="text-sm sm:col-span-2">
              <span className="text-zinc-500 flex items-center gap-1">
                <Mail className="h-3 w-3" /> {t.email ?? ""}
              </span>
              <span className="block mt-1 text-zinc-800 dark:text-zinc-100 break-all">
                {emailShown || (tl.employees_email_unknown ?? "")}
              </span>
            </div>
            <p className="text-sm">
              <span className="text-zinc-500">{tl.employees_start_date ?? tl.employees_joined ?? ""}</span>
              <span className="block mt-1">
                {selected.created_at ? new Date(selected.created_at).toLocaleDateString() : tl.common_dash ?? ""}
              </span>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-100 dark:border-slate-700">
            <label className="block text-sm">
              <span className="text-zinc-500">{t.employees_emergency_contact ?? ""}</span>
              <input
                value={draft.emergency_contact_name ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, emergency_contact_name: e.target.value }))}
                disabled={!canEditBasicFields}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{t.phone ?? ""}</span>
              <input
                value={draft.emergency_contact_phone ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, emergency_contact_phone: e.target.value }))}
                disabled={!canEditBasicFields}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{t.employees_emergency_relation ?? ""}</span>
              <input
                value={draft.emergency_contact_relation ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, emergency_contact_relation: e.target.value }))}
                disabled={!canEditBasicFields}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{tl.employees_payment_section ?? ""}</h3>
          {workerSelf ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap">{formatPayReadOnly(selected)}</p>
          ) : null}
          {canManageEmployees && !workerSelf ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm sm:col-span-2">
                <span className="text-zinc-500">{tl.employees_payment_type ?? ""}</span>
                <select
                  value={draft.pay_type ?? "unspecified"}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      pay_type: e.target.value,
                      pay_amount:
                        e.target.value === "unspecified" ? null : d.pay_amount ?? selected.pay_amount ?? null,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                >
                  <option value="unspecified">{tl.employees_pay_type_unspecified ?? ""}</option>
                  <option value="fixed">{tl.employees_fixed_salary ?? ""}</option>
                  <option value="hourly">{tl.employees_hourly_rate ?? ""}</option>
                </select>
              </label>
              {(draft.pay_type ?? "") !== "" && draft.pay_type !== "unspecified" ? (
                <>
                  <label className="block text-sm">
                    <span className="text-zinc-500">
                      {draft.pay_type === "fixed" ? tl.employees_fixed_salary ?? "" : tl.employees_hourly_rate ?? ""}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={draft.pay_amount ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          pay_amount: e.target.value === "" ? null : parseFloat(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-zinc-500">{tl.employees_currency ?? ""}</span>
                    <select
                      value={draft.pay_currency ?? "CAD"}
                      onChange={(e) => setDraft((d) => ({ ...d, pay_currency: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                    >
                      {PAY_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="text-zinc-500">{tl.employees_pay_period ?? ""}</span>
                    <select
                      value={draft.pay_period ?? "monthly"}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          pay_period: e.target.value as ProfileRow["pay_period"],
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                    >
                      <option value="monthly">{tl.pay_period_monthly ?? ""}</option>
                      <option value="biweekly">{tl.pay_period_biweekly ?? ""}</option>
                      <option value="weekly">{tl.pay_period_weekly ?? ""}</option>
                    </select>
                  </label>
                </>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {tl.employees_role_permissions ?? ""}
          </h3>
          <label className="block text-sm max-w-md">
            <span className="text-zinc-500">{tl.employees_assigned_role ?? tl.employees_role ?? ""}</span>
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

          <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
            <span className="text-sm text-zinc-700 dark:text-zinc-200">
              {tl.employees_use_role_permissions ?? ""}
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-zinc-300"
              checked={inheritPerms}
              disabled={!canManageEmployees}
              onChange={(e) => {
                const on = e.target.checked;
                setDraft((d) => ({
                  ...d,
                  use_role_permissions: on,
                  custom_permissions: on ? {} : mergePerm(selectedRolePermissions, d.custom_permissions),
                }));
              }}
            />
          </label>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {ROLE_PERMISSION_KEYS.map((key) => (
              <label
                key={key}
                className={`flex items-center justify-between gap-3 text-sm py-1 ${inheritPerms ? "opacity-80" : ""}`}
              >
                <span className="text-zinc-600 dark:text-zinc-300">{permLabel(key, t as Record<string, string>)}</span>
                <input
                  type="checkbox"
                  checked={effectivePermissionValue(key)}
                  onChange={() => togglePermission(key)}
                  disabled={!canManageEmployees || inheritPerms}
                  className="h-5 w-5 rounded border-zinc-300"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            {tl.employees_assigned_projects ?? tl.employees_projects ?? ""}
          </h3>
          <ul className="text-sm space-y-2 max-h-56 overflow-y-auto">
            {activeProjects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-zinc-700 dark:text-zinc-200 truncate">· {p.name}</span>
                {canManageEmployees && (
                  <button
                    type="button"
                    onClick={() => void toggleProject(p.id)}
                    className="min-h-[44px] shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 text-sm"
                  >
                    {assignedProjectIds.includes(p.id)
                      ? (tl.employees_project_unassign ?? "")
                      : (tl.employees_project_assign ?? "")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Palmtree className="h-4 w-4" />
            {tl.employees_vacation_absences ?? tl.employees_vacations_section ?? t.employees_vacation_days_allowed ?? ""}
          </h3>
          {canManageEmployees && !workerSelf ? (
            <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
              <span className="text-sm text-zinc-700 dark:text-zinc-200">{tl.employees_manage_vacations ?? ""}</span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-zinc-300"
                checked={Boolean(draft.vacation_policy_enabled)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    vacation_policy_enabled: e.target.checked,
                    vacation_days_allowed: e.target.checked ? d.vacation_days_allowed : null,
                  }))
                }
              />
            </label>
          ) : null}
          <label className="block text-sm max-w-xs">
            <span className="text-xs text-zinc-500">{t.employees_vacation_days_allowed ?? ""}</span>
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
              disabled={!canManageEmployees || workerSelf || !draft.vacation_policy_enabled}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            />
          </label>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {t.employees_vacation_used ?? ""}:{" "}
            <span className="font-medium tabular-nums">{vacationStats.used}</span>
            {" · "}
            {t.employees_vacation_pending ?? ""}:{" "}
            <span className="font-medium tabular-nums">{vacationStats.pending}</span>
          </p>
          <div>
            <p className="text-xs font-semibold text-zinc-500 mb-2">{tl.employees_request_history ?? tl.employees_vacation_history ?? ""}</p>
            <ul className="space-y-2 text-sm max-h-40 overflow-y-auto">
              {vacationsForSelected.length === 0 ? (
                <li className="text-zinc-500 italic">{tl.employees_no_requests ?? tl.employees_vacation_none ?? ""}</li>
              ) : (
                vacationsForSelected.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 dark:border-slate-800 pb-2"
                  >
                    <span>
                      {v.start_date} → {v.end_date}
                    </span>
                    <span className="tabular-nums">{v.total_days}d</span>
                    <span className="text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">
                      {v.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        {complianceFields.filter((f) => f.target.includes("employee")).length > 0 && (
          <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {tl.employees_compliance ?? t.compliance ?? ""}
            </h3>
            <ul className="space-y-2">
              {complianceFields
                .filter((f) => f.target.includes("employee"))
                .map((field) => {
                  const tid = complianceTargetId(selected.id);
                  const rec = complianceRecords.find(
                    (r) => r.fieldId === field.id && r.targetType === "employee" && r.targetId === tid
                  );
                  const tone = complianceTone(rec?.status ?? "missing", t as Record<string, string>);
                  return (
                    <li
                      key={field.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-slate-800 pb-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{field.name}</p>
                        {rec?.expiryDate && (
                          <p className="text-xs text-zinc-500">
                            {tl.expiresOn ?? ""}: {rec.expiryDate}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs rounded-full px-2 py-0.5 ${tone.cls}`}>{tone.label}</span>
                        {canManageEmployees && onComplianceRecordsChange && (
                          <button
                            type="button"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600"
                            onClick={() =>
                              setComplianceEdit({
                                field,
                                expiryDate: rec?.expiryDate ?? "",
                                documentUrl: rec?.documentUrl ?? "",
                                value: rec?.value ?? "",
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {tl.employeeDocs ?? ""}
          </h3>
          <ul className="space-y-2 text-sm">
            {employeeDocs.map((d) => (
              <li key={d.id}>
                {d.file_url ? (
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-600 dark:text-amber-400 underline break-all"
                  >
                    {d.name}
                  </a>
                ) : (
                  d.name
                )}
              </li>
            ))}
          </ul>
          {canManageEmployees && (
            <label className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadEmployeeDoc(f);
                }}
              />
              {tl.employees_upload_document ?? ""}
            </label>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-center">
          <div>
            <span className="text-xs text-zinc-500">{tl.common_status ?? tl.employees_status ?? ""}</span>
            <select
              value={draft.profile_status ?? "active"}
              onChange={(e) => setDraft((d) => ({ ...d, profile_status: e.target.value }))}
              disabled={!canManageEmployees}
              className="block mt-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            >
              <option value="active">{tl.employees_status_active ?? ""}</option>
              <option value="inactive">{tl.employees_status_inactive ?? ""}</option>
              <option value="invited">{tl.employees_status_invited ?? ""}</option>
            </select>
          </div>
          {(canManageEmployees || workerSelf) && (
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={saving}
              className="min-h-[44px] rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-medium"
            >
              {saving ? "…" : (t.accept ?? "")}
            </button>
          )}
          {canManageEmployees && (
            <button
              type="button"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
              onClick={() => {
                setInviteEmail((selected.email ?? "").trim());
                setInviteOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              {t.employees_invite ?? ""}
            </button>
          )}
        </section>

        {complianceEdit && onComplianceRecordsChange && (
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/50"
              aria-hidden
              onClick={() => setComplianceEdit(null)}
            />
            <div className="fixed z-[61] left-4 right-4 bottom-4 sm:left-auto sm:top-24 sm:right-4 sm:bottom-auto max-w-md rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm">{complianceEdit.field.name}</h4>
                <button
                  type="button"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center"
                  onClick={() => setComplianceEdit(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label className="block text-xs">
                {tl.expiresOn ?? ""}
                <input
                  type="date"
                  value={complianceEdit.expiryDate.slice(0, 10)}
                  onChange={(e) =>
                    setComplianceEdit((c) => (c ? { ...c, expiryDate: e.target.value } : c))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 min-h-[44px]"
                />
              </label>
              <label className="block text-xs">
                {tl.documentUrl ?? ""}
                <input
                  value={complianceEdit.documentUrl}
                  onChange={(e) =>
                    setComplianceEdit((c) => (c ? { ...c, documentUrl: e.target.value } : c))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 min-h-[44px]"
                />
              </label>
              <button
                type="button"
                className="w-full min-h-[44px] rounded-lg bg-amber-600 text-white text-sm font-medium"
                onClick={() => {
                  const tid = complianceTargetId(selected.id);
                  const f = complianceEdit.field;
                  const status = recordStatusFromInputs(
                    complianceEdit.expiryDate,
                    f.alertDaysBefore,
                    f.fieldType
                  );
                  const existing = complianceRecords.find(
                    (r) => r.fieldId === f.id && r.targetType === "employee" && r.targetId === tid
                  );
                  const next: ComplianceRecord = {
                    id: existing?.id ?? `cr-${Date.now()}`,
                    fieldId: f.id,
                    targetType: "employee",
                    targetId: tid,
                    value: complianceEdit.value,
                    expiryDate: complianceEdit.expiryDate || undefined,
                    documentUrl: complianceEdit.documentUrl || undefined,
                    status,
                    updatedAt: new Date().toISOString(),
                  };
                  const rest = complianceRecords.filter(
                    (r) =>
                      !(r.fieldId === f.id && r.targetType === "employee" && r.targetId === tid)
                  );
                  onComplianceRecordsChange([...rest, next]);
                  setComplianceEdit(null);
                }}
              >
                {t.accept ?? ""}
              </button>
            </div>
          </>
        )}

        {inviteOpen && (
          <>
            <div className="fixed inset-0 z-[60] bg-black/50" aria-hidden onClick={() => setInviteOpen(false)} />
            <div className="fixed z-[61] left-4 right-4 bottom-4 sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 max-w-md rounded-xl border bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3">
              <p className="text-sm font-medium">{t.employees_invite ?? ""}</p>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 min-h-[44px]"
                placeholder={t.email ?? ""}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="min-h-[44px] px-4 rounded-lg border"
                  onClick={() => setInviteOpen(false)}
                >
                  {t.cancel ?? ""}
                </button>
                <button
                  type="button"
                  disabled={!inviteEmail.includes("@")}
                  className="min-h-[44px] px-4 rounded-lg bg-amber-600 text-white disabled:opacity-50"
                  onClick={() => openInviteMailto()}
                >
                  {tl.employees_invite_send ?? ""}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  const tl = t as Record<string, string>;

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t.employees_title ?? ""}
        </h2>
        {showNewEmployeeButton && canManageEmployees && (
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setCreateForm({
                  fullName: "",
                  email: "",
                  phone: "",
                  customRoleId:
                    customRoles.find((c) => c.id === "role-worker")?.id ??
                    customRoles[0]?.id ??
                    "role-worker",
                  profileStatus: "active",
                  emergencyName: "",
                  emergencyPhone: "",
                  emergencyRelation: "",
                  payType: "unspecified",
                  payAmount: "",
                  payCurrency: "CAD",
                  payPeriod: "monthly",
                  manageVacations: false,
                  vacationDaysAnnual: "",
                });
                setCreateOpen(true);
              }}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              {tl.employees_new ?? ""}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tl.employees_search ?? ""}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 pl-10 pr-3 py-2.5 text-sm min-h-[44px]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2.5 text-sm min-h-[44px]"
        >
          <option value="all">{t.whFilterAll ?? ""}</option>
          <option value="admin">{tl.admin ?? ""}</option>
          <option value="supervisor">{tl.supervisor ?? ""}</option>
          <option value="worker">{tl.worker ?? ""}</option>
          <option value="logistic">{tl.logistic ?? ""}</option>
          {customRoles.map((r) => (
            <option key={r.id} value={`custom:${r.id}`}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2.5 text-sm min-h-[44px]"
        >
          <option value="all">{t.whFilterAll ?? ""}</option>
          <option value="active">{tl.employees_status_active ?? ""}</option>
          <option value="inactive">{tl.employees_status_inactive ?? ""}</option>
          <option value="invited">{tl.employees_status_invited ?? ""}</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{t.loading ?? ""}</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-slate-700 rounded-xl border border-zinc-200 dark:border-slate-700 overflow-hidden">
          {filtered.map((r) => (
            <li key={r.id} className="flex items-stretch">
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className="min-w-0 flex flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-slate-800 min-h-[56px]"
              >
                <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium shrink-0">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                  ) : (
                    employeeInitials(r)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-white truncate">{employeeDisplayLabel(r, tl)}</p>
                  <p className="text-xs text-zinc-500 truncate">
                    {(() => {
                      const em = (r.email ?? "").trim();
                      const rl = roleLabel(r);
                      if (em) return `${em} · ${rl}`;
                      return rl;
                    })()}
                  </p>
                </div>
                <span className="text-xs rounded-full px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                  {r.profile_status === "inactive"
                    ? tl.common_inactive ?? ""
                    : r.profile_status === "invited"
                      ? tl.employees_status_invited ?? ""
                      : tl.common_active ?? ""}
                </span>
              </button>
              {canManageEmployees && (
                <div className="flex shrink-0 items-center gap-0.5 border-l border-zinc-200 dark:border-slate-700 px-1">
                  <button
                    type="button"
                    aria-label={tl.common_edit ?? "Edit"}
                    onClick={() => setSelectedId(r.id)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={tl.common_delete ?? ""}
                    onClick={() => void deactivateProfile(r.id, employeeDisplayLabel(r, tl))}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-8">{tl.employees_empty ?? ""}</p>
      )}

      {createOpen && canManageEmployees && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50"
            aria-hidden
            onClick={() => !createSaving && setCreateOpen(false)}
          />
          <div
            className="fixed z-[61] left-4 right-4 bottom-4 sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              {tl.employees_create_modal_title ?? ""}
            </h3>
            {createError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {createError}
              </p>
            )}
            <label className="block text-sm">
              <span className="text-zinc-500">{tl.employees_full_name ?? t.personnel ?? ""} *</span>
              <input
                value={createForm.fullName}
                onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                autoComplete="name"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500 flex items-center gap-1">
                <Mail className="h-3 w-3" /> {t.email ?? ""} *
              </span>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                autoComplete="email"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500 flex items-center gap-1">
                <Phone className="h-3 w-3" /> {t.phone ?? ""}
              </span>
              <input
                type="tel"
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <p className="text-xs font-semibold text-zinc-500 pt-2 border-t border-zinc-200 dark:border-slate-700">
              {tl.employees_section_emergency ?? ""}
            </p>
            <label className="block text-sm">
              <span className="text-zinc-500">{t.employees_emergency_contact ?? ""}</span>
              <input
                value={createForm.emergencyName}
                onChange={(e) => setCreateForm((f) => ({ ...f, emergencyName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{tl.employees_emergency_phone ?? t.phone ?? ""}</span>
              <input
                type="tel"
                value={createForm.emergencyPhone}
                onChange={(e) => setCreateForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{t.employees_emergency_relation ?? ""}</span>
              <input
                value={createForm.emergencyRelation}
                onChange={(e) => setCreateForm((f) => ({ ...f, emergencyRelation: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <p className="text-xs font-semibold text-zinc-500 pt-2 border-t border-zinc-200 dark:border-slate-700">
              {tl.employees_section_pay ?? ""}
            </p>
            <label className="block text-sm">
              <span className="text-zinc-500">{tl.employees_payment_type ?? ""}</span>
              <select
                value={createForm.payType}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    payType: e.target.value as typeof f.payType,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="unspecified">{tl.employees_pay_type_unspecified ?? ""}</option>
                <option value="fixed">{tl.employees_fixed_salary ?? ""}</option>
                <option value="hourly">{tl.employees_hourly_rate ?? ""}</option>
              </select>
            </label>
            {createForm.payType !== "unspecified" ? (
              <>
                <label className="block text-sm">
                  <span className="text-zinc-500">
                    {createForm.payType === "fixed"
                      ? tl.employees_fixed_salary ?? ""
                      : tl.employees_hourly_rate ?? ""}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={createForm.payAmount}
                    onChange={(e) => setCreateForm((f) => ({ ...f, payAmount: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-500">{tl.employees_currency ?? ""}</span>
                  <select
                    value={createForm.payCurrency}
                    onChange={(e) => setCreateForm((f) => ({ ...f, payCurrency: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                  >
                    {PAY_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-500">{tl.employees_pay_period ?? ""}</span>
                  <select
                    value={createForm.payPeriod}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        payPeriod: e.target.value as typeof f.payPeriod,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="monthly">{tl.pay_period_monthly ?? ""}</option>
                    <option value="biweekly">{tl.pay_period_biweekly ?? ""}</option>
                    <option value="weekly">{tl.pay_period_weekly ?? ""}</option>
                  </select>
                </label>
              </>
            ) : null}
            <p className="text-xs font-semibold text-zinc-500 pt-2 border-t border-zinc-200 dark:border-slate-700">
              {tl.employees_section_vacation ?? ""}
            </p>
            <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
              <span className="text-sm text-zinc-700 dark:text-zinc-200">{tl.employees_manage_vacations ?? ""}</span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-zinc-300"
                checked={createForm.manageVacations}
                onChange={(e) => setCreateForm((f) => ({ ...f, manageVacations: e.target.checked }))}
              />
            </label>
            {createForm.manageVacations ? (
              <label className="block text-sm">
                <span className="text-zinc-500">{tl.employees_vacation_days_annual ?? t.employees_vacation_days_allowed ?? ""}</span>
                <input
                  type="number"
                  min={0}
                  value={createForm.vacationDaysAnnual}
                  onChange={(e) => setCreateForm((f) => ({ ...f, vacationDaysAnnual: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                />
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="text-zinc-500">{tl.employees_role ?? ""}</span>
              <select
                value={createForm.customRoleId}
                onChange={(e) => setCreateForm((f) => ({ ...f, customRoleId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              >
                {customRoles.map((cr) => (
                  <option key={cr.id} value={cr.id}>
                    {cr.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{tl.employees_status ?? ""}</span>
              <select
                value={createForm.profileStatus}
                onChange={(e) => setCreateForm((f) => ({ ...f, profileStatus: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="active">{tl.employees_status_active ?? ""}</option>
                <option value="inactive">{tl.employees_status_inactive ?? ""}</option>
                <option value="invited">{tl.employees_status_invited ?? ""}</option>
              </select>
            </label>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                className="min-h-[44px] px-4 rounded-lg border border-zinc-300 dark:border-zinc-600"
                disabled={createSaving}
                onClick={() => setCreateOpen(false)}
              >
                {t.cancel ?? ""}
              </button>
              <button
                type="button"
                className="min-h-[44px] px-4 rounded-lg bg-amber-600 text-white disabled:opacity-50"
                disabled={createSaving}
                onClick={() => void submitCreateEmployee()}
              >
                {createSaving ? "…" : tl.employees_create_submit ?? t.save ?? ""}
              </button>
            </div>
          </div>
        </>
      )}

      {inviteOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" aria-hidden onClick={() => setInviteOpen(false)} />
          <div className="fixed z-[61] left-4 right-4 bottom-4 sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 max-w-md rounded-xl border bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3">
            <p className="text-sm font-medium">{t.employees_invite ?? ""}</p>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 min-h-[44px]"
              placeholder={t.email ?? ""}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="min-h-[44px] px-4 rounded-lg border"
                onClick={() => setInviteOpen(false)}
              >
                {t.cancel ?? ""}
              </button>
              <button
                type="button"
                disabled={!inviteEmail.includes("@")}
                className="min-h-[44px] px-4 rounded-lg bg-amber-600 text-white disabled:opacity-50"
                onClick={() => openInviteMailto()}
              >
                {tl.employees_invite_send ?? ""}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
