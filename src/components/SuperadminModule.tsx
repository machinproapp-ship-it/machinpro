"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PlanKey } from "@/lib/stripe";

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
  subscription: SubLite;
  user_count: number;
  project_count: number;
};

type Stats = {
  totalCompanies: number;
  totalUsers: number;
  mrrCadApprox: number;
  trialsActive: number;
  conversionsWeek: number;
  planDistribution: Record<string, number>;
};

async function authHeaders(): Promise<HeadersInit> {
  const session = (await supabase?.auth.getSession())?.data.session;
  const token = session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function statusBadgeClass(status: string | undefined): string {
  switch (status) {
    case "trialing":
      return "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200";
    case "active":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "past_due":
      return "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200";
    case "canceled":
    case "cancelled":
      return "bg-zinc-900 text-white dark:bg-zinc-950 dark:text-zinc-100";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export function SuperadminModule({ t }: SuperadminModuleProps) {
  const [companies, setCompanies] = useState<SuperadminCompany[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    company: Record<string, unknown> | null;
    subscription: Record<string, unknown> | null;
    users: Record<string, unknown>[];
    audits: Record<string, unknown>[];
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const h = await authHeaders();
      if (!("Authorization" in h)) {
        setError(t.superadmin_error_auth ?? "Auth required");
        setLoading(false);
        return;
      }
      const [cRes, sRes] = await Promise.all([
        fetch("/api/superadmin/companies", { headers: h }),
        fetch("/api/superadmin/stats", { headers: h }),
      ]);
      const cJson = (await cRes.json()) as { companies?: SuperadminCompany[]; error?: string };
      const sJson = (await sRes.json()) as Stats & { error?: string };
      if (!cRes.ok) setError(cJson.error ?? "Error");
      else setCompanies(cJson.companies ?? []);
      if (sRes.ok) setStats(sJson);
    } catch {
      setError(t.superadmin_error_load ?? "Error");
    } finally {
      setLoading(false);
    }
  }, [t.superadmin_error_auth, t.superadmin_error_load]);

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
    async (companyId: string, action: "extend_trial" | "change_plan" | "cancel", planKey?: PlanKey) => {
      setActionLoading(`${companyId}-${action}`);
      try {
        const h = await authHeaders();
        const res = await fetch("/api/superadmin/company", {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, action, planKey }),
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          setError(j.error ?? "Error");
          return;
        }
        await load();
        if (detailId === companyId) void openDetail(companyId);
      } finally {
        setActionLoading(null);
      }
    },
    [detailId, load, openDetail]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (q && !c.name?.toLowerCase().includes(q)) return false;
      const sub = c.subscription;
      const plan = (sub?.plan ?? c.plan ?? "").toLowerCase();
      if (filterPlan !== "all") {
        const want = filterPlan.toLowerCase();
        if (want === "trial" && sub?.status !== "trialing") return false;
        if (want !== "trial" && !plan.includes(want) && !(want === "pro" && plan.includes("professional")))
          return false;
      }
      if (filterStatus !== "all" && (sub?.status ?? "none") !== filterStatus) return false;
      if (dateFrom && c.created_at) {
        if (new Date(c.created_at) < new Date(dateFrom)) return false;
      }
      return true;
    });
  }, [companies, search, filterPlan, filterStatus, dateFrom]);

  const exportCsv = useCallback(() => {
    const headers = ["id", "name", "plan", "status", "users", "projects", "trial_end", "next_charge", "created"];
    const lines = [headers.join(",")];
    for (const c of filtered) {
      const sub = c.subscription;
      lines.push(
        [
          c.id,
          JSON.stringify(c.name ?? ""),
          sub?.plan ?? c.plan ?? "",
          sub?.status ?? "",
          c.user_count,
          c.project_count,
          sub?.trial_ends_at ?? "",
          sub?.current_period_end ?? "",
          c.created_at ?? "",
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
          {t.superadmin_title ?? "Superadmin"}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t.superadmin_companies ?? "Companies"}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {[
            { label: t.superadmin_companies ?? "Companies", value: stats.totalCompanies },
            { label: t.superadmin_users_total ?? "Users", value: stats.totalUsers },
            { label: t.superadmin_mrr ?? "MRR (CAD)", value: `≈${stats.mrrCadApprox}` },
            { label: t.superadmin_trials ?? "Trials", value: stats.trialsActive },
            { label: t.superadmin_conversions ?? "Conv. 7d", value: stats.conversionsWeek },
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

      {stats && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t.superadmin_chart_plans ?? "Companies by plan"}
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

      <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {t.superadmin_search ?? "Search"}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 min-h-[44px] text-sm min-w-[200px]"
            />
          </label>
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {t.superadmin_filter_plan ?? "Plan"}
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 min-h-[44px] text-sm"
            >
              <option value="all">—</option>
              <option value="trial">trial</option>
              <option value="starter">starter</option>
              <option value="pro">pro</option>
              <option value="enterprise">enterprise</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {t.superadmin_filter_status ?? "Status"}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 min-h-[44px] text-sm"
            >
              <option value="all">—</option>
              <option value="trialing">trialing</option>
              <option value="active">active</option>
              <option value="past_due">past_due</option>
              <option value="canceled">canceled</option>
              <option value="none">none</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {t.superadmin_filter_date ?? "Created from"}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 min-h-[44px] text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => exportCsv()}
          className="min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {t.superadmin_export_csv ?? "Export CSV"}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="p-8 text-center text-gray-500 dark:text-gray-400">{t.superadmin_loading ?? "…"}</p>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-gray-900/80 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t.superadmin_col_name ?? "Name"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.superadmin_plan ?? "Plan"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.superadmin_status ?? "Status"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.superadmin_col_users ?? "Users"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.superadmin_col_projects ?? "Projects"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.superadmin_col_storage ?? "Storage"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.superadmin_col_trial ?? "Trial"}</th>
                <th className="px-4 py-3 text-left font-medium">{t.superadmin_col_next ?? "Next"}</th>
                <th className="px-4 py-3 text-left font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const sub = c.subscription;
                return (
                  <tr
                    key={c.id}
                    className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 capitalize">
                      {sub?.plan ?? c.plan ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(sub?.status)}`}
                      >
                        {sub?.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">{c.user_count}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">{c.project_count}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {c.storage_used_gb != null ? `${c.storage_used_gb} GB` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                      {sub?.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                      {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void openDetail(c.id)}
                        className="min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium"
                      >
                        {t.superadmin_detail ?? "Detail"}
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
          <div className="w-full sm:max-w-lg max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-6 space-y-4">
            <div className="flex justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t.superadmin_detail ?? "Detail"}
              </h3>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                ×
              </button>
            </div>
            {detailLoading && <p className="text-gray-500 dark:text-gray-400">{t.superadmin_loading ?? "…"}</p>}
            {!detailLoading && detailData && (
              <>
                <dl className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">{t.superadmin_col_name ?? ""}</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">
                      {String(detailData.company?.name ?? "")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">{t.superadmin_plan ?? ""}</dt>
                    <dd>{String(detailData.subscription?.plan ?? detailData.company?.plan ?? "—")}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">{t.superadmin_status ?? ""}</dt>
                    <dd>{String(detailData.subscription?.status ?? "—")}</dd>
                  </div>
                </dl>
                <div className="flex flex-col gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <button
                    type="button"
                    disabled={!!actionLoading}
                    onClick={() => void runAction(detailId, "extend_trial")}
                    className="min-h-[44px] rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium text-sm"
                  >
                    {t.superadmin_extend_trial ?? "Extend trial"}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {(["starter", "pro", "enterprise"] as const).map((pk) => (
                      <button
                        key={pk}
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => void runAction(detailId, "change_plan", pk)}
                        className="min-h-[44px] flex-1 rounded-xl border border-amber-600 text-amber-800 dark:text-amber-300 font-medium text-xs px-2"
                      >
                        {(t.superadmin_change_plan ?? "Plan") + `: ${pk}`}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!!actionLoading}
                    onClick={() => void runAction(detailId, "cancel")}
                    className="min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm"
                  >
                    {t.superadmin_cancel ?? "Cancel subscription"}
                  </button>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t.superadmin_users_tab ?? "Users"}
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
                    {t.superadmin_audit_tab ?? "Audit"}
                  </h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-2 max-h-40 overflow-y-auto">
                    {detailData.audits.map((a) => (
                      <li key={String(a.id)} className="border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className="font-medium">{String(a.action)}</span> · {String(a.user_name ?? "")} ·{" "}
                        {a.created_at ? new Date(String(a.created_at)).toLocaleString() : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
