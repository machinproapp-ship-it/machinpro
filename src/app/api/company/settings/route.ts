import { NextRequest, NextResponse } from "next/server";
import { verifyCanManageEmployees } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeCompanySettings, type CompanySettingsJson } from "@/lib/companySettingsTypes";

/**
 * Merge partial settings into companies.settings (JSONB).
 * Requiere JWT + permiso gestión de empleados (misma barra que otros ajustes de empresa).
 */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as { companyId?: string; merge?: Partial<CompanySettingsJson> };
  const companyId = typeof b.companyId === "string" ? b.companyId.trim() : "";
  const merge = b.merge && typeof b.merge === "object" && !Array.isArray(b.merge) ? b.merge : null;
  if (!companyId || !merge) {
    return NextResponse.json({ error: "companyId and merge object required" }, { status: 400 });
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
