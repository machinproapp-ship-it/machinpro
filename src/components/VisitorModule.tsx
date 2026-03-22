"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, QrCode, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { buildVisitorCheckInUrl } from "@/lib/visitorQrUrl";
import type { Visitor, VisitorStatus } from "@/types/visitor";

export interface VisitorModuleProps {
  t: Record<string, string>;
  companyId: string | null;
  companyName?: string | null;
  projects: { id: string; name: string }[];
}

function dayInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayBoundsUtc(dateStr: string): { start: string; end: string } {
  const start = `${dateStr}T00:00:00.000`;
  const end = `${dateStr}T23:59:59.999`;
  return { start, end };
}

export function VisitorModule({ t, companyId, companyName, projects }: VisitorModuleProps) {
  const [filterDate, setFilterDate] = useState(() => dayInputValue(new Date()));
  const [filterProjectId, setFilterProjectId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | VisitorStatus>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const load = useCallback(async () => {
    if (!supabase || !companyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { start, end } = dayBoundsUtc(filterDate);
    let q = supabase
      .from("visitor_logs")
      .select("*")
      .eq("company_id", companyId)
      .gte("check_in", start)
      .lte("check_in", end)
      .order("check_in", { ascending: false });

    if (filterProjectId !== "all") {
      q = q.eq("project_id", filterProjectId);
    }
    if (filterStatus !== "all") {
      q = q.eq("status", filterStatus);
    }

    const { data, error } = await q;
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data ?? []) as Visitor[]);
    }
    setLoading(false);
  }, [companyId, filterDate, filterProjectId, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!supabase || !companyId) return;
    const client = supabase;
    const channel = client
      .channel(`visitor_logs_${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "visitor_logs",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [supabase, companyId, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.visitor_name ?? "").toLowerCase().includes(q) ||
        (r.visitor_company ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const activeNow = useMemo(
    () => rows.filter((r) => r.status === "checked_in").length,
    [rows]
  );

  const checkInUrl = companyId ? buildVisitorCheckInUrl(companyId) : "";

  const manualCheckout = async (id: string) => {
    if (!supabase || !companyId) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("visitor_logs")
      .update({ check_out: now, status: "checked_out" })
      .eq("id", id)
      .eq("company_id", companyId);
    if (!error) void load();
  };

  const exportCsv = () => {
    const headers = [
      t.visitors_name ?? "name",
      t.visitors_company ?? "company",
      t.visitors_purpose ?? "purpose",
      t.visitors_host ?? "host",
      t.visitors_checkin ?? "check_in",
      t.visitors_checkout ?? "check_out",
      t.visitors_table_status ?? "status",
    ];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      const esc = (s: string | null | undefined) =>
        `"${(s ?? "").replace(/"/g, '""')}"`;
      lines.push(
        [
          esc(r.visitor_name),
          esc(r.visitor_company),
          esc(r.purpose),
          esc(r.host_name),
          esc(r.check_in),
          esc(r.check_out),
          esc(r.status),
        ].join(",")
      );
    }
    const blob = new Blob(["\ufeff", lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `visitors-${filterDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadQrPng = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `machinpro-visit-qr-${companyId?.slice(0, 8) ?? "qr"}.png`;
    a.click();
  };

  if (!companyId) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-600 dark:text-zinc-400">
        {t.visitors_no_company ?? t.billing_no_company ?? "—"}
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-600 dark:text-zinc-400">
        {t.visitors_error ?? "—"}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            {t.visitors_title ?? "Visitors"}
          </h2>
          {companyName ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{companyName}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <QrCode className="h-4 w-4 shrink-0" />
            {t.visitors_generate_qr ?? "QR"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Download className="h-4 w-4 shrink-0" />
            {t.visitors_export_csv ?? "CSV"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">
        {t.visitors_active_now ?? "Active"}: <span className="tabular-nums">{activeNow}</span>
      </div>

      <div className="flex flex-col lg:flex-row flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm min-w-[140px]">
          <span className="text-zinc-600 dark:text-zinc-400">{t.visitors_filter_date ?? "Date"}</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2.5 min-h-[44px] text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[160px] flex-1">
          <span className="text-zinc-600 dark:text-zinc-400">
            {t.visitors_filter_project ?? "Project"}
          </span>
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{t.visitors_filter_all ?? "All"}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[140px]">
          <span className="text-zinc-600 dark:text-zinc-400">
            {t.visitors_filter_status ?? "Status"}
          </span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "all" | VisitorStatus)}
            className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2.5 min-h-[44px] text-sm"
          >
            <option value="all">{t.visitors_filter_all ?? "All"}</option>
            <option value="checked_in">{t.visitors_status_in ?? "In"}</option>
            <option value="checked_out">{t.visitors_status_out ?? "Out"}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-[200px]">
          <span className="text-zinc-600 dark:text-zinc-400">{t.visitors_search ?? "Search"}</span>
          <span className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 pl-10 pr-3 py-2.5 min-h-[44px] text-sm"
            />
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">{t.visitors_loading ?? "…"}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">{t.visitors_no_results ?? "—"}</div>
        ) : (
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300">
              <tr>
                <th className="px-4 py-3 font-medium">{t.visitors_name ?? "Name"}</th>
                <th className="px-4 py-3 font-medium">{t.visitors_company ?? "Company"}</th>
                <th className="px-4 py-3 font-medium">{t.visitors_purpose ?? "Purpose"}</th>
                <th className="px-4 py-3 font-medium">{t.visitors_host ?? "Host"}</th>
                <th className="px-4 py-3 font-medium">{t.visitors_checkin ?? "In"}</th>
                <th className="px-4 py-3 font-medium">{t.visitors_checkout ?? "Out"}</th>
                <th className="px-4 py-3 font-medium">{t.visitors_table_status ?? "Status"}</th>
                <th className="px-4 py-3 font-medium w-40" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                    {r.visitor_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {r.visitor_company ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 max-w-[180px] truncate">
                    {r.purpose ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{r.host_name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                    {new Date(r.check_in).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                    {r.check_out ? new Date(r.check_out).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.status === "checked_in"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                      }`}
                    >
                      {r.status === "checked_in"
                        ? (t.visitors_status_in ?? "In")
                        : (t.visitors_status_out ?? "Out")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "checked_in" ? (
                      <button
                        type="button"
                        onClick={() => void manualCheckout(r.id)}
                        className="min-h-[44px] px-3 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs font-medium hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      >
                        {t.visitors_checkout_manual ?? "Checkout"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {qrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {t.visitors_qr_modal_title ?? "QR"}
            </h3>
            <div className="flex justify-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-zinc-100 dark:border-zinc-700">
              <QRCodeCanvas
                ref={qrCanvasRef}
                value={checkInUrl}
                size={220}
                level="M"
                marginSize={2}
                className="max-w-full h-auto"
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 break-all text-center">{checkInUrl}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={downloadQrPng}
                className="flex-1 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm py-3"
              >
                {t.visitors_download_qr_png ?? "PNG"}
              </button>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 font-medium text-sm py-3 text-zinc-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {t.visitors_close ?? "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
