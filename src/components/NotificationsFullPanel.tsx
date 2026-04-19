"use client";

import React, { useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useNotifications, type AppNotificationRow } from "@/hooks/useNotifications";
import {
  NOTIFICATION_TYPES_FOR_FILTER,
  notificationDisplayBody,
  notificationDisplayTitle,
} from "@/lib/notificationUi";
import { formatDateTime, formatRelative } from "@/lib/dateUtils";

type Props = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  labels: Record<string, string>;
  localeBcp47: string;
  timeZone: string;
  companyId: string | null;
  onNavigate?: (n: AppNotificationRow) => void;
};

export function NotificationsFullPanel({
  open,
  onClose,
  supabase,
  labels,
  localeBcp47,
  timeZone,
  companyId,
  onNavigate,
}: Props) {
  const tl = labels;
  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    filter,
    setFilter,
    typeFilter,
    setTypeFilter,
    dismiss,
    markAsRead,
    markAllAsRead,
    loadMore,
    disabled,
  } = useNotifications(supabase, open && !!companyId);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const activateRow = async (n: AppNotificationRow) => {
    if (!n.read) await markAsRead(n.id);
    onNavigate?.(n);
    onClose();
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[130] bg-black/50 touch-none"
        aria-label={tl.common_close ?? "Close"}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tl.notifications_title ?? "Notifications"}
        className="fixed inset-0 z-[131] flex flex-col bg-white shadow-2xl dark:bg-slate-900 md:inset-[5vh] md:m-auto md:h-[min(90vh,720px)] md:max-w-lg md:rounded-2xl md:border md:border-zinc-200 dark:md:border-zinc-700"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-white">
              {tl.notifications_title ?? "Notifications"}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
              >
                <CheckCheck className="h-4 w-4" aria-hidden />
                {tl.notifications_mark_all_read ?? "Mark all read"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
              aria-label={tl.common_close ?? "Close"}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`min-h-[44px] rounded-lg px-3 text-sm font-medium ${
                filter === "all"
                  ? "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-slate-800"
              }`}
            >
              {tl.notifications_filter_all ?? "All"}
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`min-h-[44px] rounded-lg px-3 text-sm font-medium ${
                filter === "unread"
                  ? "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-slate-800"
              }`}
            >
              {tl.notifications_filter_unread ?? "Unread"}
            </button>
          </div>
          <label className="flex min-h-[44px] flex-1 flex-col text-xs text-zinc-500 dark:text-zinc-400 sm:max-w-[220px]">
            {tl.notifications_filter_type ?? "Type"}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="mt-1 min-h-[44px] rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="all">{tl.notifications_all_types ?? "All types"}</option>
              {NOTIFICATION_TYPES_FOR_FILTER.map((tp) => (
                <option key={tp} value={tp}>
                  {notificationDisplayTitle(tp, tp, tl)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {disabled ? (
            <p className="py-12 text-center text-sm text-zinc-500">{tl.notifications_empty ?? ""}</p>
          ) : loading ? (
            <p className="py-12 text-center text-sm text-zinc-500">{tl.notifications_loading ?? "…"}</p>
          ) : notifications.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">{tl.notifications_empty ?? "No notifications"}</p>
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
                  <li key={n.id} className="flex gap-1 py-1">
                    <button
                      type="button"
                      onClick={() => void activateRow(n)}
                      className={`flex min-h-[44px] min-w-0 flex-1 flex-col items-start gap-1 rounded-xl px-3 py-3 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-slate-800/80 ${
                        !n.read ? "bg-amber-50/80 dark:bg-amber-950/20" : ""
                      }`}
                    >
                      <span className="font-medium text-zinc-900 dark:text-white">{title}</span>
                      {body ? (
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">{body}</span>
                      ) : null}
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        {rel}
                        {abs && abs !== "—" ? ` · ${abs}` : ""}
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-col gap-1">
                      {!n.read ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void markAsRead(n.id);
                          }}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                          aria-label={tl.notifications_mark_read ?? "Mark as read"}
                        >
                          <Check className="h-5 w-5" />
                        </button>
                      ) : (
                        <span className="min-h-[44px] min-w-[44px]" aria-hidden />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void dismiss(n.id);
                        }}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-slate-800"
                        aria-label={tl.notifications_dismiss ?? "Dismiss"}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!loading && hasMore ? (
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-200 dark:hover:bg-slate-700"
              >
                {loadingMore ? tl.notifications_loading ?? "…" : tl.notifications_load_more ?? "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
