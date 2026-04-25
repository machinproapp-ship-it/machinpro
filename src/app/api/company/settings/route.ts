import { NextRequest, NextResponse } from "next/server";
import { verifyCanManageEmployees, verifyCompanyMembership } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeCompanySettings, type CompanySettingsJson } from "@/lib/companySettingsTypes";

const SETTINGS_KEYS = new Set(["defaultVacationDays", "weeklyHoursGoal", "dashboardWidgets"] as const);

type SettingsKey = "defaultVacationDays" | "weeklyHoursGoal" | "dashboardWidgets";

function applyMerge(prev: CompanySettingsJson, merge: Partial<CompanySettingsJson>): CompanySettingsJson {
  const next: CompanySettingsJson = { ...prev };
  if (merge.defaultVacationDays !== undefined) {
    const n = Number(merge.defaultVacationDays);
    if (Number.isFinite(n) && n >= 0 && n <= 366) {
      next.defaultVacationDays = Math.round(n);
    }
  }
  if (merge.weeklyHoursGoal !== undefined) {
    const n = Number(merge.weeklyHoursGoal);
    if (Number.isFinite(n) && n >= 1 && n <= 168) {
      next.weeklyHoursGoal = Math.round(n);
    }
  }
  if (merge.dashboardWidgets !== undefined) {
    if (Array.isArray(merge.dashboardWidgets) && merge.dashboardWidgets.every((x) => typeof x === "string")) {
      next.dashboardWidgets = merge.dashboardWidgets as string[];
    }
  }
  return next;
}

async function auditSettings(
  admin: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
  companyId: string,
  userId: string,
  payload: { key: string; value: unknown }
) {
  const { data: prof } = await admin
    .from("user_profiles")
    .select("full_name, display_name, email")
    .eq("id", userId)
    .maybeSingle();
  const p = prof as { full_name?: string | null; display_name?: string | null; email?: string | null } | null;
  const userName =
    (p?.full_name || p?.display_name || p?.email || userId).trim() || userId;
  const { error } = await admin.from("audit_logs").insert({
    company_id: companyId,
    user_id: userId,
    user_name: userName,
    action: "company_settings_updated",
    entity_type: "company_settings",
    entity_id: companyId,
    new_value: payload,
  });
  if (error) console.error("[company/settings] audit", error);
}

/** Cualquier miembro de la empresa puede leer settings (solo lectura). */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId")?.trim() ?? "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }
  const auth = await verifyCompanyMembership(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const { data: row, error: rErr } = await admin
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }
  const settings = normalizeCompanySettings((row as { settings?: unknown } | null)?.settings);
  return NextResponse.json({ settings });
}

/**
 * PATCH: `{ companyId, merge }` (objeto parcial) o `{ companyId, key, value }` (una clave).
 * Requiere permiso de gestión de empleados.
 */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as {
    companyId?: string;
    merge?: Partial<CompanySettingsJson>;
    key?: string;
    value?: unknown;
  };
  const companyId = typeof b.companyId === "string" ? b.companyId.trim() : "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const auth = await verifyCanManageEmployees(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: row, error: rErr } = await admin
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }

  const prev = normalizeCompanySettings((row as { settings?: unknown } | null)?.settings);
  let next: CompanySettingsJson;

  const keyRaw = typeof b.key === "string" ? b.key.trim() : "";
  if (keyRaw && SETTINGS_KEYS.has(keyRaw as SettingsKey)) {
    const key = keyRaw as SettingsKey;
    if (key === "dashboardWidgets") {
      if (!Array.isArray(b.value) || !b.value.every((x) => typeof x === "string")) {
        return NextResponse.json({ error: "dashboardWidgets must be string[]" }, { status: 400 });
      }
      next = applyMerge(prev, { dashboardWidgets: b.value as string[] });
    } else if (key === "defaultVacationDays") {
      const n = Number(b.value);
      if (!Number.isFinite(n) || n < 0 || n > 366) {
        return NextResponse.json({ error: "invalid defaultVacationDays" }, { status: 400 });
      }
      next = applyMerge(prev, { defaultVacationDays: Math.round(n) });
    } else {
      const n = Number(b.value);
      if (!Number.isFinite(n) || n < 1 || n > 168) {
        return NextResponse.json({ error: "invalid weeklyHoursGoal" }, { status: 400 });
      }
      next = applyMerge(prev, { weeklyHoursGoal: Math.round(n) });
    }
    await auditSettings(admin, companyId, auth.userId, { key, value: b.value });
  } else {
    const merge = b.merge && typeof b.merge === "object" && !Array.isArray(b.merge) ? b.merge : null;
    if (!merge) {
      return NextResponse.json({ error: "companyId and merge or key/value required" }, { status: 400 });
    }
    next = applyMerge(prev, merge);
    await auditSettings(admin, companyId, auth.userId, { key: "merge", value: merge });
  }

  const { error: uErr, data: updated } = await admin
    .from("companies")
    .update({ settings: next })
    .eq("id", companyId)
    .select("settings")
    .maybeSingle();
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Company not found or not updated" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    settings: normalizeCompanySettings((updated as { settings?: unknown }).settings),
  });
}
