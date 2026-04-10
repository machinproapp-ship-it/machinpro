"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import {
  dateLocaleForUser,
  formatTime,
  formatTodayYmdInTimeZone,
  zonedYmdHmToUtcIso,
} from "@/lib/dateUtils";
import { nominatimReverseLabel } from "@/lib/nominatimReverse";

function ensureLeafletDefaultIcons(): void {
  const proto = L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown };
  delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

const LIGHT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

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
  const [darkTiles, setDarkTiles] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDarkTiles(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensureLeafletDefaultIcons();
    const map = L.map(containerRef.current, { zoomControl: true }).setView([20, 0], 2);
    mapRef.current = map;
    const g = L.layerGroup().addTo(map);
    layerRef.current = g;
    tileRef.current = L.tileLayer(darkTiles ? DARK_TILE_URL : LIGHT_TILE_URL, {
      maxZoom: 19,
      attribution: "&copy; OSM",
    }).addTo(map);
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
    tileRef.current = L.tileLayer(darkTiles ? DARK_TILE_URL : LIGHT_TILE_URL, {
      maxZoom: 19,
      attribution: "&copy; OSM",
    }).addTo(map);
  }, [darkTiles]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (points.length === 0) return;
    const latlngs = points.map((p) => [p.lat, p.lng] as L.LatLngExpression);
    L.polyline(latlngs, { color: "#2563eb", weight: 4, opacity: 0.85 }).addTo(group);
    for (const p of points) {
      L.circleMarker([p.lat, p.lng], { radius: 5, color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.9 }).addTo(
        group
      );
    }
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    requestAnimationFrame(() => map.invalidateSize());
  }, [points]);

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{Lx("gps_route_history")}</h3>
        <label className="text-sm text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
          <span className="sr-only">{Lx("date") || "Date"}</span>
          <input
            type="date"
            value={routeDate}
            onChange={(e) => setRouteDate(e.target.value)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
          />
        </label>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{employeeName}</p>
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-600 h-[300px] md:h-[450px] z-0"
        aria-label={Lx("gps_route_history")}
      />
      {loading ? (
        <p className="text-sm text-zinc-500">{Lx("gpsLocating") || "…"}</p>
      ) : points.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {Lx("gps_no_route_data") || Lx("gps_route_no_points")}
        </p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto text-sm border-t border-zinc-100 dark:border-slate-700 pt-3">
          {points.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-0.5 border-b border-zinc-100 dark:border-slate-800 pb-2 last:border-0"
            >
              <span className="font-mono text-xs text-zinc-500 tabular-nums">
                {formatTime(p.recorded_at, dateLoc, timeZone)}
              </span>
              <span className="text-zinc-800 dark:text-zinc-200">
                {addresses[p.id] ?? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
