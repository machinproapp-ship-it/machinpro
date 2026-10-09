"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/lib/supabase";
import type { InventoryItem, Vehicle } from "@/components/LogisticsModule";
import {
  inventoryItemFromRow,
  inventoryItemToRow,
  isUuid,
  rowFingerprint,
  vehicleFromRow,
  vehicleToRow,
} from "@/lib/logisticsDb";

/**
 * Sincroniza inventario y flota con Supabase (`inventory_items`, `fleet_vehicles`).
 *
 * - Supabase es la fuente de verdad: al entrar se carga lo de la empresa y se sustituye el estado local.
 * - Cada cambio del estado (venga del handler que venga) se compara con la última versión guardada
 *   y solo se suben las filas que cambiaron. Las bajas se guardan como `deleted_at` (nunca se borra).
 * - localStorage queda como caché para modo offline, marcada con la empresa a la que pertenece.
 * - Sin conexión o con error, los cambios quedan pendientes y se reintentan al volver la conexión.
 */

export const LOGISTICS_CACHE_COMPANY_KEY = "machinpro_logistics_company";
const INVENTORY_LS_KEY = "machinpro_inventory";
const VEHICLES_LS_KEY = "machinpro_vehicles";
const SYNC_DEBOUNCE_MS = 700;
const RETRY_MS = 30_000;
const CHUNK = 100;

export type LogisticsSyncStatus = "idle" | "loading" | "synced" | "pending" | "error";

type Options = {
  companyId: string | null;
  enabled: boolean;
  inventoryItems: InventoryItem[];
  setInventoryItems: Dispatch<SetStateAction<InventoryItem[]>>;
  vehicles: Vehicle[];
  setVehicles: Dispatch<SetStateAction<Vehicle[]>>;
  /** Ids de los datos de ejemplo: nunca se suben a una empresa real. */
  demoInventoryIds: ReadonlySet<string>;
  demoVehicleIds: ReadonlySet<string>;
  /** Normaliza vehículos cargados (p. ej. documentos por país). */
  normalizeVehicles?: (list: Vehicle[]) => Vehicle[];
};

function readCache<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeCache(companyId: string, inv: InventoryItem[] | null, veh: Vehicle[] | null) {
  try {
    localStorage.setItem(LOGISTICS_CACHE_COMPANY_KEY, companyId);
    if (inv) localStorage.setItem(INVENTORY_LS_KEY, JSON.stringify(inv));
    if (veh) localStorage.setItem(VEHICLES_LS_KEY, JSON.stringify(veh));
  } catch {
    /* almacenamiento lleno o bloqueado: Supabase sigue siendo la fuente de verdad */
  }
}

function cacheBelongsTo(companyId: string): "same" | "other" | "untagged" {
  try {
    const tag = localStorage.getItem(LOGISTICS_CACHE_COMPANY_KEY);
    if (!tag) return "untagged";
    return tag === companyId ? "same" : "other";
  } catch {
    return "other";
  }
}

function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Respaldo RFC 4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type UpsertResult = { error: string | null; failedIds: Set<string> };

/**
 * Sube filas en bloques. Si un bloque falla, reintenta fila a fila para que un registro
 * con datos inválidos no impida guardar el resto; devuelve los ids que no se pudieron guardar.
 */
async function upsertChunks(table: string, rows: Record<string, unknown>[]): Promise<UpsertResult> {
  const failedIds = new Set<string>();
  let firstError: string | null = null;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
    if (!error) continue;
    if (chunk.length === 1) {
      failedIds.add(String(chunk[0].id));
      firstError = firstError ?? error.message;
      continue;
    }
    for (const row of chunk) {
      const { error: rowErr } = await supabase.from(table).upsert([row], { onConflict: "id" });
      if (rowErr) {
        failedIds.add(String(row.id));
        firstError = firstError ?? rowErr.message;
      }
    }
  }
  return { error: firstError, failedIds };
}

export function useLogisticsSync({
  companyId,
  enabled,
  inventoryItems,
  setInventoryItems,
  vehicles,
  setVehicles,
  demoInventoryIds,
  demoVehicleIds,
  normalizeVehicles,
}: Options): { status: LogisticsSyncStatus; lastError: string | null; reload: () => void } {
  const [status, setStatus] = useState<LogisticsSyncStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);
  const invSnap = useRef<Map<string, string>>(new Map());
  const vehSnap = useRef<Map<string, string>>(new Map());
  const pending = useRef(false);
  const syncing = useRef(false);
  const latest = useRef({ inventoryItems, vehicles });
  latest.current = { inventoryItems, vehicles };
  const [reloadSig, setReloadSig] = useState(0);
  const [retrySig, setRetrySig] = useState(0);

  const reload = useCallback(() => setReloadSig((n) => n + 1), []);

  // ── Carga inicial (y recargas) ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !companyId) return;
    let cancelled = false;
    setStatus("loading");
    void (async () => {
      const [invRes, vehRes] = await Promise.all([
        supabase.from("inventory_items").select("*").eq("company_id", companyId).is("deleted_at", null),
        supabase.from("fleet_vehicles").select("*").eq("company_id", companyId).is("deleted_at", null),
      ]);
      if (cancelled) return;
      if (invRes.error || vehRes.error) {
        // Sin conexión o tabla aún sin migrar: seguimos con la caché local, sin perder nada.
        setLastError(invRes.error?.message ?? vehRes.error?.message ?? null);
        setStatus("error");
        return;
      }

      const cacheOwner = cacheBelongsTo(companyId);
      let inv: InventoryItem[] = ((invRes.data ?? []) as Record<string, unknown>[]).map((r) => inventoryItemFromRow(r));
      let veh: Vehicle[] = ((vehRes.data ?? []) as Record<string, unknown>[]).map((r) => vehicleFromRow(r));
      const toImportInv: InventoryItem[] = [];
      const toImportVeh: Vehicle[] = [];
      let importFailedInv = new Set<string>();
      let importFailedVeh = new Set<string>();

      // Datos que este dispositivo guardó antes de existir la sincronización: se suben una sola vez,
      // solo si la caché es de esta empresa (o no tiene dueño) y no son los datos de ejemplo.
      if (cacheOwner !== "other") {
        const dbInvIds = new Set(inv.map((i) => i.id));
        for (const item of readCache<InventoryItem>(INVENTORY_LS_KEY)) {
          if (!item?.id || demoInventoryIds.has(item.id) || dbInvIds.has(item.id) || item.deletedAt) continue;
          if (cacheOwner === "untagged" && inv.length > 0) continue;
          toImportInv.push(item);
        }
        const dbVehPlates = new Set(veh.map((v) => (v.plate ?? "").trim().toLowerCase()));
        const dbVehIds = new Set(veh.map((v) => v.id));
        for (const v of readCache<Vehicle>(VEHICLES_LS_KEY)) {
          if (!v?.id || demoVehicleIds.has(v.id) || dbVehIds.has(v.id)) continue;
          if (cacheOwner === "untagged" && veh.length > 0) continue;
          if (v.plate && dbVehPlates.has(v.plate.trim().toLowerCase())) continue;
          toImportVeh.push(isUuid(v.id) ? v : { ...v, id: newUuid() });
        }
      }

      // Lo que no se pudo subir se mantiene en pantalla y queda pendiente (se reintenta luego).
      if (toImportInv.length) {
        const res = await upsertChunks("inventory_items", toImportInv.map((i) => inventoryItemToRow(i, companyId)));
        inv = [...inv, ...toImportInv];
        if (res.error) {
          setLastError(res.error);
          importFailedInv = res.failedIds;
        }
      }
      if (toImportVeh.length) {
        const res = await upsertChunks("fleet_vehicles", toImportVeh.map((v) => vehicleToRow(v, companyId)));
        veh = [...veh, ...toImportVeh];
        if (res.error) {
          setLastError(res.error);
          importFailedVeh = res.failedIds;
        }
      }
      if (cancelled) return;

      if (normalizeVehicles) veh = normalizeVehicles(veh);
      // Las filas que fallaron no entran en la "foto" de lo guardado, así se vuelven a intentar.
      invSnap.current = new Map(
        inv.filter((i) => !importFailedInv.has(i.id)).map((i) => [i.id, rowFingerprint(inventoryItemToRow(i, companyId))])
      );
      vehSnap.current = new Map(
        veh.filter((v) => !importFailedVeh.has(v.id)).map((v) => [v.id, rowFingerprint(vehicleToRow(v, companyId))])
      );
      loadedFor.current = companyId;
      const someFailed = importFailedInv.size > 0 || importFailedVeh.size > 0;
      pending.current = someFailed;
      setInventoryItems(inv);
      setVehicles(veh);
      writeCache(companyId, inv, veh);
      setStatus(someFailed ? "error" : "synced");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, companyId, reloadSig]);

  // ── Subir cambios ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !companyId || loadedFor.current !== companyId) return;

    // Vehículos creados con ids antiguos ("v123…"): pasan a uuid antes de subir.
    if (vehicles.some((v) => !isUuid(v.id))) {
      setVehicles((prev) => prev.map((v) => (isUuid(v.id) ? v : { ...v, id: newUuid() })));
      return;
    }

    pending.current = true;
    setStatus("pending");
    const timer = setTimeout(() => {
      void (async () => {
        if (syncing.current) {
          setRetrySig((n) => n + 1);
          return;
        }
        syncing.current = true;
        try {
          const { inventoryItems: inv, vehicles: veh } = latest.current;
          const now = new Date().toISOString();

          const invRows = inv.map((i) => inventoryItemToRow(i, companyId));
          const invChanged = invRows.filter((r) => invSnap.current.get(String(r.id)) !== rowFingerprint(r));
          const invIds = new Set(inv.map((i) => i.id));
          const invRemoved = [...invSnap.current.keys()].filter((id) => !invIds.has(id));

          const vehRows = veh.map((v) => vehicleToRow(v, companyId));
          const vehChanged = vehRows.filter((r) => vehSnap.current.get(String(r.id)) !== rowFingerprint(r));
          const vehIds = new Set(veh.map((v) => v.id));
          const vehRemoved = [...vehSnap.current.keys()].filter((id) => !vehIds.has(id));

          let err: string | null = null;
          let invFailed = new Set<string>();
          let vehFailed = new Set<string>();
          if (invChanged.length) {
            const res = await upsertChunks("inventory_items", invChanged);
            invFailed = res.failedIds;
            err = res.error;
          }
          if (invRemoved.length) {
            const { error } = await supabase
              .from("inventory_items")
              .update({ deleted_at: now })
              .eq("company_id", companyId)
              .in("id", invRemoved);
            if (error) err = err ?? error.message;
            else for (const id of invRemoved) invSnap.current.delete(id);
          }
          if (vehChanged.length) {
            const res = await upsertChunks("fleet_vehicles", vehChanged);
            vehFailed = res.failedIds;
            err = err ?? res.error;
          }
          if (vehRemoved.length) {
            const { error } = await supabase
              .from("fleet_vehicles")
              .update({ deleted_at: now })
              .eq("company_id", companyId)
              .in("id", vehRemoved);
            if (error) err = err ?? error.message;
            else for (const id of vehRemoved) vehSnap.current.delete(id);
          }

          // Lo que sí se guardó queda registrado aunque otra fila haya fallado.
          for (const r of invChanged) if (!invFailed.has(String(r.id))) invSnap.current.set(String(r.id), rowFingerprint(r));
          for (const r of vehChanged) if (!vehFailed.has(String(r.id))) vehSnap.current.set(String(r.id), rowFingerprint(r));
          writeCache(companyId, inv, veh);

          if (err) {
            setLastError(err);
            setStatus("error");
            return;
          }
          pending.current = false;
          setLastError(null);
          setStatus("synced");
        } finally {
          syncing.current = false;
        }
      })();
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, companyId, inventoryItems, vehicles, retrySig]);

  // ── Reintentos: al volver la conexión y cada 30 s mientras haya error ─────
  useEffect(() => {
    if (!enabled || status !== "error") return;
    const retry = () => {
      if (loadedFor.current === companyId) setRetrySig((n) => n + 1);
      else setReloadSig((n) => n + 1);
    };
    window.addEventListener("online", retry);
    const t = setInterval(retry, RETRY_MS);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(t);
    };
  }, [enabled, status, companyId]);

  // ── Ver cambios de otros usuarios al volver a la pestaña (si no hay nada pendiente) ──
  useEffect(() => {
    if (!enabled || !companyId) return;
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (pending.current || syncing.current) return;
      if (Date.now() - last < 60_000) return;
      last = Date.now();
      setReloadSig((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, companyId]);

  return { status, lastError, reload };
}
