"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { useNotifications, type AppNotificationRow } from "@/hooks/useNotifications";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notificationDisplayBody, notificationDisplayTitle } from "@/lib/notificationUi";
import { formatDateTime, formatRelative } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";

type Props = {
  supabase: SupabaseClient | null;
  labels: Record<string, string>;
  enabled: boolean;
  /** BCP 47 (`dateLocaleForUser`) for relative timestamps. */
  localeBcp47: string;
  /** IANA TZ for absolute date/time line. */
  timeZone: string;
};

export function NotificationBell({ supabase, labels, enabled, localeBcp47, timeZone }: Props) {
  const tl = labels;
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });
  const [mdPanelLayout, setMdPanelLayout] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const { notifications, unreadCount, loading, disabled, markAsRead, markAllAsRead } = useNotifications(
    supabase,
    enabled
  );
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

  const onItemActivate = async (n: AppNotificationRow) => {
    if (!n.read) await markAsRead(n.id);
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
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white dark:bg-amber-500">
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
            className="fixed inset-0 z-[61] flex flex-col bg-white dark:bg-slate-900 md:fixed md:inset-auto md:left-auto md:bottom-auto md:h-auto md:max-h-[min(70vh,32rem)] md:w-[min(100vw-2rem,22rem)] md:rounded-xl md:border md:border-zinc-200 md:shadow-lg dark:md:border-zinc-700 md:z-[100]"
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
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
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
            {unreadCount > 0 ? (
              <div className="shrink-0 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  className="min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                >
                  {tl.notifications_mark_all_read ?? "Mark all read"}
                </button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p
                  className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                  role="status"
                >
                  {tl.notifications_loading ?? "Loading..."}
                </p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {tl.notifications_empty ?? "All caught up"}
                </p>
              ) : (
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
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => void onItemActivate(n)}
                          className={`flex w-full min-h-[44px] flex-col gap-0.5 px-4 py-3 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-slate-800/80 ${
                            !n.read ? "bg-amber-50/80 dark:bg-amber-950/20" : ""
                          }`}
                        >
                          <span className={`font-medium ${!n.read ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"}`}>
                            {title}
                          </span>
                          {body ? (
                            <span className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{body}</span>
                          ) : null}
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                            {rel}
                            {abs && abs !== "—" ? ` · ${abs}` : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
