"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logAuditEvent } from "@/lib/useAuditLog";
import {
  getPendingSync,
  remapAnnotationIdInPendingQueue,
  remapPinIdInPendingQueue,
  removePendingSync,
  type AnnotationAddPayload,
  type AnnotationDeletePayload,
  type AnnotationResolvePayload,
  type PendingSyncOperation,
  type PinAddPayload,
  type PinDeletePayload,
} from "@/lib/offlineStorage";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

const RETRY_INTERVAL_MS = 20_000;

export type SyncQueueResult = { success: number; failed: number };

async function processOne(
  op: PendingSyncOperation,
  ctx: { companyId: string; userProfileId: string; userName: string }
): Promise<boolean> {
  if (!supabase) return false;

  switch (op.type) {
    case "pin_add": {
      const { tempPinId, insert } = op.payload as PinAddPayload;
      const { data, error } = await supabase.from("blueprint_pins").insert(insert).select("id").single();
      if (error) return false;
      const newId = String(data?.id ?? "");
      if (newId) await remapPinIdInPendingQueue(tempPinId, newId);
      await logAuditEvent({
        company_id: ctx.companyId,
        user_id: ctx.userProfileId,
        user_name: ctx.userName,
        action: "pin_added",
        entity_type: "blueprint",
        entity_id: newId || String(insert.blueprint_id ?? ""),
        entity_name: String(insert.title ?? ""),
        new_value: {
          blueprint_id: insert.blueprint_id,
          x: insert.x_percent,
          y: insert.y_percent,
        },
      });
      return true;
    }
    case "pin_delete": {
      const pDel = op.payload as PinDeletePayload;
      const { pinId } = pDel;
      if (pinId.startsWith("offline-")) return true;
      const { error } = await supabase.from("blueprint_pins").delete().eq("id", pinId);
      if (error) return false;
      await logAuditEvent({
        company_id: ctx.companyId,
        user_id: ctx.userProfileId,
        user_name: ctx.userName,
        action: "pin_deleted",
        entity_type: "blueprint",
        entity_id: pinId,
        entity_name: pDel.entityName ?? "",
      });
      return true;
    }
    case "annotation_add": {
      const { tempAnnotationId, insert } = op.payload as AnnotationAddPayload;
      const { data, error } = await supabase
        .from("blueprint_annotations")
        .insert(insert)
        .select("id")
        .single();
      if (error) return false;
      const newId = String(data?.id ?? "");
      if (newId) await remapAnnotationIdInPendingQueue(tempAnnotationId, newId);
      const content = String(insert.content ?? "");
      await logAuditEvent({
        company_id: ctx.companyId,
        user_id: ctx.userProfileId,
        user_name: ctx.userName,
        action: "annotation_added",
        entity_type: "blueprint",
        entity_id: newId,
        entity_name: content.slice(0, 80),
        new_value: {
          blueprint_id: insert.blueprint_id,
          x: insert.x_percent,
          y: insert.y_percent,
        },
      });
      return true;
    }
    case "annotation_delete": {
      const { annotationId } = op.payload as AnnotationDeletePayload;
      if (annotationId.startsWith("offline-")) return true;
      const { error } = await supabase.from("blueprint_annotations").delete().eq("id", annotationId);
      if (error) return false;
      const aDel = op.payload as AnnotationDeletePayload;
      await logAuditEvent({
        company_id: ctx.companyId,
        user_id: ctx.userProfileId,
        user_name: ctx.userName,
        action: "annotation_deleted",
        entity_type: "blueprint",
        entity_id: annotationId,
        entity_name: aDel.entityName ?? "",
      });
      return true;
    }
    case "annotation_resolve": {
      const { annotationId } = op.payload as AnnotationResolvePayload;
      if (annotationId.startsWith("offline-")) return true;
      const { data: annRow } = await supabase
        .from("blueprint_annotations")
        .select("content")
        .eq("id", annotationId)
        .maybeSingle();
      const preview =
        annRow && typeof (annRow as { content?: string }).content === "string"
          ? (annRow as { content: string }).content.slice(0, 80)
          : "";
      const { error } = await supabase
        .from("blueprint_annotations")
        .update({ is_resolved: true })
        .eq("id", annotationId);
      if (error) return false;
      await logAuditEvent({
        company_id: ctx.companyId,
        user_id: ctx.userProfileId,
        user_name: ctx.userName,
        action: "annotation_resolved",
        entity_type: "blueprint",
        entity_id: annotationId,
        entity_name: preview,
      });
      return true;
    }
    default:
      return false;
  }
}

export function useSyncQueue(opts: {
  companyId: string | null;
  userProfileId: string | null;
  userName: string;
  onSyncResult?: (r: SyncQueueResult) => void;
}): {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  refreshPendingCount: () => Promise<void>;
  isOnline: boolean;
  wasOffline: boolean;
} {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const flushing = useRef(false);
  const isOnlineRef = useRef(isOnline);
  const companyIdRef = useRef(opts.companyId);
  const userProfileIdRef = useRef(opts.userProfileId);
  const userNameRef = useRef(opts.userName);
  const onSyncResultRef = useRef(opts.onSyncResult);

  isOnlineRef.current = isOnline;
  companyIdRef.current = opts.companyId;
  userProfileIdRef.current = opts.userProfileId;
  userNameRef.current = opts.userName;
  onSyncResultRef.current = opts.onSyncResult;

  const refreshPendingCount = useCallback(async () => {
    const list = await getPendingSync();
    setPendingCount(list.length);
  }, []);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  const runFlush = useCallback(async () => {
    if (
      flushing.current ||
      !isOnlineRef.current ||
      !supabase ||
      !companyIdRef.current ||
      !userProfileIdRef.current
    ) {
      return;
    }
    const firstBatch = await getPendingSync();
    if (firstBatch.length === 0) return;

    flushing.current = true;
    setIsSyncing(true);
    let success = 0;
    let failed = 0;
    try {
      const ctx = {
        companyId: companyIdRef.current,
        userProfileId: userProfileIdRef.current,
        userName: userNameRef.current,
      };
      while (true) {
        const ops = await getPendingSync();
        if (ops.length === 0) break;
        const op = ops[0];
        const ok = await processOne(op, ctx);
        if (ok) {
          await removePendingSync(op.id);
          success++;
        } else {
          failed++;
          break;
        }
      }
      setLastSyncAt(Date.now());
      if (success > 0 || failed > 0) {
        onSyncResultRef.current?.({ success, failed });
      }
    } finally {
      flushing.current = false;
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  const prevOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      void runFlush();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, runFlush]);

  useEffect(() => {
    if (!isOnline || pendingCount === 0) return;
    void runFlush();
  }, [isOnline, pendingCount, runFlush]);

  useEffect(() => {
    if (!isOnline || pendingCount === 0) return;
    const id = window.setInterval(() => void runFlush(), RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isOnline, pendingCount, runFlush]);

  return { pendingCount, isSyncing, lastSyncAt, refreshPendingCount, isOnline, wasOffline };
}
