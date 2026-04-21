"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Clock, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatTime, resolveUserTimezone } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";
import {
  elapsedMinutesSinceClockStart,
  formatWorkDurationCompact,
  trafficLightClassFromElapsedHours,
} from "@/lib/clockDisplay";

export const GPS_INTERVAL_MS = 300_000;

type TimeEntryRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  status: string;
};

export function ProjectTimeclockSection({
  companyId,
  projectId,
  userProfileId,
  labels: t,
  assignedEmployeeNames,
  /** Maps Supabase `user_profiles.id` → display name (for attendance rows). */
  profileNamesByAuthId,
  canClock,
  canViewAttendance,
  dateLocale = typeof navigator !== "undefined" ? navigator.language : "en-US",
  timeZone: timeZoneProp,
  locationSharingEnabled = true,
}: {
  companyId: string | null | undefined;
  projectId: string;
  userProfileId: string | null | undefined;
  labels: Record<string, string>;
  assignedEmployeeNames: { id: string; name: string }[];
  profileNamesByAuthId?: Record<string, string>;
  canClock: boolean;
  canViewAttendance: boolean;
  dateLocale?: string;
  timeZone?: string;
  /** When false, no periodic GPS samples for this project shift. */
  locationSharingEnabled?: boolean;
}) {
  void useMachinProDisplayPrefs();
  const timeZone = timeZoneProp ?? resolveUserTimezone(null);
  const [active, setActive] = useState<TimeEntryRow | null>(null);
  const [todayList, setTodayList] = useState<TimeEntryRow[]>([]);
  const [tick, setTick] = useState(0);
  const gpsTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMine = useCallback(async () => {
    if (!supabase || !companyId || !userProfileId) return;
    const { data } = await supabase
      .from("time_entries")
      .select("*")
      .eq("company_id", companyId)
      .eq("user_id", userProfileId)
      .eq("project_id", projectId)
      .eq("status", "active")
      .maybeSingle();
    setActive((data as TimeEntryRow) ?? null);
  }, [companyId, userProfileId, projectId]);

  const loadToday = useCallback(async () => {
    if (!supabase || !companyId) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("time_entries")
      .select("*")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .gte("clock_in_at", start.toISOString());
    setTodayList((data as TimeEntryRow[]) ?? []);
  }, [companyId, projectId]);

  useEffect(() => {
    void loadMine();
    void loadToday();
  }, [loadMine, loadToday]);

  useEffect(() => {
    if (!supabase || !companyId) return;
    const channel = supabase
      .channel(`time_entries_${projectId}_${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_entries",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          void loadMine();
          void loadToday();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, projectId, loadMine, loadToday]);

  const stopGps = () => {
    if (gpsTimer.current) {
      clearInterval(gpsTimer.current);
      gpsTimer.current = null;
    }
  };

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!locationSharingEnabled) stopGps();
  }, [locationSharingEnabled]);

  const pushGps = async (entryId: string) => {
    if (!supabase || !companyId || !userProfileId) return;
    const client = supabase;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const acc = pos.coords.accuracy;
        await client.from("gps_tracking").insert({
          entry_id: entryId,
          user_id: userProfileId,
          company_id: companyId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ...(Number.isFinite(acc) ? { accuracy: acc } : {}),
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  };

  const startShift = async () => {
    if (!supabase || !companyId || !userProfileId || !canClock) return;
    const client = supabase;
    const done = async (lat?: number, lng?: number) => {
      const { data, error } = await client
        .from("time_entries")
        .insert({
          company_id: companyId,
          user_id: userProfileId,
          project_id: projectId,
          clock_in_lat: lat,
          clock_in_lng: lng,
          status: "active",
        })
        .select("*")
        .single();
      if (!error && data) {
        const row = data as TimeEntryRow;
        setActive(row);
        stopGps();
        if (locationSharingEnabled) {
          void pushGps(row.id);
          gpsTimer.current = setInterval(() => void pushGps(row.id), GPS_INTERVAL_MS);
        }
        void loadToday();
      }
    };
    navigator.geolocation.getCurrentPosition(
      (pos) => void done(pos.coords.latitude, pos.coords.longitude),
      () => void done(),
      { enableHighAccuracy: true, timeout: 12_000 }
    );
  };

  const endShift = async () => {
    if (!supabase || !active || !userProfileId) return;
    const client = supabase;
    stopGps();
    const end = new Date().toISOString();
    const mins = Math.max(
      0,
      Math.round((Date.now() - new Date(active.clock_in_at).getTime()) / 60_000)
    );
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await client
          .from("time_entries")
          .update({
            clock_out_at: end,
            clock_out_lat: pos.coords.latitude,
            clock_out_lng: pos.coords.longitude,
            total_minutes: mins,
            status: "completed",
          })
          .eq("id", active.id);
        setActive(null);
        void loadToday();
      },
      async () => {
        await client
          .from("time_entries")
          .update({
            clock_out_at: end,
            total_minutes: mins,
            status: "completed",
          })
          .eq("id", active.id);
        setActive(null);
        void loadToday();
      }
    );
  };

  const elapsedLabel = useMemo(() => {
    if (!active) return "";
    const tl = t as Record<string, string>;
    const mins = elapsedMinutesSinceClockStart({
      dateYmd: "2000-01-01",
      clockInHm: "00:00",
      clockInAtIso: active.clock_in_at,
    });
    return formatWorkDurationCompact(mins, tl);
  }, [active, tick, t]);

  const elapsedTone = useMemo(() => {
    if (!active) return "";
    const mins = elapsedMinutesSinceClockStart({
      dateYmd: "2000-01-01",
      clockInHm: "00:00",
      clockInAtIso: active.clock_in_at,
    });
    return trafficLightClassFromElapsedHours(mins / 60);
  }, [active, tick]);

  const nameForRow = useCallback(
    (userId: string) => {
      const map = profileNamesByAuthId ?? {};
      const n =
        map[userId] ??
        map[userId.toLowerCase()] ??
        assignedEmployeeNames.find((x) => x.id === userId)?.name;
      return n ?? `${userId.slice(0, 8)}…`;
    },
    [profileNamesByAuthId, assignedEmployeeNames]
  );

  return (
    <div className="space-y-4">
      {canClock && userProfileId && companyId && (
        <div className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {(t as Record<string, string>).timeclock_my_shift_today ?? "My shift today"}
          </h3>
          {!active ? (
            <button
              type="button"
              onClick={() => void startShift()}
              className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2"
            >
              <Play className="h-5 w-5" />
              {(t as Record<string, string>).timeclock_start_shift ?? "Start shift"}
            </button>
          ) : (
            <div className="space-y-3">
              <p className={`text-sm ${elapsedTone || "text-zinc-600 dark:text-zinc-300"}`}>
                {(t as Record<string, string>).timeclock_shift_active ?? "Shift active"} · {elapsedLabel}
              </p>
              <button
                type="button"
                onClick={() => void endShift()}
                className="w-full min-h-[48px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center justify-center gap-2"
              >
                <Square className="h-5 w-5" />
                {(t as Record<string, string>).timeclock_end_shift ?? "End shift"}
              </button>
            </div>
          )}
        </div>
      )}

      {canViewAttendance && (
        <div className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2 mb-3">
            <Users className="h-4 w-4" />
            {(t as Record<string, string>).timeclock_attendance_today ?? "Attendance today"}
          </h3>
          {todayList.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {todayList.map((row) => {
                const tl = t as Record<string, string>;
                const inDay = new Date(row.clock_in_at);
                const ymd = `${inDay.getFullYear()}-${String(inDay.getMonth() + 1).padStart(2, "0")}-${String(inDay.getDate()).padStart(2, "0")}`;
                const hm = `${String(inDay.getHours()).padStart(2, "0")}:${String(inDay.getMinutes()).padStart(2, "0")}`;
                const activeRow = !row.clock_out_at;
                const elapsedMins = activeRow
                  ? elapsedMinutesSinceClockStart({
                      dateYmd: ymd,
                      clockInHm: hm,
                      clockInAtIso: row.clock_in_at,
                    })
                  : Math.max(
                      0,
                      Math.round(
                        (new Date(row.clock_out_at!).getTime() - new Date(row.clock_in_at).getTime()) /
                          60_000
                      )
                    );
                const durCompact = formatWorkDurationCompact(elapsedMins, tl);
                const tone = trafficLightClassFromElapsedHours(activeRow ? elapsedMins / 60 : elapsedMins / 60);
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-slate-800 pb-2"
                  >
                    <span className="min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-100">
                      {nameForRow(row.user_id)}{" "}
                      <span className={`tabular-nums text-xs font-semibold ${tone}`}>({durCompact})</span>
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatTime(row.clock_in_at, dateLocale, timeZone)}
                      {" — "}
                      {row.clock_out_at
                        ? formatTime(row.clock_out_at, dateLocale, timeZone)
                        : tl.timeclock_shift_active ?? "Active"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="space-y-2 text-sm">
              {assignedEmployeeNames.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-slate-800 pb-2"
                >
                  <span>{e.name}</span>
                  <span className="text-xs rounded-full px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                    {(t as Record<string, string>).timeclock_not_clocked_in ?? "Not clocked in"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
