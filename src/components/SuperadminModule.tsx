"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dateLocaleForUser, resolveUserTimezone, formatDate, formatDateTime } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";
import { supabase } from "@/lib/supabase";
import { PAID_PLAN_ORDER, type PaidPlanKey } from "@/lib/stripe";
import type { Invitation, InvitationPlan } from "@/types/invitation";
import { ALL_TRANSLATIONS } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { getAuditActionLabel } from "@/lib/auditDisplay";

const PM_EN = ALL_TRANSLATIONS.en as Record<string, string>;

export interface SuperadminModuleProps {
  t: Record<string, string>;
}

type SubLite = {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  billing_period: string | null;
  stripe_subscription_id: string | null;
} | null;

export type SuperadminCompany = {
  id: string;
  name: string;
  plan?: string;
  is_active?: boolean | null;
  storage_used_gb?: number | null;
  created_at?: string | null;
  country_code?: string | null;
  subscription: SubLite;
  user_count: number;
  project_count: number;
  last_access_at?: string | null;
};

type Stats = {
  totalCompanies: number;
  activeCompanies?: number;
  totalUsers: number;
  totalUsersAll?: number;
  mrrCadApprox: number;
  trialsActive: number;
  conversionsWeek: number;
  planDistribution: Record<string, number>;
  payingCompanies?: number;
  trialsCompaniesApprox?: number;
  countriesTop?: { country: string; users: number }[];
  moduleUsageTop?: { entity_type: string; hits: number }[];
};

type FounderRow = {
  company_id: string;
  company_name: string;
  status: string;
  plan: string;
  trial_ends_at: string | null;
  coupon_code_label: string;
  note: string;
};

function companyUiState(c: SuperadminCompany): "active" | "trial" | "inactive" {
  if (c.is_active === false) return "inactive";
  const sub = c.subscription;
  const plan = (sub?.plan ?? c.plan ?? "").toLowerCase();
  if (sub?.status === "trialing" || plan === "trial") return "trial";
  return "active";
}

async function authHeaders(): Promise<HeadersInit> {
  const session = (await supabase?.auth.getSession())?.data.session;
  const token = session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const LEGACY_INVITE_PLANS: InvitationPlan[] = ["starter", "pro", "enterprise"];
const INVITE_PLANS: InvitationPlan[] = ["trial", ...PAID_PLAN_ORDER, ...LEGACY_INVITE_PLANS];

const FILTER_PLAN_VALUES = ["trial", ...PAID_PLAN_ORDER, ...LEGACY_INVITE_PLANS] as const;

function inviteDisplayStatus(inv: Invitation): "pending" | "accepted" | "expired" {
  if (inv.status !== "pending") return inv.status;
  if (new Date(inv.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

function inviteStatusBadgeClass(s: "pending" | "accepted" | "expired"): string {
  switch (s) {
    case "pending":
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200";
    case "accepted":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "expired":
      return "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }
}

function companyStateBadgeClass(s: "active" | "trial" | "inactive"): string {
  switch (s) {
    case "active":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "trial":
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200";
    case "inactive":
      return "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function statusBadgeClass(status: string | undefined): string {
  switch (status) {
    case "trialing":
      return "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    case "active":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "past_due":
      return "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200";
    case "canceled":
    case "cancelled":
      return "bg-gray-900 text-white dark:bg-gray-950 dark:text-gray-100";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

export function SuperadminModule({ t }: SuperadminModuleProps) {
  const tl = t as Record<string, string>;
  const l = (k: string) => tl[k] ?? PM_EN[k] ?? k;
  const { showToast } = useToast();
  void useMachinProDisplayPrefs();
  const saLocale = dateLocaleForUser("en", "CA");
  const saTz = resolveUserTimezone(null);
  const [companies, setCompanies] = useState<SuperadminCompany[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterCompanyState, setFilterCompanyState] = useState<"all" | "active" | "trial" | "inactive">("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    company: Record<string, unknown> | null;
    subscription: Record<string, unknown> | null;
    users: Record<string, unknown>[];
    audits: Record<string, unknown>[];
    metrics?: {
      projects: number;
      employeeDocuments: number;
      employees: number;
      storage_gb: number | null;
    };
  } | null>(null);
  const [founders, setFounders] = useState<FounderRow[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invPending, setInvPending] = useState(0);
  const [invAcceptedMonth, setInvAcceptedMonth] = useState(0);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [extendTrialOpen, setExtendTrialOpen] = useState(false);
  const [extendDays, setExtendDays] = useState<30 | 60 | 90>(30);
  const [extendNote, setExtendNote] = useState("");
  const [inviteForm, setInviteForm] = useState<{
    email: string;
    companyName: string;
    plan: InvitationPlan;
    message: string;
  }>({ email: "", companyName: "", plan: "trial", message: "" });
  const [inviteSending, setInviteSending] = useState(false);

  useEffect(() => {
    if (!detailId && !extendTrialOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (extendTrialOpen) setExtendTrialOpen(false);
      else setDetailId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId, extendTrialOpen]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const h = await authHeaders();
      if (!("Authorization" in h)) {
        setError(tl.superadmin_error_auth ?? PM_EN.superadmin_error_auth);
        setLoading(false);
        return;
      }
      const [cRes, sRes, bfRes] = await Promise.all([
        fetch("/api/superadmin/companies", { headers: h }),
        fetch("/api/superadmin/stats", { headers: h }),
        fetch("/api/superadmin/beta-founders", { headers: h }),
      ]);
      const cJson = (await cRes.json()) as { companies?: SuperadminCompany[]; error?: string };
      const sJson = (await sRes.json()) as Stats & { error?: string };
      if (!cRes.ok) setError(cJson.error ?? PM_EN.register_error_generic);
      else setCompanies(cJson.companies ?? []);
      if (sRes.ok) setStats(sJson);
      if (bfRes.ok) {
        const bf = (await bfRes.json()) as { founders?: FounderRow[] };
        setFounders(bf.founders ?? []);
      } else {
        setFounders([]);
      }

      const invRes = await fetch("/api/invitations", { headers: h });
      if (invRes.ok) {
        const ij = (await invRes.json()) as {
          invitations?: Invitation[];
          pendingCount?: number;
          acceptedThisMonth?: number;
        };
        setInvitations(ij.invitations ?? []);
        setInvPending(ij.pendingCount ?? 0);
        setInvAcceptedMonth(ij.acceptedThisMonth ?? 0);
      } else {
        setInvitations([]);
        setInvPending(0);
        setInvAcceptedMonth(0);
      }
    } catch {
      setError(tl.superadmin_error_load ?? PM_EN.superadmin_error_load);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback(
    async (id: string) => {
      setDetailId(id);
      setDetailLoading(true);
      setDetailData(null);
      try {
        const h = await authHeaders();
        const res = await fetch(`/api/superadmin/company-detail?companyId=${encodeURIComponent(id)}`, {
          headers: h,
        });
        const j = (await res.json()) as typeof detailData;
        if (res.ok && j) setDetailData(j);
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  const runAction = useCallback(
    async (
      companyId: string,
      action: "extend_trial" | "change_plan" | "cancel",
      planKey?: PaidPlanKey,
      trialExtra?: { days?: number; preset?: string; internal_note?: string | null }
    ) => {
      setActionLoading(`${companyId}-${action}`);
      try {
        const h = await authHeaders();
        const res = await fetch("/api/superadmin/company", {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            action,
            planKey,
            ...(action === "extend_trial" && trialExtra ? trialExtra : {}),
          }),
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          setError(j.error ?? PM_EN.register_error_generic);
          return;
        }
        if (action === "extend_trial") {
          showToast("success", l("superadmin_extend_toast_ok"));
          setExtendTrialOpen(false);
        }
        await load();
        if (detailId === companyId) void openDetail(companyId);
      } finally {
        setActionLoading(null);
      }
    },
    [detailId, load, openDetail, l, showToast]
  );

  const sendInvite = useCallback(async () => {
    setInviteSending(true);
    setError(null);
    try {
      const h = await authHeaders();
      const res = await fetch("/api/invitations/send", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          companyName: inviteForm.companyName.trim(),
          plan: inviteForm.plan,
          message: inviteForm.message.trim() || null,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? PM_EN.invite_error_send);
        return;
      }
      setInviteModalOpen(false);
      setInviteForm({ email: "", companyName: "", plan: "trial", message: "" });
      await load();
    } catch {
      setError(tl.invite_error_send ?? PM_EN.invite_error_send);
    } finally {
      setInviteSending(false);
    }
  }, [inviteForm, load, t]);

  const resendInvite = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const h = await authHeaders();
        const res = await fetch("/api/invitations/resend", {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify({ invitationId: id }),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(j.error ?? PM_EN.register_error_generic);
          return;
        }
        await load();
      } catch {
        setError(tl.invite_error_send ?? PM_EN.invite_error_send);
      }
    },
    [load, t]
  );

  const cancelInvite = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const h = await authHeaders();
        const res = await fetch("/api/invitations/cancel", {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify({ invitationId: id }),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(j.error ?? PM_EN.register_error_generic);
          return;
        }
        await load();
      } catch {
        setError(tl.invite_error_send ?? PM_EN.invite_error_send);
      }
    },
    [load, t]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (q && !c.name?.toLowerCase().includes(q)) return false;
      const sub = c.subscription;
      const plan = (sub?.plan ?? c.plan ?? "").toLowerCase();
      if (filterPlan !== "all") {
        const want = filterPlan.toLowerCase();
        const planNorm = plan;
        const matches =
          want === "trial"
            ? sub?.status === "trialing" || planNorm === "trial"
            : want === "esencial"
              ? planNorm === "esencial" ||
                planNorm === "foundation" ||
                planNorm === "starter" ||
                planNorm === "horarios"
              : want === "operaciones"
                ? planNorm === "operaciones" ||
                  planNorm === "obras" ||
                  planNorm === "pro" ||
                  planNorm === "professional"
                : want === "logistica"
                  ? planNorm === "logistica"
                  : want === "todo_incluido"
                    ? planNorm === "todo_incluido" || planNorm === "enterprise"
                    : planNorm.includes(want);
        if (!matches) return false;
      }
      if (filterStatus !== "all" && (sub?.status ?? "none") !== filterStatus) return false;
      if (filterCompanyState !== "all" && companyUiState(c) !== filterCompanyState) return false;
      if (dateFrom && c.created_at) {
        if (new Date(c.created_at) < new Date(dateFrom)) return false;
      }
      if (dateTo && c.created_at) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(c.created_at).getTime() > end.getTime()) return false;
      }
      return true;
    });
  }, [companies, search, filterPlan, filterStatus, filterCompanyState, dateFrom, dateTo]);

  const exportCsv = useCallback(() => {
    const headers = [
      "id",
      "name",
      "plan",
      "company_state",
      "sub_status",
      "users",
      "projects",
      "trial_end",
      "next_charge",
      "created",
      "last_access",
      "country",
    ];
    const lines = [headers.join(",")];
    for (const c of filtered) {
      const sub = c.subscription;
      lines.push(
        [
          c.id,
          JSON.stringify(c.name ?? ""),
          sub?.plan ?? c.plan ?? "",
          companyUiState(c),
          sub?.status ?? "",
          c.user_count,
          c.project_count,
          sub?.trial_ends_at ?? "",
          sub?.current_period_end ?? "",
          c.created_at ?? "",
          c.last_access_at ?? "",
          c.country_code ?? "",
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `machinpro-companies-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [filtered]);

  const dist = stats?.planDistribution ?? {};
  const distMax = Math.max(1, ...Object.values(dist));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 sm:py-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {l("superadmin_title")}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {l("superadmin_companies")}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {[
            {
              label: l("superadmin_active_companies"),
              value: stats.activeCompanies ?? stats.totalCompanies,
            },
            { label: l("superadmin_users_total"), value: stats.totalUsers },
            {
              label: l("superadmin_mrr"),
              value: `${l("superadmin_mrr_approx_prefix")}${stats.mrrCadApprox}${l("superadmin_mrr_suffix")}`,
            },
            {
              label: l("superadmin_paying_companies"),
              value: stats.payingCompanies ?? "—",
            },
            {
              label: l("superadmin_trials_companies_approx"),
              value: stats.trialsCompaniesApprox ?? "—",
            },
            { label: l("superadmin_conversions"), value: stats.conversionsWeek },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{k.label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {stats && (stats.countriesTop?.length || stats.moduleUsageTop?.length) ? (
        <div className="grid md:grid-cols-2 gap-4">
          {stats.countriesTop && stats.countriesTop.length > 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                {l("superadmin_top_countries")}
              </h2>
              <ul className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
                {stats.countriesTop.map((row) => (
                  <li key={row.country} className="flex justify-between gap-2">
                    <span className="font-mono text-xs">{row.country}</span>
                    <span className="tabular-nums">{row.users}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {stats.moduleUsageTop && stats.moduleUsageTop.length > 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                {l("superadmin_top_modules")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{l("superadmin_top_modules_hint")}</p>
              <ul className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
                {stats.moduleUsageTop.map((row) => (
                  <li key={row.entity_type} className="flex justify-between gap-2">
                    <span className="truncate">{row.entity_type}</span>
                    <span className="tabular-nums shrink-0">{row.hits}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {founders.length > 0 ? (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {l("superadmin_beta_founders")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{l("superadmin_beta_founders_hint")}</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{l("superadmin_col_name")}</th>
                  <th className="px-4 py-3 text-left font-medium">{l("superadmin_beta_coupon")}</th>
                  <th className="px-4 py-3 text-left font-medium">{l("superadmin_status")}</th>
                  <th className="px-4 py-3 text-left font-medium">{l("superadmin_col_trial")}</th>
                  <th className="px-4 py-3 text-left font-medium" />
                </tr>
              </thead>
              <tbody>
                {founders.map((f, idx) => (
                  <tr
                    key={`${f.company_id}-${idx}`}
                    className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{f.company_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {f.coupon_code_label}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(f.status)}`}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                      {f.trial_ends_at ? formatDate(f.trial_ends_at, saLocale, saTz) : l("common_dash")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailId(f.company_id);
                          setExtendDays(30);
                          setExtendNote("");
                          setExtendTrialOpen(true);
                        }}
                        className="min-h-[44px] px-3 rounded-lg border border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-medium"
                      >
                        {l("superadmin_extend_trial")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {stats && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {l("superadmin_chart_plans")}
          </h2>
          <div className="space-y-2">
            {Object.entries(dist).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-gray-600 dark:text-gray-400 capitalize">{k}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${(v / distMax) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-gray-900 dark:text-gray-100">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {l("invite_title")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {l("invite_stats_pending").replace("{n}", String(invPending))}{" "}
              ·{" "}
              {l("invite_stats_accepted_month").replace("{n}", String(invAcceptedMonth))}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 text-sm font-semibold"
          >
            {l("invite_new")}
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  {l("invite_company")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {l("invite_email")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {l("invite_plan")}
                </th>
                <th className="px-4 py-3 text-left font-medium">{l("superadmin_status")}</th>
                <th className="px-4 py-3 text-left font-medium">
                  {l("invite_sent_at")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {l("invite_expires")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {l("invite_table_actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => {
                const disp = inviteDisplayStatus(inv);
                const planKey = `invite_plan_${inv.plan}` as const;
                const planLabel =
                  (t as Record<string, string>)[planKey] ?? inv.plan;
                const statusLabel =
                  disp === "pending"
                    ? (l("invite_status_pending"))
                    : disp === "accepted"
                      ? (l("invite_status_accepted"))
                      : (l("invite_status_expired"));
                return (
                  <tr
                    key={inv.id}
                    className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {inv.company_name}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{inv.email}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 capitalize">{planLabel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${inviteStatusBadgeClass(disp)}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                      {inv.created_at ? formatDateTime(inv.created_at, saLocale, saTz) : l("common_dash")}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                      {inv.expires_at ? formatDateTime(inv.expires_at, saLocale, saTz) : l("common_dash")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {inv.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => void resendInvite(inv.id)}
                            className="min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium"
                          >
                            {l("invite_resend")}
                          </button>
                        )}
                        {inv.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => void cancelInvite(inv.id)}
                            className="min-h-[44px] px-3 rounded-lg border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium"
                          >
                            {l("invite_cancel")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-md max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-6 space-y-4">
            <div className="flex justify-between gap-2 items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {l("invite_new")}
              </h3>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                aria-label={l("invite_close")}
              >
                ×
              </button>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {l("invite_email")}
              </span>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-gray-900 dark:text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {l("invite_company")}
              </span>
              <input
                value={inviteForm.companyName}
                onChange={(e) => setInviteForm((f) => ({ ...f, companyName: e.target.value }))}
                className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-gray-900 dark:text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {l("invite_plan")}
              </span>
              <select
                value={inviteForm.plan}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, plan: e.target.value as InvitationPlan }))
                }
                className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 min-h-[44px] text-gray-900 dark:text-white"
              >
                {INVITE_PLANS.map((p) => (
                  <option key={p} value={p}>
                    {(t as Record<string, string>)[`invite_plan_${p}`] ??
                      (t as Record<string, string>)[`pricing_${p}`] ??
                      p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {l("invite_message")}
              </span>
              <textarea
                value={inviteForm.message}
                onChange={(e) => setInviteForm((f) => ({ ...f, message: e.target.value }))}
                rows={3}
                className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-white"
              />
            </label>
            <button
              type="button"
              disabled={inviteSending || !inviteForm.email.trim() || !inviteForm.companyName.trim()}
              onClick={() => void sendInvite()}
              className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-sm"
            >
              {l("invite_send")}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {l("superadmin_search")}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 min-h-[44px] text-sm min-w-[200px]"
            />
          </label>
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {l("superadmin_filter_plan")}
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 min-h-[44px] text-sm"
            >
              <option value="all">{l("common_dash")}</option>
              {FILTER_PLAN_VALUES.map((p) => (
                <option key={p} value={p}>
                  {(t as Record<string, string>)[`invite_plan_${p}`] ??
                    (t as Record<string, string>)[`pricing_${p}`] ??
                    p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {l("superadmin_filter_status")}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 min-h-[44px] text-sm"
            >
              <option value="all">{l("common_dash")}</option>
              <option value="trialing">trialing</option>
              <option value="active">active</option>
              <option value="past_due">past_due</option>
              <option value="canceled">canceled</option>
              <option value="none">none</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {l("superadmin_filter_company_state")}
            <select
              value={filterCompanyState}
              onChange={(e) => setFilterCompanyState(e.target.value as typeof filterCompanyState)}
              className="mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 min-h-[44px] text-sm"
            >
              <option value="all">{l("common_dash")}</option>
              <option value="active">{l("superadmin_state_active")}</option>
              <option value="trial">{l("superadmin_state_trial")}</option>
              <option value="inactive">{l("superadmin_state_inactive")}</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {l("superadmin_filter_date")}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 min-h-[44px] text-sm"
            />
          </label>
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {l("superadmin_filter_date_until")}
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 min-h-[44px] text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => exportCsv()}
          className="min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {l("superadmin_export_csv")}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="p-8 text-center text-gray-500 dark:text-gray-400">{l("superadmin_loading")}</p>
        ) : (
          <table className="w-full text-sm min-w-[1040px]">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{l("superadmin_col_name")}</th>
                <th className="px-4 py-3 text-left font-medium">{l("superadmin_plan")}</th>
                <th className="px-4 py-3 text-left font-medium">{l("superadmin_company_state")}</th>
                <th className="px-4 py-3 text-left font-medium">{l("superadmin_status")}</th>
                <th className="px-4 py-3 text-left font-medium">{l("superadmin_col_users")}</th>
                <th className="px-4 py-3 text-left font-medium">{l("superadmin_col_projects")}</th>
                <th className="px-4 py-3 text-left font-medium">{l("superadmin_col_registered")}</th>
                <th className="px-4 py-3 text-left font-medium">{l("superadmin_col_last_access")}</th>
                <th className="px-4 py-3 text-left font-medium">{l("superadmin_col_trial")}</th>
                <th className="px-4 py-3 text-left font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const sub = c.subscription;
                const st = companyUiState(c);
                const stLabel =
                  st === "active"
                    ? l("superadmin_state_active")
                    : st === "trial"
                      ? l("superadmin_state_trial")
                      : l("superadmin_state_inactive");
                return (
                  <tr
                    key={c.id}
                    className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 capitalize">
                      {sub?.plan ?? c.plan ?? l("common_dash")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${companyStateBadgeClass(st)}`}
                      >
                        {stLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(sub?.status)}`}
                      >
                        {sub?.status ?? l("common_dash")}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">{c.user_count}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">{c.project_count}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                      {c.created_at ? formatDate(String(c.created_at), saLocale, saTz) : l("common_dash")}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                      {c.last_access_at ? formatDateTime(String(c.last_access_at), saLocale, saTz) : l("common_dash")}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                      {sub?.trial_ends_at ? formatDate(sub.trial_ends_at, saLocale, saTz) : l("common_dash")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void openDetail(c.id)}
                        className="min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium"
                      >
                        {l("superadmin_detail")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {detailId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-6 space-y-4">
            <div className="flex justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {l("superadmin_detail")}
              </h3>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                ×
              </button>
            </div>
            {detailLoading && <p className="text-gray-500 dark:text-gray-400">{l("superadmin_loading")}</p>}
            {!detailLoading && detailData && (
              <>
                <dl className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">{l("superadmin_col_name")}</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">
                      {String(detailData.company?.name ?? "")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">{l("superadmin_plan")}</dt>
                    <dd>{String(detailData.subscription?.plan ?? detailData.company?.plan ?? l("common_dash"))}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">{l("superadmin_status")}</dt>
                    <dd>{String(detailData.subscription?.status ?? l("common_dash"))}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">{l("superadmin_detail_country")}</dt>
                    <dd>{String(detailData.company?.country_code ?? l("common_dash"))}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">{l("superadmin_col_registered")}</dt>
                    <dd>
                      {detailData.company?.created_at
                        ? formatDate(String(detailData.company.created_at), saLocale, saTz)
                        : l("common_dash")}
                    </dd>
                  </div>
                </dl>
                {detailData.metrics ? (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {l("superadmin_metrics_title")}
                    </h4>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      <li>
                        {l("superadmin_metric_employees")}:{" "}
                        <span className="font-medium tabular-nums">{detailData.metrics.employees}</span>
                      </li>
                      <li>
                        {l("superadmin_metric_projects")}:{" "}
                        <span className="font-medium tabular-nums">{detailData.metrics.projects}</span>
                      </li>
                      <li>
                        {l("superadmin_metric_documents")}:{" "}
                        <span className="font-medium tabular-nums">{detailData.metrics.employeeDocuments}</span>
                      </li>
                      <li>
                        {l("superadmin_metric_storage")}:{" "}
                        <span className="font-medium">
                          {detailData.metrics.storage_gb != null
                            ? `${detailData.metrics.storage_gb} GB`
                            : l("common_dash")}
                        </span>
                      </li>
                    </ul>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <button
                    type="button"
                    disabled={!!actionLoading}
                    onClick={() => {
                      setExtendDays(30);
                      setExtendNote("");
                      setExtendTrialOpen(true);
                    }}
                    className="min-h-[44px] rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium text-sm"
                  >
                    {l("superadmin_extend_trial")}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {PAID_PLAN_ORDER.map((pk) => (
                      <button
                        key={pk}
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => void runAction(detailId, "change_plan", pk)}
                        className="min-h-[44px] flex-1 rounded-xl border border-amber-600 text-amber-800 dark:text-amber-300 font-medium text-xs px-2"
                      >
                        {l("superadmin_change_plan")}:{" "}
                        {(t as Record<string, string>)[`pricing_${pk}`] ?? pk}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!!actionLoading}
                    onClick={() => void runAction(detailId, "cancel")}
                    className="min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm"
                  >
                    {l("superadmin_cancel")}
                  </button>
                </div>
                {detailData.audits.filter((a) => String(a.action) === "superadmin_trial_extended").length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {l("superadmin_extend_history")}
                    </h4>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-2 max-h-36 overflow-y-auto">
                      {detailData.audits
                        .filter((a) => String(a.action) === "superadmin_trial_extended")
                        .map((a) => {
                          const rawNv = a.new_value;
                          let nv: Record<string, unknown> | undefined;
                          if (rawNv && typeof rawNv === "object" && !Array.isArray(rawNv)) {
                            nv = rawNv as Record<string, unknown>;
                          } else if (typeof rawNv === "string") {
                            try {
                              const p = JSON.parse(rawNv) as unknown;
                              nv = p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : undefined;
                            } catch {
                              nv = undefined;
                            }
                          }
                          const days =
                            typeof nv?.days_added === "number"
                              ? nv.days_added
                              : typeof nv?.days_added === "string"
                                ? nv.days_added
                                : "";
                          return (
                            <li key={String(a.id)} className="border-b border-gray-100 dark:border-gray-700 pb-1">
                              {a.created_at ? formatDateTime(String(a.created_at), saLocale, saTz) : ""}
                              {days !== "" ? ` · +${days} ${l("superadmin_extend_days_short")}` : ""}
                              {nv?.internal_note ? ` · ${String(nv.internal_note).slice(0, 80)}` : ""}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {l("superadmin_users_tab")}
                  </h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 max-h-32 overflow-y-auto">
                    {detailData.users.map((u) => (
                      <li key={String(u.id)}>
                        {String(u.full_name ?? u.display_name ?? u.id).slice(0, 40)} · {String(u.role ?? "")}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {l("superadmin_audit_tab")}
                  </h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-2 max-h-40 overflow-y-auto">
                    {detailData.audits.map((a) => (
                      <li key={String(a.id)} className="border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className="font-medium">
                          {getAuditActionLabel(
                            String(a.action),
                            typeof a.entity_type === "string" ? a.entity_type : null,
                            { ...PM_EN, ...(t as Record<string, string>) }
                          )}
                        </span>{" "}
                        · {String(a.user_name ?? "")} ·{" "}
                        {a.created_at ? formatDateTime(String(a.created_at), saLocale, saTz) : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {detailId && extendTrialOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setExtendTrialOpen(false)}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
            role="dialog"
            aria-modal
          >
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{l("superadmin_extend_trial")}</h4>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{l("superadmin_extend_days")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([30, 60, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExtendDays(d)}
                  className={`min-h-[40px] flex-1 rounded-lg border px-3 text-sm font-semibold ${
                    extendDays === d
                      ? "border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                      : "border-gray-300 text-gray-800 dark:border-gray-600 dark:text-gray-200"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setExtendDays(90);
                void runAction(detailId, "extend_trial", undefined, {
                  preset: "beta_founder_90",
                  internal_note: extendNote.trim() || null,
                });
              }}
              disabled={!!actionLoading}
              className="mt-3 w-full min-h-[44px] rounded-xl border border-amber-700 bg-amber-50 text-sm font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-950/30 dark:text-amber-100 disabled:opacity-50"
            >
              {l("superadmin_extend_beta_founder")}
            </button>
            <label className="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {l("superadmin_extend_note_label")}
              <textarea
                value={extendNote}
                onChange={(e) => setExtendNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() =>
                  void runAction(detailId, "extend_trial", undefined, {
                    days: extendDays,
                    internal_note: extendNote.trim() || null,
                  })
                }
                className="min-h-[44px] flex-1 rounded-xl bg-amber-600 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {l("superadmin_extend_confirm")}
              </button>
              <button
                type="button"
                onClick={() => setExtendTrialOpen(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-gray-300 text-sm font-medium text-gray-800 dark:border-gray-600 dark:text-gray-200"
              >
                {l("cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
