"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dateLocaleForUser,
  formatTime,
  formatTodayYmdInTimeZone,
  zonedYmdHmToUtcIso,
} from "@/lib/dateUtils";
import { nominatimReverseLabel } from "@/lib/nominatimReverse";
import { TeamGpsMapWidget } from "@/components/TeamGpsMapWidget";

type GpsPoint = {
  id: string;
  lat: number;
  lng: number;
  recorded_at: string;
};

export function EmployeeGpsRouteTab({
  companyId,
  userId,
  employeeName,
  timeZone,
  language,
  countryCode = "CA",
  labels,
}: {
  companyId: string;
  userId: string;
  employeeName: string;
  timeZone: string;
  language: string;
  countryCode?: string;
  labels: Record<string, string>;
}) {
  const Lx = (k: string) => labels[k] ?? "";
  const dateLoc = useMemo(() => dateLocaleForUser(language, countryCode), [language, countryCode]);
  const [routeDate, setRouteDate] = useState(() => formatTodayYmdInTimeZone(timeZone));
  const [points, setPoints] = useState<GpsPoint[]>([]);
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadPoints = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const dayStart = zonedYmdHmToUtcIso(routeDate, "00:00", timeZone);
      const dayEnd = zonedYmdHmToUtcIso(routeDate, "23:59", timeZone);
      const { data, error } = await supabase
        .from("gps_tracking")
        .select("id, lat, lng, recorded_at")
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .gte("recorded_at", dayStart)
        .lte("recorded_at", dayEnd)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as GpsPoint[];
      const next: GpsPoint[] = rows.map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        recorded_at: r.recorded_at,
      }));
      setPoints(next);
      setAddresses({});
    } catch (e) {
      console.error("[EmployeeGpsRouteTab]", e);
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, userId, routeDate, timeZone]);

  useEffect(() => {
    void loadPoints();
  }, [loadPoints]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const acceptLang = dateLoc.replace(/_/g, "-");
      for (const p of points) {
        if (cancelled) return;
        await delay(1100);
        if (cancelled) return;
        try {
          const label = await nominatimReverseLabel(p.lat, p.lng, acceptLang);
          if (!label || cancelled) continue;
          setAddresses((prev) => (prev[p.id] ? prev : { ...prev, [p.id]: label }));
        } catch {
          /* ignore */
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [points, dateLoc]);

  const emptyMsg = Lx("gps_no_route_data") || Lx("gps_route_no_points");

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-4 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 min-w-0">{Lx("gps_route_history")}</h3>
        <label className="flex w-full flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-300 sm:w-auto sm:min-w-[11rem]">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:sr-only">
            {Lx("gps_route_date_label") || Lx("date") || "Date"}
          </span>
          <input
            type="date"
            value={routeDate}
            onChange={(e) => setRouteDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
          />
        </label>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate" title={employeeName}>
        {employeeName}
      </p>
      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{Lx("gpsLocating") || "…"}</p>
      ) : points.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50/80 dark:bg-slate-800/40 px-4 py-6 text-center text-sm text-zinc-600 dark:text-zinc-300">
          {emptyMsg}
        </div>
      ) : null}
      <div className="min-w-0 max-w-full">
        <TeamGpsMapWidget
          companyId={companyId}
          timeZone={timeZone}
          language={language}
          countryCode={countryCode}
          projectNameById={{}}
          labels={labels}
          filterUserId={userId}
          showRoute
          routeDate={routeDate}
        />
      </div>
      {!loading && points.length > 0 ? (
        <ul className="space-y-2 max-h-64 overflow-y-auto text-sm border-t border-zinc-100 dark:border-slate-700 pt-3">
          {points.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-0.5 border-b border-zinc-100 dark:border-slate-800 pb-2 last:border-0 min-w-0"
            >
              <span className="font-mono text-xs text-zinc-500 tabular-nums">
                {formatTime(p.recorded_at, dateLoc, timeZone)}
              </span>
              <span className="text-zinc-800 dark:text-zinc-200 break-words">
                {addresses[p.id] ?? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
