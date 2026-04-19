"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type ProjectsMapProject = {
  id: string;
  name: string;
  locationLat?: number;
  locationLng?: number;
  budgetCAD?: number;
  spentCAD?: number;
  lifecycleStatus?: "active" | "paused" | "completed";
  archived?: boolean;
  /** Number of assigned team members for popup. */
  teamCount?: number;
};

const LIGHT_TILE = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const DARK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function pinColor(p: ProjectsMapProject): string {
  if (p.archived || p.lifecycleStatus === "completed") return "#9ca3af";
  if (p.lifecycleStatus === "paused") return "#f97316";
  return "#22c55e";
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const b = L.latLngBounds(positions.map((pt) => L.latLng(pt[0], pt[1])));
    map.fitBounds(b, { padding: [48, 48], maxZoom: 14 });
  }, [map, positions]);
  return null;
}

export function ProjectsMapInner({
  projects,
  labels,
  isDark,
}: {
  projects: ProjectsMapProject[];
  labels: Record<string, string>;
  isDark: boolean;
}) {
  const withCoords = useMemo(
    () =>
      projects.filter(
        (p) =>
          typeof p.locationLat === "number" &&
          typeof p.locationLng === "number" &&
          !Number.isNaN(p.locationLat) &&
          !Number.isNaN(p.locationLng)
      ),
    [projects]
  );

  const positions = useMemo(
    () => withCoords.map((p) => [p.locationLat!, p.locationLng!] as [number, number]),
    [withCoords]
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
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO' url={isDark ? DARK_TILE : LIGHT_TILE} />
      {positions.length > 0 ? <FitBounds positions={positions} /> : null}
      {withCoords.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.locationLat!, p.locationLng!]}
          radius={10}
          pathOptions={{
            color: "#fff",
            weight: 2,
            fillColor: pinColor(p),
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            <div className="text-sm space-y-1 max-w-[220px]">
              <p className="font-semibold">{p.name}</p>
              <p>
                <span className="text-zinc-500">{Lbl("projects_map_popup_status", "Status")}: </span>
                {p.archived || p.lifecycleStatus === "completed"
                  ? Lbl("projects_status_completed", "Completed")
                  : p.lifecycleStatus === "paused"
                    ? Lbl("projects_status_paused", "Paused")
                    : Lbl("projects_status_active", "Active")}
              </p>
              <p>
                <span className="text-zinc-500">{Lbl("project_budget_short_label", "Budget")}: </span>
                {p.budgetCAD != null ? `$${p.budgetCAD.toLocaleString()} CAD` : "—"}
              </p>
              <p>
                <span className="text-zinc-500">{Lbl("projects_map_popup_team", "Team")}: </span>
                {typeof p.teamCount === "number" ? String(p.teamCount) : "—"}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
