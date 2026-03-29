"use client";

import { useMemo, useCallback } from "react";
import { Building2, Warehouse, Calendar, HardHat, Settings, Shield } from "lucide-react";
import type { MainSection, SidebarLabels } from "@/types/shared";

const MOBILE_SHORT: Partial<Record<MainSection, string>> = {
  office: "Central",
  schedule: "Horario",
  warehouse: "Logíst.",
  security: "Segur.",
  settings: "Ajustes",
};

function mobileBarShortLabel(id: MainSection, fullLabel: string): string {
  const fixed = MOBILE_SHORT[id];
  if (fixed != null && fixed !== "") return fixed;
  const t = fullLabel.trim();
  return t.length > 7 ? `${t.slice(0, 6)}…` : t;
}

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
  /** Seguridad (riesgos, acciones, documentos, auditoría) */
  canAccessSecurity?: boolean;
  canAccessSettings?: boolean;
  labels: SidebarLabels;
  collapsed?: boolean;
}

export function Sidebar({
  activeSection,
  setActiveSection,
  canAccessOffice,
  canAccessWarehouse,
  canAccessSite,
  canAccessSchedule = true,
  canAccessSecurity = true,
  canAccessSettings = true,
  labels,
  collapsed = false,
}: SidebarProps) {
  const operationsLabel = labels.nav_operations ?? labels.site ?? "Operaciones";
  const securityLabel = labels.nav_security ?? "Seguridad";

  const sidebarNavItems: NavItem[] = useMemo(
    () => [
      { id: "office", icon: Building2, label: labels.office ?? "Central", show: canAccessOffice },
      { id: "site", icon: HardHat, label: operationsLabel, show: canAccessSite },
      { id: "schedule", icon: Calendar, label: labels.schedule ?? "Horario", show: canAccessSchedule },
      { id: "warehouse", icon: Warehouse, label: labels.warehouse ?? "Logística", show: canAccessWarehouse },
      { id: "security", icon: Shield, label: securityLabel, show: canAccessSecurity },
      { id: "settings", icon: Settings, label: labels.settings ?? "Ajustes", show: canAccessSettings },
    ],
    [
      labels.office,
      labels.schedule,
      labels.warehouse,
      labels.settings,
      operationsLabel,
      securityLabel,
      canAccessOffice,
      canAccessSite,
      canAccessSchedule,
      canAccessWarehouse,
      canAccessSecurity,
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
      case "security":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300";
      default:
        return "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300";
    }
  };

  const barIconClass = (isActive: boolean) =>
    isActive ? "text-[#f97316] dark:text-orange-400" : "text-zinc-500 dark:text-gray-400";

  const barTextClass = (isActive: boolean) =>
    isActive ? "text-[#f97316] dark:text-orange-400" : "text-zinc-600 dark:text-gray-400";

  const barColumnCount = visibleItems.length;

  return (
    <>
      <aside
        className={`relative z-20 border-r border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-950 hidden lg:flex flex-col self-stretch pt-4 transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <div className="p-2 flex flex-col gap-0.5 min-w-0">
          {visibleItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
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

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 lg:hidden pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Navegación principal"
      >
        <div
          className="grid gap-0.5 px-1 py-1.5"
          style={{ gridTemplateColumns: `repeat(${barColumnCount}, minmax(0, 1fr))` }}
        >
          {visibleItems.map((item) => {
            const isActive = activeSection === item.id;
            const short = mobileBarShortLabel(item.id, item.label);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] w-full rounded-lg px-0.5 py-0.5 transition-colors ${
                  isActive ? "bg-amber-500/10 dark:bg-amber-500/15" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                }`}
              >
                <span className="h-[22px] w-[22px] shrink-0 flex items-center justify-center">
                  <item.icon className={`h-[22px] w-[22px] ${barIconClass(isActive)}`} aria-hidden />
                </span>
                <span
                  className={`max-w-[4rem] truncate text-center text-[9px] font-medium leading-tight w-full px-0.5 ${barTextClass(isActive)}`}
                >
                  {short}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
