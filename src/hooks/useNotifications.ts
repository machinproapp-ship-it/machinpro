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
const PAGE_SIZE = 20;

export type NotificationFilter = "all" | "unread";

export function useNotifications(supabase: SupabaseClient | null, enabled: boolean) {
  const [notifications, setNotifications] = useState<AppNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const mounted = useRef(true);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const fetchSlice = useCallback(
    async (opts: { offset: number; append: boolean }) => {
      if (!enabled || !supabase) {
        if (!opts.append) {
          setNotifications([]);
          setUnreadCount(0);
          setHasMore(false);
        }
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      const unreadQ = filterRef.current === "unread" ? "1" : "0";
      const url = `/api/notifications?limit=${PAGE_SIZE}&offset=${opts.offset}&unread=${unreadQ}`;
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as {
          notifications?: AppNotificationRow[];
          unreadCount?: number;
          disabled?: boolean;
          hasMore?: boolean;
        };
        if (!mounted.current) return;
        if (!res.ok) {
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        if (json.disabled) {
          setDisabled(true);
          setNotifications([]);
          setUnreadCount(0);
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        setDisabled(false);
        const list = Array.isArray(json.notifications) ? json.notifications : [];
        const more = typeof json.hasMore === "boolean" ? json.hasMore : list.length >= PAGE_SIZE;
        if (opts.append) {
          setNotifications((prev) => [...prev, ...list]);
        } else {
          setNotifications(list);
        }
        setHasMore(more);
        setUnreadCount(typeof json.unreadCount === "number" ? json.unreadCount : 0);
      } catch {
        if (mounted.current) setDisabled(true);
      } finally {
        if (mounted.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [enabled, supabase]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchSlice({ offset: 0, append: false });
  }, [fetchSlice]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    await fetchSlice({ offset: notifications.length, append: true });
  }, [fetchSlice, hasMore, loadingMore, loading, notifications.length]);

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
  }, [enabled, filter, refresh]);

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

  return {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    disabled,
    filter,
    setFilter,
    markAsRead,
    markAllAsRead,
    loadMore,
    refresh,
  };
}
