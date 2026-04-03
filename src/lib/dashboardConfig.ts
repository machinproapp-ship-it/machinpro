/**
 * Central dashboard layout — persisted in companies.dashboard_config
 * and optionally user_profiles.dashboard_config (user overrides company).
 */

export const DASHBOARD_WIDGET_IDS = [
  "team_timeclock",
  "my_timeclock",
  "activity",
  "compliance_alerts",
  "hazards",
  "visitors",
  "my_tasks",
  "daily_report",
  "critical_inventory",
  "quick_access",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

const LEGACY_WIDGET_EXPAND: Record<string, DashboardWidgetId[]> = {
  timeclock: ["team_timeclock", "my_timeclock"],
  activity: ["activity"],
  alerts: ["compliance_alerts"],
  hazards: ["hazards"],
  actions: [],
  visitors: ["visitors"],
  blueprints: [],
  subscription: [],
  quickaccess: ["quick_access"],
};

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

function expandStoredWidgetId(id: string): DashboardWidgetId[] {
  if (isWidgetId(id)) return [id];
  const leg = LEGACY_WIDGET_EXPAND[id];
  if (leg) return leg.filter((x) => (DASHBOARD_WIDGET_IDS as readonly string[]).includes(x));
  return [];
}

export function parseDashboardConfig(raw: unknown): ResolvedDashboardConfig {
  const stored = raw && typeof raw === "object" ? (raw as DashboardConfigStored) : {};
  const hidden = stored.hidden ?? {};

  let ordered: DashboardWidgetId[] = [];
  const orderKeyPresent = Object.prototype.hasOwnProperty.call(stored, "order") && Array.isArray(stored.order);
  // Explicit `order: []` means all widgets off; omitted order falls back to defaults.
  if (orderKeyPresent) {
    for (const id of uniqStrings((stored.order ?? []).filter((x) => typeof x === "string"))) {
      const expanded = expandStoredWidgetId(id);
      for (const w of expanded) {
        if (!hidden[w] && !ordered.includes(w)) ordered.push(w);
      }
    }
  } else {
    ordered = DEFAULT_DASHBOARD_WIDGET_ORDER.filter((id) => !hidden[id]);
  }

  const quickAccess: QuickAccessKey[] = [];
  const qaKeyPresent =
    Object.prototype.hasOwnProperty.call(stored, "quickAccess") && Array.isArray(stored.quickAccess);
  if (qaKeyPresent) {
    for (const k of uniqStrings((stored.quickAccess ?? []).filter((x) => typeof x === "string"))) {
      if (isQuickKey(k)) quickAccess.push(k);
    }
  } else {
    quickAccess.push(...DEFAULT_QUICK_ACCESS_KEYS);
  }

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
    Object.prototype.hasOwnProperty.call(u, "order") && Array.isArray(u.order) ? u.order : c?.order;
  const quickAccess =
    Object.prototype.hasOwnProperty.call(u, "quickAccess") && Array.isArray(u.quickAccess)
      ? u.quickAccess
      : c?.quickAccess;
  const hidden = { ...c?.hidden, ...u.hidden };

  const out: DashboardConfigStored = { v: 1 };
  if (order) out.order = order;
  if (quickAccess) out.quickAccess = quickAccess;
  if (Object.keys(hidden).length > 0) out.hidden = hidden;
  return out;
}
