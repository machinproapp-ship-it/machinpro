"use client";

import { useMemo, useCallback } from "react";
import { Building2, Warehouse, Calendar, HardHat, Settings, X } from "lucide-react";
import type { MainSection, SidebarLabels } from "@/types/shared";
import { ALL_TRANSLATIONS } from "@/lib/i18n";

type NavItem = {
  id: MainSection;
  icon: typeof Building2;
  label: string;
  show: boolean;
};

export interface SidebarProps {
  activeSection: MainSection;
  setActiveSection: (s: MainSection) => void;
  canAccessOffice: boolean;
  canAccessWarehouse: boolean;
  canAccessSite: boolean;
  canAccessSchedule?: boolean;
  canAccessSettings?: boolean;
  labels: SidebarLabels;
  collapsed?: boolean;
  /** Drawer móvil (< lg): abierto */
  mobileDrawerOpen?: boolean;
  onMobileDrawerOpenChange?: (open: boolean) => void;
}

export function Sidebar({
  activeSection,
  setActiveSection,
  canAccessOffice,
  canAccessWarehouse,
  canAccessSite,
  canAccessSchedule = true,
  canAccessSettings = true,
  labels,
  collapsed = false,
  mobileDrawerOpen = false,
  onMobileDrawerOpenChange,
}: SidebarProps) {
  const dict = labels as unknown as Record<string, string>;
  const E = ALL_TRANSLATIONS.en;
  const L = (k: string, fb: string) => dict[k] ?? (E as Record<string, string>)[k] ?? fb;
  const operationsLabel = labels.nav_operations ?? labels.site ?? L("site", "Operations");
  const closeLabel = L("nav_menu_close", "Close menu");
  const drawerTitle = L("nav_drawer_title", E.settings ?? "Menu");
  const sidebarNavItems: NavItem[] = useMemo(
    () => [
      { id: "office", icon: Building2, label: labels.office ?? dict.office ?? E.office, show: canAccessOffice },
      { id: "site", icon: HardHat, label: operationsLabel, show: canAccessSite },
      { id: "schedule", icon: Calendar, label: labels.schedule ?? dict.schedule ?? E.schedule, show: canAccessSchedule },
      {
        id: "warehouse",
        icon: Warehouse,
        label: labels.warehouse ?? dict.warehouse ?? E.warehouse,
        show: canAccessWarehouse,
      },
      { id: "settings", icon: Settings, label: labels.settings ?? dict.settings ?? E.settings, show: canAccessSettings },
    ],
    [
      labels.office,
      labels.schedule,
      labels.warehouse,
      labels.settings,
      dict,
      operationsLabel,
      canAccessOffice,
      canAccessSite,
      canAccessSchedule,
      canAccessWarehouse,
      canAccessSettings,
    ]
  );

  const visibleItems = useMemo(() => sidebarNavItems.filter((i) => i.show), [sidebarNavItems]);

  const buttonClass = useCallback((id: MainSection, isActive: boolean, colorClass: string) => {
    return `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full text-left min-h-[44px] justify-center lg:justify-start ${
      isActive ? colorClass : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
    }`;
  }, []);

  const itemColorClass = (id: MainSection): string => {
    switch (id) {
      case "office":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
      case "site":
        return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
      case "schedule":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
      case "warehouse":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
      default:
        return "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300";
    }
  };

  const navigate = (id: MainSection) => {
    setActiveSection(id);
    onMobileDrawerOpenChange?.(false);
  };

  return (
    <>
      <aside
        className={`relative z-20 border-r border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-950 hidden lg:flex flex-col self-stretch pt-4 transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-56 lg:w-64 xl:w-72"
        }`}
      >
        <div className="p-2 flex flex-col gap-0.5 min-w-0">
          {visibleItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={buttonClass(item.id, isActive, itemColorClass(item.id))}
                title={collapsed ? item.label : undefined}
              >
                <span className="h-5 w-5 shrink-0 flex items-center justify-center">
                  <item.icon className="h-5 w-5" />
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Móvil / tablet: overlay + drawer (sin barra inferior fija) */}
      {mobileDrawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[100] min-h-[100dvh] w-full max-w-none bg-black/50 lg:hidden touch-manipulation"
          aria-label={closeLabel}
          onClick={() => onMobileDrawerOpenChange?.(false)}
        />
      ) : null}

      <aside
        id="app-mobile-drawer"
        className={`fixed inset-y-0 left-0 z-[101] flex w-[min(20rem,92vw)] flex-col border-r border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-950 pt-[env(safe-area-inset-top,0px)] shadow-xl transition-transform duration-200 ease-out lg:hidden ${
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
        aria-hidden={!mobileDrawerOpen}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 dark:border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{drawerTitle}</h2>
          <button
            type="button"
            onClick={() => onMobileDrawerOpenChange?.(false)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-slate-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-2" aria-label={drawerTitle}>
          {visibleItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={buttonClass(item.id, isActive, itemColorClass(item.id))}
              >
                <span className="h-5 w-5 shrink-0 flex items-center justify-center">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 text-left break-words leading-snug">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
