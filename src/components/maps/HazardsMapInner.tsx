"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Hazard } from "@/types/hazard";

const LIGHT_TILE = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const DARK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function sevColor(s: string): string {
  const x = s.toLowerCase();
  if (x === "high" || x === "critical") return "#ef4444";
  if (x === "medium") return "#f97316";
  return "#eab308";
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const b = L.latLngBounds(positions.map((pt) => L.latLng(pt[0], pt[1])));
    map.fitBounds(b, { padding: [48, 48], maxZoom: 15 });
  }, [map, positions]);
  return null;
}

export function HazardsMapInner({
  hazards,
  labels,
  isDark,
}: {
  hazards: Hazard[];
  labels: Record<string, string>;
  isDark: boolean;
}) {
  const withGps = useMemo(
    () =>
      hazards.filter(
        (h) =>
          h.latitude != null &&
          h.longitude != null &&
          !Number.isNaN(Number(h.latitude)) &&
          !Number.isNaN(Number(h.longitude))
      ),
    [hazards]
  );

  const positions = useMemo(
    () => withGps.map((h) => [Number(h.latitude), Number(h.longitude)] as [number, number]),
    [withGps]
  );

  const center = useMemo((): [number, number] => {
    if (positions.length === 0) return [45.4215, -75.6972];
    const lat = positions.reduce((s, p) => s + p[0], 0) / positions.length;
    const lng = positions.reduce((s, p) => s + p[1], 0) / positions.length;
    return [lat, lng];
  }, [positions]);

  const Lbl = (k: string, fb: string) => labels[k] ?? fb;

  return (
    <MapContainer
      center={center}
      zoom={11}
      className="z-0 h-full w-full rounded-xl"
      scrollWheelZoom
    >
      <TileLayer attribution='&copy; CARTO' url={isDark ? DARK_TILE : LIGHT_TILE} />
      {positions.length > 0 ? <FitBounds positions={positions} /> : null}
      {withGps.map((h) => (
        <CircleMarker
          key={h.id}
          center={[Number(h.latitude), Number(h.longitude)]}
          radius={11}
          pathOptions={{
            color: "#fff",
            weight: 2,
            fillColor: sevColor(h.severity),
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            <div className="max-w-[240px] space-y-1 text-sm">
              <p className="font-semibold">{h.title}</p>
              {(h.description ?? "").trim() ? (
                <p>{(h.description ?? "").slice(0, 200)}</p>
              ) : null}
              <p>
                <span className="text-zinc-500">{Lbl("hazard_severity", "Severity")}: </span>
                {h.severity}
              </p>
              <p>
                <span className="text-zinc-500">{Lbl("hazard_status", "Status")}: </span>
                {h.status}
              </p>
              <p>
                <span className="text-zinc-500">{Lbl("date", "Date")}: </span>
                {h.created_at?.slice(0, 10) ?? "—"}
              </p>
              <p>
                <span className="text-zinc-500">{Lbl("hazard_reported_by_short", "Reported by")}: </span>
                {h.reported_by_name ?? "—"}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
