import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { BlueprintAnnotation, Blueprint as BlueprintRow, BlueprintPin } from "@/types/blueprint";

const DB_NAME = "machinpro-offline";
const DB_VERSION = 1;

export type PendingSyncType =
  | "pin_add"
  | "pin_delete"
  | "annotation_add"
  | "annotation_delete"
  | "annotation_resolve";

export type PinAddPayload = {
  tempPinId: string;
  insert: Record<string, unknown>;
};

export type PinDeletePayload = {
  blueprint_id: string;
  pinId: string;
  /** Para audit al sincronizar */
  entityName?: string;
};

export type AnnotationAddPayload = {
  tempAnnotationId: string;
  insert: Record<string, unknown>;
};

export type AnnotationDeletePayload = {
  blueprint_id: string;
  annotationId: string;
  entityName?: string;
};

export type AnnotationResolvePayload = {
  blueprint_id: string;
  annotationId: string;
};

export type PendingSyncPayload =
  | PinAddPayload
  | PinDeletePayload
  | AnnotationAddPayload
  | AnnotationDeletePayload
  | AnnotationResolvePayload;

export interface PendingSyncOperation {
  id: string;
  type: PendingSyncType;
  payload: PendingSyncPayload;
  created_at: string;
}

interface MachinProOfflineDB extends DBSchema {
  blueprints: {
    key: string;
    value: BlueprintRow;
    indexes: { by_project: string };
  };
  blueprint_pins: {
    key: string;
    value: BlueprintPin;
    indexes: { by_blueprint: string };
  };
  blueprint_annotations: {
    key: string;
    value: BlueprintAnnotation;
    indexes: { by_blueprint: string };
  };
  pending_sync: {
    key: string;
    value: PendingSyncOperation;
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBPDatabase<MachinProOfflineDB>> | null = null;

function getDb(): Promise<IDBPDatabase<MachinProOfflineDB>> | null {
  if (!isBrowser()) return null;
  if (!dbPromise) {
    dbPromise = openDB<MachinProOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const bpStore = db.createObjectStore("blueprints", { keyPath: "id" });
        bpStore.createIndex("by_project", "project_id");

        const pins = db.createObjectStore("blueprint_pins", { keyPath: "id" });
        pins.createIndex("by_blueprint", "blueprint_id");

        const ann = db.createObjectStore("blueprint_annotations", { keyPath: "id" });
        ann.createIndex("by_blueprint", "blueprint_id");

        db.createObjectStore("pending_sync", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export type CachedBlueprintBundle = {
  blueprint: BlueprintRow;
  pins?: BlueprintPin[];
  annotations?: BlueprintAnnotation[];
};

/** Guarda fila de plano y, si se pasan, sustituye pines y anotaciones del plano en caché. */
export async function cacheBlueprintData(blueprintId: string, data: CachedBlueprintBundle): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const tx = db.transaction(["blueprints", "blueprint_pins", "blueprint_annotations"], "readwrite");
  const b = data.blueprint;
  if (b.id !== blueprintId) {
    await tx.done;
    return;
  }
  await tx.objectStore("blueprints").put(b);

  if (data.pins !== undefined) {
    const pinStore = tx.objectStore("blueprint_pins");
    const idx = pinStore.index("by_blueprint");
    let cursor = await idx.openCursor(IDBKeyRange.only(blueprintId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    for (const p of data.pins) {
      await pinStore.put(p);
    }
  }

  if (data.annotations !== undefined) {
    const annStore = tx.objectStore("blueprint_annotations");
    const idx = annStore.index("by_blueprint");
    let cursor = await idx.openCursor(IDBKeyRange.only(blueprintId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    for (const a of data.annotations) {
      await annStore.put(a);
    }
  }

  await tx.done;
}

export async function getCachedBlueprintData(blueprintId: string): Promise<{
  blueprint: BlueprintRow;
  pins: BlueprintPin[];
  annotations: BlueprintAnnotation[];
} | null> {
  const db = await getDb();
  if (!db) return null;

  const blueprint = await db.get("blueprints", blueprintId);
  if (!blueprint) return null;

  const pins = await db.getAllFromIndex("blueprint_pins", "by_blueprint", blueprintId);
  const annotations = await db.getAllFromIndex("blueprint_annotations", "by_blueprint", blueprintId);
  return { blueprint, pins, annotations };
}

export async function getCachedBlueprintRowsForProject(projectId: string): Promise<BlueprintRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllFromIndex("blueprints", "by_project", projectId);
}

export async function addPendingSync(
  operation: Omit<PendingSyncOperation, "id" | "created_at"> & { id?: string }
): Promise<string> {
  const db = await getDb();
  if (!db) return "";
  const id = operation.id ?? crypto.randomUUID();
  const created_at = new Date().toISOString();
  const row: PendingSyncOperation = {
    id,
    type: operation.type,
    payload: operation.payload,
    created_at,
  };
  await db.put("pending_sync", row);
  return id;
}

export async function getPendingSync(): Promise<PendingSyncOperation[]> {
  const db = await getDb();
  if (!db) return [];
  const all = await db.getAll("pending_sync");
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function removePendingSync(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete("pending_sync", id);
}

export async function clearPendingSync(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.clear("pending_sync");
}

export async function removePendingPinAddByTempId(tempPinId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const all = await db.getAll("pending_sync");
  await Promise.all(
    all
      .filter((op) => op.type === "pin_add" && (op.payload as PinAddPayload).tempPinId === tempPinId)
      .map((op) => db.delete("pending_sync", op.id))
  );
}

export async function removePendingAnnotationAddByTempId(tempAnnotationId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const all = await db.getAll("pending_sync");
  await Promise.all(
    all
      .filter(
        (op) =>
          op.type === "annotation_add" &&
          (op.payload as AnnotationAddPayload).tempAnnotationId === tempAnnotationId
      )
      .map((op) => db.delete("pending_sync", op.id))
  );
}

/** Tras INSERT en servidor, actualiza ids temporales en el resto de la cola. */
export async function remapPinIdInPendingQueue(oldId: string, newId: string): Promise<void> {
  const db = await getDb();
  if (!db || oldId === newId) return;
  const all = await db.getAll("pending_sync");
  for (const op of all) {
    if (op.type === "pin_delete") {
      const p = op.payload as PinDeletePayload;
      if (p.pinId === oldId) {
        await db.put("pending_sync", { ...op, payload: { ...p, pinId: newId } });
      }
    }
  }
}

export async function remapAnnotationIdInPendingQueue(oldId: string, newId: string): Promise<void> {
  const db = await getDb();
  if (!db || oldId === newId) return;
  const all = await db.getAll("pending_sync");
  for (const op of all) {
    if (op.type === "annotation_delete" || op.type === "annotation_resolve") {
      const p = op.payload as AnnotationDeletePayload | AnnotationResolvePayload;
      if (p.annotationId === oldId) {
        await db.put("pending_sync", { ...op, payload: { ...p, annotationId: newId } });
      }
    }
  }
}
