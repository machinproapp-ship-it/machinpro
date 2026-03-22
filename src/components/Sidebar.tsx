"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  ClipboardCheck,
  MoreHorizontal,
  X,
} from "lucide-react";
import type { MainSection, SidebarLabels } from "@/types/shared";

const MOBILE_BAR_PRIORITY: MainSection[] = [
  "office",
  "site",
  "visitors",
  "hazards",
  "corrective_actions",
];

const MOBILE_BAR_OVERFLOW_TAIL: MainSection[] = ["warehouse", "schedule", "binders", "billing", "settings"];

/** Etiquetas muy cortas para la barra inferior (≤7 caracteres donde aplica). */
const MOBILE_BAR_SHORT_LABEL: Partial<Record<MainSection, string>> = {
  office: "Central",
  site: "Obras",
  visitors: "Visitas",
  hazards: "Riesgos",
  corrective_actions: "Acciones",
  warehouse: "Logíst",
  schedule: "Horario",
  binders: "Docs",
  billing: "Factur",
  settings: "Ajustes",
};

function mobileBarShortLabel(id: MainSection, fullLabel: string): string {
  const fixed = MOBILE_BAR_SHORT_LABEL[id];
  if (fixed != null && fixed !== "") return fixed;
  const t = fullLabel.trim();
  return t.length > 7 ? `${t.slice(0, 6)}…` : t;
}

type BottomItem = {
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
  canAccessForms?: boolean;
  canAccessBinders?: boolean;
  /** Solo admin — facturación / Stripe */
  canAccessBilling?: boolean;
  /** Admin y supervisor — registro de visitantes / QR */
  canAccessVisitors?: boolean;
  /** Riesgos en obra — admin, supervisor y trabajador (solo lectura) */
  canAccessHazards?: boolean;
  /** Acciones correctivas — admin, supervisor y trabajador (solo lectura para trabajador) */
  canAccessCorrectiveActions?: boolean;
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
  canAccessCorrectiveActions = false,
  labels,
  collapsed = false,
}: SidebarProps) {
  void canAccessForms;
  const billingLabel = labels.billing ?? "Billing";
  const visitorsLabel = labels.visitors ?? "Visitors";
  const hazardsLabel = labels.hazards ?? "Hazards";
  const actionsLabel = labels.actions ?? "Actions";
  const labelExtra = labels as unknown as Record<string, string>;
  const moreLabel = labelExtra.nav_more ?? "Más";
  const closeSheetLabel = labelExtra.cancel ?? "Cerrar";

  const [moreOpen, setMoreOpen] = useState(false);

  const sidebarNavItems = [
    { id: "office" as const, icon: Building2, label: labels.office ?? "Central", show: canAccessOffice },
    { id: "warehouse" as const, icon: Warehouse, label: labels.warehouse ?? "Logística", show: canAccessWarehouse },
    { id: "site" as const, icon: MapPin, label: labels.site ?? "Operaciones", show: canAccessSite },
    { id: "schedule" as const, icon: Calendar, label: labels.schedule ?? "Horario", show: canAccessSchedule },
    { id: "binders" as const, icon: FolderOpen, label: labels.binders ?? "Documentos", show: !!canAccessBinders },
    { id: "billing" as const, icon: CreditCard, label: billingLabel, show: !!canAccessBilling },
    { id: "visitors" as const, icon: UserCheck, label: visitorsLabel, show: !!canAccessVisitors },
    { id: "hazards" as const, icon: AlertTriangle, label: hazardsLabel, show: !!canAccessHazards },
    {
      id: "corrective_actions" as const,
      icon: ClipboardCheck,
      label: actionsLabel,
      show: !!canAccessCorrectiveActions,
    },
    { id: "settings" as const, icon: Sliders, label: labels.settings ?? "Ajustes", show: true },
  ].filter((item) => item.show);

  const allBottomItems: BottomItem[] = useMemo(
    () => [
      { id: "office", icon: Building2, label: labels.office ?? "Central", show: canAccessOffice },
      { id: "warehouse", icon: Warehouse, label: labels.warehouse ?? "Logística", show: canAccessWarehouse },
      { id: "site", icon: HardHat, label: labels.site ?? "Operaciones", show: canAccessSite },
      { id: "schedule", icon: Calendar, label: labels.schedule ?? "Horario", show: canAccessSchedule },
      { id: "binders", icon: FolderOpen, label: labels.binders ?? "Documentos", show: !!canAccessBinders },
      { id: "billing", icon: CreditCard, label: billingLabel, show: !!canAccessBilling },
      { id: "visitors", icon: UserCheck, label: visitorsLabel, show: !!canAccessVisitors },
      { id: "hazards", icon: AlertTriangle, label: hazardsLabel, show: !!canAccessHazards },
      {
        id: "corrective_actions",
        icon: ClipboardCheck,
        label: actionsLabel,
        show: !!canAccessCorrectiveActions,
      },
      { id: "settings", icon: Settings, label: labels.settings ?? "Ajustes", show: true },
    ],
    [
      labels.office,
      labels.warehouse,
      labels.site,
      labels.schedule,
      labels.binders,
      labels.settings,
      billingLabel,
      visitorsLabel,
      hazardsLabel,
      actionsLabel,
      canAccessOffice,
      canAccessWarehouse,
      canAccessSite,
      canAccessSchedule,
      canAccessBinders,
      canAccessBilling,
      canAccessVisitors,
      canAccessHazards,
      canAccessCorrectiveActions,
    ]
  );

  const { barItems, overflowItems, showMore } = useMemo(() => {
    const visible = allBottomItems.filter((item) => item.show);
    const byId = Object.fromEntries(visible.map((i) => [i.id, i])) as Record<string, BottomItem>;
    const order = [...MOBILE_BAR_PRIORITY, ...MOBILE_BAR_OVERFLOW_TAIL];
    const sortedVisible = order.map((id) => byId[id]).filter((x): x is BottomItem => Boolean(x));

    if (sortedVisible.length <= 5) {
      return { barItems: sortedVisible, overflowItems: [] as BottomItem[], showMore: false };
    }
    return {
      barItems: sortedVisible.slice(0, 5),
      overflowItems: sortedVisible.slice(5),
      showMore: true,
    };
  }, [allBottomItems]);

  const overflowContainsActive = overflowItems.some((i) => i.id === activeSection);

  const closeMore = useCallback(() => setMoreOpen(false), []);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMore();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen, closeMore]);

  const selectSection = useCallback(
    (id: MainSection) => {
      setActiveSection(id);
      closeMore();
    },
    [setActiveSection, closeMore]
  );

  const buttonClass = (id: MainSection, isActive: boolean, colorClass: string) =>
    `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full text-left min-h-[44px] justify-center lg:justify-start ${
      isActive ? colorClass : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
    }`;

  const barColumnCount = barItems.length + (showMore ? 1 : 0);

  const barIconClass = (isActive: boolean) =>
    isActive
      ? "text-[#f97316] dark:text-orange-400"
      : "text-zinc-500 dark:text-gray-400";

  const barTextClass = (isActive: boolean) =>
    isActive
      ? "text-[#f97316] dark:text-orange-400"
      : "text-zinc-600 dark:text-gray-400";

  return (
    <>
      <aside
        className={`relative z-20 border-r border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-950 hidden lg:flex flex-col self-stretch pt-4 transition-[width] duration-200 ${
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
                              : item.id === "corrective_actions"
                                ? "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200"
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
        className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 lg:hidden pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Navegación principal"
      >
        <div
          className="grid gap-0.5 px-1 py-1.5"
          style={{ gridTemplateColumns: `repeat(${barColumnCount}, minmax(0, 1fr))` }}
        >
          {barItems.map((item) => {
            const isActive = activeSection === item.id;
            const short = mobileBarShortLabel(item.id, item.label);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSection(item.id)}
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
          {showMore && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              aria-label={moreLabel}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] w-full rounded-lg px-0.5 py-0.5 transition-colors ${
                overflowContainsActive || moreOpen
                  ? "bg-amber-500/10 dark:bg-amber-500/15"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
              }`}
            >
              <span className="h-[22px] w-[22px] shrink-0 flex items-center justify-center">
                <MoreHorizontal
                  className={`h-[22px] w-[22px] ${barIconClass(overflowContainsActive || moreOpen)}`}
                  aria-hidden
                />
              </span>
              <span
                className={`max-w-[4rem] truncate text-center text-[9px] font-medium leading-tight w-full px-0.5 ${barTextClass(overflowContainsActive || moreOpen)}`}
              >
                Más
              </span>
            </button>
          )}
        </div>
      </nav>

      {moreOpen && overflowItems.length > 0 && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={moreLabel}>
          <button
            type="button"
            className="absolute inset-0 bg-black/50 dark:bg-black/60"
            aria-label={closeSheetLabel}
            onClick={closeMore}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[min(70vh,28rem)] overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 pb-[env(safe-area-inset-bottom,0px)]">
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">{moreLabel}</span>
              <button
                type="button"
                onClick={closeMore}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label={closeSheetLabel}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="p-2">
              {overflowItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectSection(item.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium min-h-[48px] ${
                        isActive
                          ? "bg-amber-500/15 text-[#f97316] dark:bg-amber-500/20 dark:text-orange-400"
                          : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        <item.icon
                          className={`h-5 w-5 ${isActive ? "text-[#f97316] dark:text-orange-400" : "text-zinc-600 dark:text-zinc-400"}`}
                        />
                      </span>
                      <span
                        className={`min-w-0 flex-1 ${isActive ? "text-[#f97316] dark:text-orange-400" : ""}`}
                      >
                        {item.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
