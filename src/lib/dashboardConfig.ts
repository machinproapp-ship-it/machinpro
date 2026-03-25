/**
 * Central dashboard layout (Sprint AV-6) — persisted in companies.dashboard_config
 * and optionally user_profiles.dashboard_config (user overrides company).
 */

export const DASHBOARD_WIDGET_IDS = [
  "timeclock",
  "activity",
  "alerts",
  "hazards",
  "actions",
  "visitors",
  "blueprints",
  "subscription",
  "quickaccess",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] = [...DASHBOARD_WIDGET_IDS];

export const QUICK_ACCESS_KEYS = [
  "hazard",
  "corrective",
  "visitor",
  "audit",
  "employee",
  "rfi",
  "subcontractor",
] as const;

export type QuickAccessKey = (typeof QUICK_ACCESS_KEYS)[number];

export const DEFAULT_QUICK_ACCESS_KEYS: QuickAccessKey[] = ["hazard", "corrective", "visitor", "audit"];

/** Persisted shape: `order` = enabled widgets top-to-bottom; omitted ids are off. */
export interface DashboardConfigStored {
  v?: number;
  order?: string[];
  quickAccess?: string[];
  /** Legacy / optional explicit hide */
  hidden?: Record<string, boolean>;
}

export interface ResolvedDashboardConfig {
  orderedWidgets: DashboardWidgetId[];
  quickAccess: QuickAccessKey[];
}

function isWidgetId(s: string): s is DashboardWidgetId {
  return (DASHBOARD_WIDGET_IDS as readonly string[]).includes(s);
}

function isQuickKey(s: string): s is QuickAccessKey {
  return (QUICK_ACCESS_KEYS as readonly string[]).includes(s);
}

function uniqStrings(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

export function parseDashboardConfig(raw: unknown): ResolvedDashboardConfig {
  const stored = raw && typeof raw === "object" ? (raw as DashboardConfigStored) : {};
  const hidden = stored.hidden ?? {};

  let ordered: DashboardWidgetId[] = [];
  if (Array.isArray(stored.order) && stored.order.length > 0) {
    for (const id of uniqStrings(stored.order.filter((x) => typeof x === "string"))) {
      if (isWidgetId(id) && !hidden[id]) ordered.push(id);
    }
  }
  if (ordered.length === 0) {
    ordered = DEFAULT_DASHBOARD_WIDGET_ORDER.filter((id) => !hidden[id]);
  }

  const quickRaw = Array.isArray(stored.quickAccess) ? stored.quickAccess.filter((x) => typeof x === "string") : [];
  const quickAccess: QuickAccessKey[] = [];
  for (const k of uniqStrings(quickRaw)) {
    if (isQuickKey(k)) quickAccess.push(k);
  }
  if (quickAccess.length === 0) quickAccess.push(...DEFAULT_QUICK_ACCESS_KEYS);

  return { orderedWidgets: ordered, quickAccess };
}

export function buildDashboardConfigPayload(resolved: ResolvedDashboardConfig): DashboardConfigStored {
  return {
    v: 1,
    order: resolved.orderedWidgets,
    quickAccess: resolved.quickAccess,
  };
}

export function mergeDashboardRaw(companyRaw: unknown, userRaw: unknown): unknown {
  if (userRaw == null) return companyRaw;
  if (typeof userRaw !== "object" || userRaw === null || Array.isArray(userRaw)) return companyRaw;
  const u = userRaw as DashboardConfigStored;
  if (Object.keys(u).length === 0) return companyRaw;

  const c =
    companyRaw && typeof companyRaw === "object" && !Array.isArray(companyRaw)
      ? (companyRaw as DashboardConfigStored)
      : undefined;

  const order =
    Array.isArray(u.order) && u.order.length > 0 ? u.order : c?.order;
  const quickAccess =
    Array.isArray(u.quickAccess) && u.quickAccess.length > 0 ? u.quickAccess : c?.quickAccess;
  const hidden = { ...c?.hidden, ...u.hidden };

  const out: DashboardConfigStored = { v: 1 };
  if (order) out.order = order;
  if (quickAccess) out.quickAccess = quickAccess;
  if (Object.keys(hidden).length > 0) out.hidden = hidden;
  return out;
}
