"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, ClipboardList, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Hazard } from "@/types/hazard";

type Props = {
  companyId: string | null;
  labels: Record<string, string>;
  dateLocale: string;
  timeZone: string;
  /** Days ahead for cert warning */
  certExpirySoonDays?: number;
};

export function SecurityOverviewPanel({
  companyId,
  labels,
  dateLocale: _dateLocale,
  timeZone: _timeZone,
  certExpirySoonDays = 30,
}: Props) {
  const L = (k: string, fb: string) => labels[k] ?? fb;
  const [loading, setLoading] = useState(true);
  const [activeHazards, setActiveHazards] = useState(0);
  const [resolvedHazards, setResolvedHazards] = useState(0);
  const [pendingCa, setPendingCa] = useState(0);
  const [recentHazards, setRecentHazards] = useState<Hazard[]>([]);
  const [swpPendingApprox, setSwpPendingApprox] = useState(0);
  const [certsSoon, setCertsSoon] = useState(0);

  const load = useCallback(async () => {
    if (!supabase || !companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: hz } = await supabase.from("hazards").select("*").eq("company_id", companyId);
      const rows = (hz ?? []) as Hazard[];
      const recentSorted = [...rows].sort((a, b) =>
        String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
      );
      const active = rows.filter((h) => h.status === "open" || h.status === "in_progress").length;
      const resolved = rows.filter((h) => h.status === "resolved" || h.status === "closed").length;
      setActiveHazards(active);
      setResolvedHazards(resolved);
      setRecentHazards(recentSorted.slice(0, 5));

      const { data: ca } = await supabase
        .from("corrective_actions")
        .select("id, status")
        .eq("company_id", companyId);
      const caRows = ca ?? [];
      const pend = caRows.filter(
        (r: { status?: string }) => r.status !== "closed" && r.status !== "verified"
      ).length;
      setPendingCa(pend);

      const { data: swp } = await supabase.from("safe_work_procedures").select("id").eq("company_id", companyId);
      const { data: sig } = await supabase.from("swp_signatures").select("swp_id, user_id").eq("company_id", companyId);
      const swpIds = new Set((swp ?? []).map((s: { id: string }) => s.id));
      let missing = 0;
      for (const id of swpIds) {
        const n = (sig ?? []).filter((s: { swp_id: string }) => s.swp_id === id).length;
        if (n === 0) missing += 1;
      }
      setSwpPendingApprox(missing);

      const today = new Date();
      const soon = new Date(today.getTime() + certExpirySoonDays * 86400000).toISOString().slice(0, 10);
      const { count } = await supabase
        .from("employee_documents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .not("expiry_date", "is", null)
        .lte("expiry_date", soon)
        .gte("expiry_date", today.toISOString().slice(0, 10));
      setCertsSoon(typeof count === "number" ? count : 0);
    } finally {
      setLoading(false);
    }
  }, [companyId, certExpirySoonDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = activeHazards + resolvedHazards;
  const safetyIndex = total > 0 ? Math.round((resolvedHazards / total) * 100) : 100;
  const ringColor =
    safetyIndex >= 70 ? "stroke-emerald-500" : safetyIndex >= 40 ? "stroke-amber-500" : "stroke-red-500";

  if (!companyId) {
    return <p className="text-sm text-zinc-500">{L("security_overview_no_company", "—")}</p>;
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" aria-hidden />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div
              className={`rounded-xl border p-4 ${activeHazards > 0 ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30" : "border-zinc-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}
            >
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{L("security_metric_active_hazards", "Active hazards")}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{activeHazards}</p>
            </div>
            <div
              className={`rounded-xl border p-4 ${pendingCa > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "border-zinc-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}
            >
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{L("security_metric_pending_ca", "Pending corrective actions")}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{pendingCa}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{L("security_metric_swp_pending", "SWPs missing signatures (approx.)")}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{swpPendingApprox}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{L("security_metric_certs_soon", "Certificates expiring (30d)")}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{certsSoon}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative h-28 w-28 shrink-0">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9155" fill="none" className="stroke-zinc-200 dark:stroke-slate-600" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="none"
                  className={ringColor}
                  strokeWidth="3"
                  strokeDasharray={`${safetyIndex}, 100`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold text-zinc-900 dark:text-white">{safetyIndex}%</span>
                <span className="text-[10px] leading-tight text-zinc-500">{L("security_index_label", "Safety index")}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
                {L("security_recent_hazards", "Recent hazards")}
              </h3>
              <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {recentHazards.length === 0 ? (
                  <li className="text-zinc-500">{L("dashboard_trend_neutral", "—")}</li>
                ) : (
                  recentHazards.map((h) => (
                    <li key={h.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                      <span className="font-medium">{h.title}</span>
                      <span className="text-xs text-zinc-500"> · {h.severity} · {h.status}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
              <ClipboardList className="h-4 w-4" aria-hidden />
              {L("security_swp_pending_section", "SWP signature gaps")}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{L("security_swp_pending_hint", "Approximation based on procedures without recorded signatures.")}</p>
          </div>
        </>
      )}
    </div>
  );
}
