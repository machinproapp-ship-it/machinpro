"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Car, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  dateLocaleForUser,
  formatDateTime,
  formatTodayYmdInTimeZone,
  zonedYmdHmToUtcIso,
} from "@/lib/dateUtils";

type TimeEntryRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
};

type GpsRow = {
  entry_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
};

type MarkerModel = {
  entryId: string;
  userId: string;
  name: string;
  projectLabel: string;
  lat: number;
  lng: number;
  lastRecordedAt: string;
  vehiclePlate?: string | null;
  hasVehicle?: boolean;
};

type RouteLine = {
  userId: string;
  points: L.LatLngExpression[];
  color: string;
};

const REFRESH_MS = 120_000;
const LIGHT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ROUTE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#d97706", "#0f766e"];

function ensureLeafletDefaultIcons(): void {
  const proto = L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown };
  delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export function TeamGpsMapWidget({
  companyId,
  timeZone,
  language,
  countryCode = "CA",
  projectNameById,
  labels,
  filterProjectId = null,
  filterUserId,
  vehiclePlateByUserId,
  showRoute = false,
  routeDate,
}: {
  companyId: string;
  timeZone: string;
  language: string;
  countryCode?: string;
  projectNameById: Record<string, string>;
  labels: Record<string, string>;
  filterProjectId?: string | null;
  filterUserId?: string;
  vehiclePlateByUserId?: Record<string, string>;
  showRoute?: boolean;
  routeDate?: string;
}) {
  const Lx = (k: string) => labels[k] ?? "";
  const dateLoc = useMemo(() => dateLocaleForUser(language, countryCode), [language, countryCode]);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const [markers, setMarkers] = useState<MarkerModel[]>([]);
  const [routes, setRoutes] = useState<RouteLine[]>([]);
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
      setRoutes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ymd = routeDate?.trim() || formatTodayYmdInTimeZone(timeZone);
      const dayStart = zonedYmdHmToUtcIso(ymd, "00:00", timeZone);
      const dayEnd = zonedYmdHmToUtcIso(ymd, "23:59", timeZone);

      let q = supabase
        .from("time_entries")
        .select("id, user_id, project_id, clock_in_at, clock_out_at, clock_in_lat, clock_in_lng")
        .eq("company_id", companyId)
        .gte("clock_in_at", dayStart)
        .lte("clock_in_at", dayEnd);
      if (!showRoute) q = q.is("clock_out_at", null);
      if (filterProjectId?.trim()) q = q.eq("project_id", filterProjectId.trim());
      if (filterUserId?.trim()) q = q.eq("user_id", filterUserId.trim());

      const { data: entries, error: entErr } = await q;
      if (entErr) throw entErr;
      const list = (entries ?? []) as TimeEntryRow[];
      if (list.length === 0) {
        setMarkers([]);
        setRoutes([]);
        return;
      }

      const userIds = [...new Set(list.map((e) => e.user_id))];
      const { data: profs } = await supabase
        .from("user_profiles")
        .select("id, full_name, display_name, email")
        .in("id", userIds);

      const nameByUser: Record<string, string> = {};
      for (const p of profs ?? []) {
        const row = p as { id: string; full_name?: string | null; display_name?: string | null; email?: string | null };
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
        .order("recorded_at", { ascending: true });
      if (gErr) throw gErr;

      const pointsByEntry = new Map<string, GpsRow[]>();
      for (const r of (gpsRows ?? []) as GpsRow[]) {
        const a = pointsByEntry.get(r.entry_id) ?? [];
        a.push(r);
        pointsByEntry.set(r.entry_id, a);
      }

      const nextMarkers: MarkerModel[] = [];
      const pointsByUser = new Map<string, { at: string; lat: number; lng: number }[]>();
      for (const e of list) {
        const arr = pointsByEntry.get(e.id) ?? [];
        const allPoints: { at: string; lat: number; lng: number }[] = [];
        if (e.clock_in_lat != null && e.clock_in_lng != null) {
          allPoints.push({ at: e.clock_in_at, lat: e.clock_in_lat, lng: e.clock_in_lng });
        }
        for (const g of arr) allPoints.push({ at: g.recorded_at, lat: g.lat, lng: g.lng });
        if (allPoints.length === 0) continue;
        allPoints.sort((a, b) => a.at.localeCompare(b.at));
        const last = allPoints[allPoints.length - 1]!;
        const pid = e.project_id != null ? String(e.project_id) : "";
        const projectLabel = pid ? projectNameById[pid] ?? pid : "—";
        const plate = vehiclePlateByUserId?.[e.user_id]?.trim() || null;
        nextMarkers.push({
          entryId: e.id,
          userId: e.user_id,
          name: nameByUser[e.user_id] ?? e.user_id.slice(0, 8),
          projectLabel,
          lat: last.lat,
          lng: last.lng,
          lastRecordedAt: last.at,
          vehiclePlate: plate,
          hasVehicle: !!plate,
        });
        if (showRoute) {
          const pu = pointsByUser.get(e.user_id) ?? [];
          pu.push(...allPoints);
          pointsByUser.set(e.user_id, pu);
        }
      }
      setMarkers(nextMarkers);

      if (showRoute) {
        const nextRoutes: RouteLine[] = [];
        let i = 0;
        for (const [uid, points] of pointsByUser) {
          points.sort((a, b) => a.at.localeCompare(b.at));
          nextRoutes.push({
            userId: uid,
            points: points.map((p) => [p.lat, p.lng] as L.LatLngExpression),
            color: ROUTE_COLORS[i % ROUTE_COLORS.length]!,
          });
          i += 1;
        }
        setRoutes(nextRoutes);
      } else {
        setRoutes([]);
      }
    } catch (err) {
      console.error("[TeamGpsMapWidget]", err);
      setMarkers([]);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, timeZone, routeDate, showRoute, filterProjectId, filterUserId, projectNameById, vehiclePlateByUserId]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensureLeafletDefaultIcons();
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([20, 0], 2);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    tileRef.current = L.tileLayer(darkTiles ? DARK_TILE_URL : LIGHT_TILE_URL, { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
    const onResize = () => map.invalidateSize();
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
    tileRef.current = L.tileLayer(darkTiles ? DARK_TILE_URL : LIGHT_TILE_URL, { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
  }, [darkTiles]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;
    group.clearLayers();

    for (const r of routes) {
      if (r.points.length >= 2) {
        L.polyline(r.points, { color: r.color, weight: 4, opacity: 0.85 }).addTo(group);
      }
    }

    const projectLbl = labels.project ?? "Project";
    const lastPosLbl = labels.gps_last_position ?? "";
    const vehLbl = labels.gps_vehicle_assigned ?? "";
    const boundsPts: L.LatLngExpression[] = [];

    const vehicleIcon = L.divIcon({
      className: "machinpro-veh-marker",
      html: '<div style="width:14px;height:14px;border-radius:999px;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    for (const m of markers) {
      const mk = m.hasVehicle ? L.marker([m.lat, m.lng], { icon: vehicleIcon }) : L.marker([m.lat, m.lng]);
      const lastPos = formatDateTime(m.lastRecordedAt, dateLoc, timeZone);
      const vehLine = m.vehiclePlate && vehLbl
        ? `<div><span class="opacity-70">${escapeHtml(vehLbl)}:</span> ${escapeHtml(m.vehiclePlate)}</div>`
        : "";
      mk.bindPopup(
        `<div class="text-sm space-y-1 min-w-[200px]">
          <div class="font-semibold">${escapeHtml(m.name)}</div>
          <div><span class="opacity-70">${escapeHtml(projectLbl)}:</span> ${escapeHtml(m.projectLabel)}</div>
          <div><span class="opacity-70">${escapeHtml(lastPosLbl)}:</span> ${escapeHtml(lastPos)}</div>
          ${vehLine}
        </div>`
      );
      mk.addTo(group);
      boundsPts.push([m.lat, m.lng]);
    }

    for (const r of routes) boundsPts.push(...r.points);
    if (boundsPts.length > 0) {
      const bounds = L.latLngBounds(boundsPts);
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
    }
    requestAnimationFrame(() => map.invalidateSize());
  }, [routes, markers, dateLoc, timeZone, labels.project, labels.gps_last_position, labels.gps_vehicle_assigned]);

  const emptyMessage = filterProjectId
    ? (Lx("gps_no_active_project") || Lx("gps_no_active"))
    : (Lx("gps_no_active_general") || Lx("gps_no_active"));

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
          {emptyMessage}
        </p>
      ) : null}
      {markers.some((m) => m.hasVehicle) ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Car className="h-3.5 w-3.5" aria-hidden />
          {Lx("gps_vehicle_assigned")}
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
