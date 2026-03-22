"use client";

import {
  Building2,
  Warehouse,
  MapPin,
  Sliders,
  Calendar,
  HardHat,
  Settings,
  FolderOpen,
  CreditCard,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import type { MainSection, SidebarLabels } from "@/types/shared";

export interface SidebarProps {
  activeSection: MainSection;
  setActiveSection: (s: MainSection) => void;
  canAccessOffice: boolean;
  canAccessWarehouse: boolean;
  canAccessSite: boolean;
  canAccessSchedule?: boolean;
  canAccessForms?: boolean;
  canAccessBinders?: boolean;
  /** Solo admin — facturación / Stripe */
  canAccessBilling?: boolean;
  /** Admin y supervisor — registro de visitantes / QR */
  canAccessVisitors?: boolean;
  /** Riesgos en obra — admin, supervisor y trabajador (solo lectura) */
  canAccessHazards?: boolean;
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
  canAccessForms = false,
  canAccessBinders = false,
  canAccessBilling = false,
  canAccessVisitors = false,
  canAccessHazards = false,
  labels,
  collapsed = false,
}: SidebarProps) {
  const billingLabel = labels.billing ?? "Billing";
  const visitorsLabel = labels.visitors ?? "Visitors";
  const hazardsLabel = labels.hazards ?? "Hazards";
  const sidebarNavItems = [
    { id: "office" as const, icon: Building2, label: labels.office ?? "Central", show: canAccessOffice },
    { id: "warehouse" as const, icon: Warehouse, label: labels.warehouse ?? "Logística", show: canAccessWarehouse },
    { id: "site" as const, icon: MapPin, label: labels.site ?? "Operaciones", show: canAccessSite },
    { id: "schedule" as const, icon: Calendar, label: labels.schedule ?? "Horario", show: canAccessSchedule },
    { id: "binders" as const, icon: FolderOpen, label: labels.binders ?? "Documentos", show: !!canAccessBinders },
    { id: "billing" as const, icon: CreditCard, label: billingLabel, show: !!canAccessBilling },
    { id: "visitors" as const, icon: UserCheck, label: visitorsLabel, show: !!canAccessVisitors },
    { id: "hazards" as const, icon: AlertTriangle, label: hazardsLabel, show: !!canAccessHazards },
    { id: "settings" as const, icon: Sliders, label: labels.settings ?? "Ajustes", show: true },
  ].filter((item) => item.show);

  const allBottomItems = [
    { id: "office" as const, icon: Building2, label: labels.office ?? "Central", show: canAccessOffice },
    { id: "warehouse" as const, icon: Warehouse, label: labels.warehouse ?? "Logística", show: canAccessWarehouse },
    { id: "site" as const, icon: HardHat, label: labels.site ?? "Operaciones", show: canAccessSite },
    { id: "schedule" as const, icon: Calendar, label: labels.schedule ?? "Horario", show: canAccessSchedule },
    { id: "binders" as const, icon: FolderOpen, label: labels.binders ?? "Documentos", show: !!canAccessBinders },
    { id: "billing" as const, icon: CreditCard, label: billingLabel, show: !!canAccessBilling },
    { id: "visitors" as const, icon: UserCheck, label: visitorsLabel, show: !!canAccessVisitors },
    { id: "hazards" as const, icon: AlertTriangle, label: hazardsLabel, show: !!canAccessHazards },
    { id: "settings" as const, icon: Settings, label: labels.settings ?? "Ajustes", show: true },
  ];
  const visibleBottom = allBottomItems.filter((item) => item.show);
  const bottomNavItems =
    visibleBottom.length > 5
      ? [
          ...visibleBottom.filter(
            (i) =>
              i.id !== "schedule" &&
              i.id !== "settings" &&
              i.id !== "billing" &&
              i.id !== "visitors" &&
              i.id !== "hazards"
          ).slice(0, 3),
          ...visibleBottom.filter((i) => i.id === "schedule"),
          ...visibleBottom.filter((i) => i.id === "visitors"),
          ...visibleBottom.filter((i) => i.id === "hazards"),
          ...visibleBottom.filter((i) => i.id === "billing"),
          ...visibleBottom.filter((i) => i.id === "settings"),
        ]
      : visibleBottom;

  const buttonClass = (id: MainSection, isActive: boolean, colorClass: string) =>
    `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full text-left min-h-[44px] justify-center sm:justify-start ${
      isActive ? colorClass : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
    }`;

  return (
    <>
    <aside
      className={`relative z-20 border-r border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-950 hidden sm:flex flex-col self-stretch pt-4 transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="p-2 flex flex-col gap-0.5 min-w-0">
        {sidebarNavItems.map((item) => {
          const isActive = activeSection === item.id;
          const colorClass =
            item.id === "office"
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                : item.id === "warehouse"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : item.id === "site"
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                    : item.id === "schedule"
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                      : item.id === "binders"
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                        : item.id === "billing"
                          ? "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300"
                          : item.id === "visitors"
                            ? "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300"
                            : item.id === "hazards"
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                              : "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={buttonClass(item.id, isActive, colorClass)}
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
      className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 sm:hidden safe-area-inset-bottom"
      aria-label="Navegación principal"
    >
      <div
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${bottomNavItems.length}, minmax(0, 1fr))` }}
      >
        {bottomNavItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveSection(item.id)}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors min-h-[44px] ${
              activeSection === item.id
                ? "text-amber-600 dark:text-amber-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            <span className="h-5 w-5 flex items-center justify-center">
              <item.icon className="h-5 w-5" />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
    </>
  );
}
