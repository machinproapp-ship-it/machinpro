"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppNotificationRow = {
  id: string;
  company_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
};

const POLL_MS = 30_000;

export function useNotifications(supabase: SupabaseClient | null, enabled: boolean) {
  const [notifications, setNotifications] = useState<AppNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled || !supabase) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        notifications?: AppNotificationRow[];
        unreadCount?: number;
        disabled?: boolean;
      };
      if (!mounted.current) return;
      if (!res.ok) {
        setLoading(false);
        return;
      }
      if (json.disabled) {
        setDisabled(true);
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }
      setDisabled(false);
      setNotifications(Array.isArray(json.notifications) ? json.notifications : []);
      setUnreadCount(typeof json.unreadCount === "number" ? json.unreadCount : 0);
    } catch {
      if (mounted.current) setDisabled(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [enabled, supabase]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) {
      setLoading(false);
      return () => {
        mounted.current = false;
      };
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [enabled, refresh]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!supabase || disabled) return;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) void refresh();
    },
    [supabase, disabled, refresh]
  );

  const markAllAsRead = useCallback(async () => {
    if (!supabase || disabled) return;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/notifications/read-all", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) void refresh();
  }, [supabase, disabled, refresh]);

  return { notifications, unreadCount, loading, disabled, markAsRead, markAllAsRead, refresh };
}
