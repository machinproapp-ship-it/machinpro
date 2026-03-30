"use client";

import { Building2, Warehouse, MapPin, Briefcase, Cloud, CloudOff, Bell, ChevronDown } from "lucide-react";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import type { UserRole } from "@/types/shared";

export interface HeaderProps {
  companyName: string;
  logoUrl: string;
  isOnline: boolean;
  syncPopoverOpen: boolean;
  setSyncPopoverOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  syncPopoverRef: React.RefObject<HTMLDivElement | null>;
  notificationsOpen: boolean;
  setNotificationsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;
  notificationsList: { id: string; title: string; expiryDate?: string }[];
  roleSelectorOpen: boolean;
  setRoleSelectorOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  simulatedDisplayName: string;
  currentUserRole: UserRole;
  setRoleAndNavigate: (role: UserRole, subRoleId?: string | null) => void;
  simulatorNames: Record<UserRole, string>;
  currentSubRoleId: string | null;
  setCurrentSubRoleId: (v: string | null) => void;
  subRoles: { id: string; name: string; parentRole: string }[];
  labels: {
    notifications: string;
    noNotifications: string;
    syncSynced: string;
    syncOffline: string;
    syncStatusOnlineMessage: string;
    syncStatusOfflineMessage: string;
    sessionRole: string;
    roleAdmin: string;
    roleLogistic: string;
    roleSupervisor: string;
    roleWorker: string;
    parentRoleLabel: string;
    subRoleNone?: string;
  };
}

const BRAND = "MachinPro";

export function Header({
  companyName,
  logoUrl,
  isOnline,
  syncPopoverOpen,
  setSyncPopoverOpen,
  syncPopoverRef,
  notificationsOpen,
  setNotificationsOpen,
  markAllNotificationsRead,
  unreadCount,
  notificationsList,
  roleSelectorOpen,
  setRoleSelectorOpen,
  simulatedDisplayName,
  currentUserRole,
  setRoleAndNavigate,
  simulatorNames,
  currentSubRoleId,
  setCurrentSubRoleId,
  subRoles,
  labels: t,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <BrandLogoImage
              src={logoUrl}
              alt=""
              boxClassName="h-8 w-[128px]"
              sizes="128px"
              scale={1.2}
            />
          ) : null}
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {companyName.trim() || BRAND}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={syncPopoverRef}>
            <button
              type="button"
              onClick={() => setSyncPopoverOpen((o) => !o)}
              className="rounded-lg p-2.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={isOnline ? t.syncSynced : t.syncOffline}
              aria-label={isOnline ? t.syncSynced : t.syncOffline}
            >
              {isOnline ? (
                <Cloud className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CloudOff className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              )}
            </button>
            {syncPopoverOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setSyncPopoverOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 text-sm text-zinc-700 dark:text-zinc-300">
                  {isOnline ? t.syncStatusOnlineMessage : t.syncStatusOfflineMessage}
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => { setNotificationsOpen((o) => !o); if (!notificationsOpen) markAllNotificationsRead(); }}
              className="relative rounded-lg p-2.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={t.notifications}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-900" aria-hidden />
              )}
            </button>
            {notificationsOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setNotificationsOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-2">
                  <p className="px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">{t.notifications}</p>
                  {notificationsList.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">{t.noNotifications}</p>
                  ) : (
                    <ul className="py-1">
                      {notificationsList.slice(0, 15).map((n) => {
                        const isExpiredOrSoon = n.expiryDate && n.expiryDate < "2026-03-01";
                        return (
                          <li
                            key={n.id}
                            className={`px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center gap-2 ${isExpiredOrSoon ? "text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-950/20" : "text-zinc-800 dark:text-zinc-200"}`}
                          >
                            {isExpiredOrSoon && <span className="shrink-0" aria-hidden>⚠️</span>}
                            {n.title}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="relative group">
            <button
              type="button"
              className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center gap-1.5 min-w-[140px] min-h-[44px] justify-center"
              title={t.sessionRole}
              aria-haspopup="listbox"
              aria-expanded={roleSelectorOpen}
              onClick={() => setRoleSelectorOpen((o) => !o)}
            >
              <span className="truncate">{simulatedDisplayName}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${roleSelectorOpen ? "rotate-180" : ""}`} />
            </button>
            {roleSelectorOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setRoleSelectorOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1">
                  {(["admin", "logistic", "supervisor", "worker"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => { setRoleAndNavigate(role); setRoleSelectorOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 min-h-[44px] ${currentUserRole === role ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                    >
                      {role === "admin" && <Building2 className="h-4 w-4 shrink-0" />}
                      {role === "logistic" && <Warehouse className="h-4 w-4 shrink-0" />}
                      {role === "supervisor" && <MapPin className="h-4 w-4 shrink-0" />}
                      {role === "worker" && <Briefcase className="h-4 w-4 shrink-0" />}
                      {simulatorNames[role]} ({role === "admin" ? t.roleAdmin : role === "logistic" ? t.roleLogistic : role === "supervisor" ? t.roleSupervisor : t.roleWorker})
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {subRoles.filter((s) => s.parentRole === currentUserRole).length > 0 && (
            <select
              value={currentSubRoleId ?? ""}
              onChange={(e) => setCurrentSubRoleId(e.target.value || null)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 min-w-[100px] focus:outline-none focus:ring-2 focus:ring-violet-500"
              title={t.parentRoleLabel}
            >
              <option value="">{t.subRoleNone ?? "—"}</option>
              {subRoles.filter((s) => s.parentRole === currentUserRole).map((sr) => (
                <option key={sr.id} value={sr.id}>{sr.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </header>
  );
}
