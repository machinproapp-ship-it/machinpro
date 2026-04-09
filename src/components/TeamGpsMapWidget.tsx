"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  dateLocaleForUser,
  formatDateTime,
  formatTime,
  formatTodayYmdInTimeZone,
  zonedYmdHmToUtcIso,
} from "@/lib/dateUtils";

function ensureLeafletDefaultIcons(): void {
  const proto = L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown };
  delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

type ActiveEntry = {
  id: string;
  user_id: string;
  project_id: string | null;
  clock_in_at: string;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
};

type MarkerModel = {
  entryId: string;
  userId: string;
  name: string;
  projectLabel: string;
  clockInAt: string;
  lat: number;
  lng: number;
  lastRecordedAt: string;
};

const REFRESH_MS = 120_000;
const LIGHT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export function TeamGpsMapWidget({
  companyId,
  timeZone,
  language,
  countryCode = "CA",
  projectNameById,
  labels,
}: {
  companyId: string;
  timeZone: string;
  language: string;
  countryCode?: string;
  projectNameById: Record<string, string>;
  labels: Record<string, string>;
}) {
  const Lx = (k: string) => labels[k] ?? "";
  const dateLoc = useMemo(() => dateLocaleForUser(language, countryCode), [language, countryCode]);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const [markers, setMarkers] = useState<MarkerModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [darkTiles, setDarkTiles] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDarkTiles(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const load = useCallback(async () => {
    if (!supabase || !companyId) {
      setMarkers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const todayYmd = formatTodayYmdInTimeZone(timeZone);
      const dayStart = zonedYmdHmToUtcIso(todayYmd, "00:00", timeZone);
      const dayEnd = zonedYmdHmToUtcIso(todayYmd, "23:59", timeZone);

      const { data: entries, error: entErr } = await supabase
        .from("time_entries")
        .select("id, user_id, project_id, clock_in_at, clock_in_lat, clock_in_lng")
        .eq("company_id", companyId)
        .is("clock_out_at", null)
        .gte("clock_in_at", dayStart)
        .lte("clock_in_at", dayEnd);

      if (entErr) throw entErr;
      const list = (entries ?? []) as ActiveEntry[];
      if (list.length === 0) {
        setMarkers([]);
        return;
      }

      const userIds = [...new Set(list.map((e) => e.user_id))];
      const { data: profs, error: pErr } = await supabase
        .from("user_profiles")
        .select("id, full_name, display_name, email")
        .in("id", userIds);
      if (pErr) throw pErr;

      const nameByUser: Record<string, string> = {};
      for (const p of profs ?? []) {
        const row = p as {
          id: string;
          full_name?: string | null;
          display_name?: string | null;
          email?: string | null;
        };
        const fn = (row.full_name ?? "").trim();
        const dn = (row.display_name ?? "").trim();
        const em = (row.email ?? "").trim();
        nameByUser[row.id] = fn || dn || em.split("@")[0] || row.id.slice(0, 8);
      }

      const entryIds = list.map((e) => e.id);
      const { data: gpsRows, error: gErr } = await supabase
        .from("gps_tracking")
        .select("entry_id, lat, lng, recorded_at")
        .in("entry_id", entryIds)
        .order("recorded_at", { ascending: false });
      if (gErr) throw gErr;

      const latestByEntry = new Map<string, { lat: number; lng: number; recorded_at: string }>();
      for (const r of gpsRows ?? []) {
        const row = r as { entry_id: string; lat: number; lng: number; recorded_at: string };
        if (!latestByEntry.has(row.entry_id)) {
          latestByEntry.set(row.entry_id, {
            lat: row.lat,
            lng: row.lng,
            recorded_at: row.recorded_at,
          });
        }
      }

      const next: MarkerModel[] = [];
      for (const e of list) {
        const gps = latestByEntry.get(e.id);
        const lat = gps?.lat ?? e.clock_in_lat ?? null;
        const lng = gps?.lng ?? e.clock_in_lng ?? null;
        if (lat == null || lng == null) continue;
        const pid = e.project_id != null ? String(e.project_id) : "";
        const projectLabel = pid ? projectNameById[pid] ?? pid : "—";
        next.push({
          entryId: e.id,
          userId: e.user_id,
          name: nameByUser[e.user_id] ?? e.user_id.slice(0, 8),
          projectLabel,
          clockInAt: e.clock_in_at,
          lat,
          lng,
          lastRecordedAt: gps?.recorded_at ?? e.clock_in_at,
        });
      }
      setMarkers(next);
    } catch (err) {
      console.error("[TeamGpsMapWidget]", err);
      setMarkers([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, timeZone, projectNameById]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const lightTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const darkTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensureLeafletDefaultIcons();
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([20, 0], 2);
    mapRef.current = map;
    const layerGroup = L.layerGroup().addTo(map);
    layerRef.current = layerGroup;

    tileRef.current = L.tileLayer(darkTiles ? DARK_TILE_URL : LIGHT_TILE_URL, {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    const onResize = () => {
      map.invalidateSize();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      tileRef.current?.remove();
      tileRef.current = null;
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(darkTiles ? DARK_TILE_URL : LIGHT_TILE_URL, {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
  }, [darkTiles]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;
    const projectLbl = labels.project ?? "Project";
    const clockInLbl = labels.clockInEntry ?? "In";
    const lastPosLbl = labels.gps_last_position ?? "";
    group.clearLayers();
    for (const m of markers) {
      const mk = L.marker([m.lat, m.lng]);
      const lastPos = formatDateTime(m.lastRecordedAt, dateLoc, timeZone);
      const clockIn = formatTime(m.clockInAt, dateLoc, timeZone);
      mk.bindPopup(
        `<div class="text-sm space-y-1 min-w-[200px]">
          <div class="font-semibold">${escapeHtml(m.name)}</div>
          <div><span class="opacity-70">${escapeHtml(projectLbl)}:</span> ${escapeHtml(m.projectLabel)}</div>
          <div><span class="opacity-70">${escapeHtml(clockInLbl)}:</span> ${escapeHtml(clockIn)}</div>
          <div><span class="opacity-70">${escapeHtml(lastPosLbl)}:</span> ${escapeHtml(lastPos)}</div>
        </div>`
      );
      mk.addTo(group);
    }
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as L.LatLngExpression));
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
    }
    requestAnimationFrame(() => map.invalidateSize());
  }, [markers, dateLoc, timeZone, labels.project, labels.clockInEntry, labels.gps_last_position]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 h-[300px] md:h-[450px] z-0"
        aria-label={Lx("gps_map_title")}
      />
      {loading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{Lx("gpsLocating") || "…"}</p>
      ) : markers.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          {Lx("gps_no_active")}
        </p>
      ) : null}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
