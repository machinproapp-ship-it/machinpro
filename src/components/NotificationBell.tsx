"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ClipboardList,
  Palmtree,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import { useNotifications, type AppNotificationRow } from "@/hooks/useNotifications";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notificationDisplayBody, notificationDisplayTitle } from "@/lib/notificationUi";
import { formatDateTime, formatRelative } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type Props = {
  supabase: SupabaseClient | null;
  labels: Record<string, string>;
  enabled: boolean;
  /** BCP 47 (`dateLocaleForUser`) for relative timestamps. */
  localeBcp47: string;
  /** IANA TZ for absolute date/time line. */
  timeZone: string;
  /** Abrir entidad relacionada (proyecto, calendario, etc.). */
  onNavigate?: (n: AppNotificationRow) => void;
  companyId?: string | null;
  /** Pantalla completa de notificaciones (panel aparte). */
  onViewAll?: () => void;
};

function categoryIcon(type: string) {
  const t = type.toLowerCase();
  if (t.startsWith("cert_")) return { Icon: ShieldAlert, key: "compliance" as const };
  if (t.includes("hazard")) return { Icon: AlertTriangle, key: "hazard" as const };
  if (t.includes("visitor")) return { Icon: UserRound, key: "visitor" as const };
  if (t.includes("vacation")) return { Icon: Palmtree, key: "vacation" as const };
  if (t.includes("daily_report")) return { Icon: ClipboardList, key: "daily_report" as const };
  return { Icon: Bell, key: "system" as const };
}

export function NotificationBell({
  supabase,
  labels,
  enabled,
  localeBcp47,
  timeZone,
  onNavigate,
  companyId = null,
  onViewAll,
}: Props) {
  const tl = labels;
  const [open, setOpen] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });
  const [mdPanelLayout, setMdPanelLayout] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const {
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
  } = useNotifications(supabase, enabled);
  void useMachinProDisplayPrefs();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMdPanelLayout(false);
      return;
    }
    const updatePanelPosition = () => {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
      setMdPanelLayout(window.matchMedia("(min-width: 768px)").matches);
    };
    updatePanelPosition();
    requestAnimationFrame(updatePanelPosition);
    const mq = window.matchMedia("(min-width: 768px)");
    mq.addEventListener("change", updatePanelPosition);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      mq.removeEventListener("change", updatePanelPosition);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((s) => setPushSubscribed(!!s))
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  if (!enabled || disabled) return null;

  const activateRow = async (n: AppNotificationRow) => {
    if (!n.read) await markAsRead(n.id);
    onNavigate?.(n);
    setOpen(false);
  };

  const onMarkReadOnly = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    void markAsRead(id);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-gray-700 dark:bg-gray-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={tl.notifications_title ?? "Notifications"}
      >
        <Bell className="h-5 w-5 shrink-0" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:bg-amber-500 dark:ring-zinc-900">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40 md:hidden" aria-hidden onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={tl.notifications_title ?? ""}
            className="fixed inset-0 z-[61] flex w-full max-w-full flex-col bg-white dark:bg-slate-900 md:inset-auto md:left-auto md:h-auto md:max-h-[min(70vh,32rem)] md:w-[min(100vw-2rem,22rem)] md:rounded-xl md:border md:border-zinc-200 md:shadow-lg dark:md:border-zinc-700 md:z-[100]"
            style={
              open && mdPanelLayout
                ? {
                    top: panelPos.top,
                    right: panelPos.right,
                    left: "auto",
                    bottom: "auto",
                  }
                : undefined
            }
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                {tl.notifications_title ?? "Notifications"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
                aria-label={tl.common_close ?? "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex shrink-0 gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`min-h-[40px] flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium ${
                  filter === "all"
                    ? "bg-amber-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-slate-800 dark:text-zinc-200 dark:hover:bg-slate-700"
                }`}
              >
                {tl.notifications_filter_all ?? "All"}
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`min-h-[40px] flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium ${
                  filter === "unread"
                    ? "bg-amber-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-slate-800 dark:text-zinc-200 dark:hover:bg-slate-700"
                }`}
              >
                {tl.notifications_filter_unread ?? "Unread"}
              </button>
            </div>

            {unreadCount > 0 ? (
              <div className="shrink-0 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                >
                  <CheckCheck className="h-4 w-4 shrink-0" />
                  {tl.notifications_mark_all_read ?? "Mark all read"}
                </button>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading ? (
                <p
                  className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                  role="status"
                >
                  {tl.notifications_loading ?? "Loading..."}
                </p>
              ) : notifications.length === 0 ? (
                <>
                  <p className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {tl.notifications_empty ?? "No notifications"}
                  </p>
                  {onViewAll ? (
                    <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={() => {
                          onViewAll();
                          setOpen(false);
                        }}
                        className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-semibold text-amber-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-slate-700"
                      >
                        {tl.notifications_view_all ?? "View all"}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {notifications.map((n) => {
                    const title = notificationDisplayTitle(n.type, n.title, tl);
                    const body = notificationDisplayBody(
                      n.type,
                      n.body,
                      n.data as Record<string, unknown> | null | undefined,
                      tl
                    );
                    const rel = formatRelative(n.created_at, localeBcp47);
                    const abs = formatDateTime(n.created_at, localeBcp47, timeZone);
                    const { Icon } = categoryIcon(n.type);
                    return (
                      <li key={n.id} className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void activateRow(n)}
                          className={`flex min-h-[44px] min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-slate-800/80 ${
                            !n.read ? "bg-amber-50/80 dark:bg-amber-950/20" : ""
                          }`}
                        >
                          <span
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-slate-800 dark:text-zinc-300"
                            aria-hidden
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block font-medium ${
                                !n.read ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"
                              }`}
                            >
                              {title}
                            </span>
                            {body ? (
                              <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-600 dark:text-zinc-400">
                                {body}
                              </span>
                            ) : null}
                            <span className="mt-1 block text-[11px] text-zinc-400 dark:text-zinc-500">
                              {rel}
                              {abs && abs !== "—" ? ` · ${abs}` : ""}
                            </span>
                          </span>
                        </button>
                        {!n.read ? (
                          <button
                            type="button"
                            onClick={(e) => onMarkReadOnly(e, n.id)}
                            className="flex shrink-0 min-h-[44px] min-w-[44px] items-center justify-center text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                            aria-label={tl.notifications_mark_read ?? "Mark as read"}
                            title={tl.notifications_mark_read ?? "Mark as read"}
                          >
                            <Check className="h-5 w-5" />
                          </button>
                        ) : (
                          <span className="w-11 shrink-0" aria-hidden />
                        )}
                      </li>
                    );
                  })}
                </ul>
                  {onViewAll ? (
                    <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={() => {
                          onViewAll();
                          setOpen(false);
                        }}
                        className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-semibold text-amber-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-slate-700"
                      >
                        {tl.notifications_view_all ?? "View all"}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
              {!loading && hasMore ? (
                <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                    className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-200 dark:hover:bg-slate-700"
                  >
                    {loadingMore
                      ? tl.notifications_loading ?? "…"
                      : tl.notifications_load_more ?? "Load more"}
                  </button>
                </div>
              ) : null}

              {companyId && supabase && !pushSubscribed ? (
                <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
                  <button
                    type="button"
                    disabled={pushBusy || typeof Notification === "undefined"}
                    onClick={() => {
                      void (async () => {
                        if (!supabase || !companyId) return;
                        const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
                        if (!vapid) return;
                        setPushBusy(true);
                        try {
                          const perm = await Notification.requestPermission();
                          if (perm !== "granted") return;
                          const reg = await navigator.serviceWorker.ready;
                          const sub = await reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(vapid),
                          });
                          const {
                            data: { session },
                          } = await supabase.auth.getSession();
                          const token = session?.access_token;
                          if (!token) return;
                          const res = await fetch("/api/notifications/subscribe", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ companyId, subscription: sub.toJSON() }),
                          });
                          if (res.ok) setPushSubscribed(true);
                        } finally {
                          setPushBusy(false);
                        }
                      })();
                    }}
                    className="min-h-[44px] w-full rounded-lg bg-amber-600 py-3 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    {pushBusy
                      ? tl.notifications_loading ?? "…"
                      : tl.notifications_enable ?? "Enable notifications"}
                  </button>
                </div>
              ) : null}
              {pushSubscribed ? (
                <p className="border-t border-zinc-200 px-3 py-2 text-center text-xs text-emerald-700 dark:border-zinc-700 dark:text-emerald-400">
                  {tl.notifications_enabled ?? ""}
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
