import { NextRequest, NextResponse } from "next/server";
import { verifyCompanyAdmin } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { PAID_PLAN_ORDER, type PaidPlanKey } from "@/lib/stripe";
import type { MainSection } from "@/types/shared";

export const runtime = "nodejs";

function planKeyFromRow(plan: string | null | undefined): PaidPlanKey {
  const q = (plan ?? "").toLowerCase().trim();
  if ((PAID_PLAN_ORDER as string[]).includes(q)) return q as PaidPlanKey;
  if (q === "starter" || q === "foundation" || q === "horarios") return "esencial";
  if (q === "pro" || q === "professional" || q === "obras") return "operaciones";
  if (q === "enterprise") return "todo_incluido";
  return "esencial";
}

export type GettingStartedItem = {
  id: number;
  done: boolean;
  section: MainSection;
};

/**
 * GET ?companyId= — admin only. Plan-aware onboarding checklist.
 */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId")?.trim() ?? "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const auth = await verifyCompanyAdmin(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const { data: subRaw } = await admin.from("subscriptions").select("plan").eq("company_id", companyId).maybeSingle();
    const plan = planKeyFromRow((subRaw as { plan?: string } | null)?.plan ?? null);

    const includeOps = plan === "operaciones" || plan === "logistica" || plan === "todo_incluido";
    const includeLogistics = plan === "logistica" || plan === "todo_incluido";
    const includeSecurity = plan === "todo_incluido";

    const [
      { data: companyRow },
      { count: customRoleCount },
      { count: workerCount },
      { count: assignedRoleCount },
      { count: shiftCount },
      { count: certCount },
      { count: projCount },
      { data: projAssignRows },
      { count: invCount },
      { count: hazCount },
    ] = await Promise.all([
      admin.from("companies").select("name").eq("id", companyId).maybeSingle(),
      admin
        .from("roles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("is_system", false),
      admin
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .neq("role", "admin")
        .not("profile_status", "eq", "inactive"),
      admin
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .not("custom_role_id", "is", null),
      admin
        .from("schedule_entries")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("type", "shift"),
      admin.from("certificates").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      admin
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("archived", false),
      admin
        .from("projects")
        .select("assigned_employee_ids")
        .eq("company_id", companyId)
        .eq("archived", false),
      admin.from("inventory_items").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      admin.from("hazards").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    ]);

    const companyName = ((companyRow as { name?: string } | null)?.name ?? "").trim();
    const step1 = companyName.length > 0;
    const step2 = (customRoleCount ?? 0) >= 1;
    const step3 = (workerCount ?? 0) >= 1;
    const step4 = (assignedRoleCount ?? 0) >= 1;
    const step5 = (shiftCount ?? 0) >= 1;
    const step6 = (certCount ?? 0) >= 1;

    let step7 = (projCount ?? 0) >= 1;
    const rows = (projAssignRows ?? []) as { assigned_employee_ids?: string[] | null }[];
    let step8 = rows.some((r) => Array.isArray(r.assigned_employee_ids) && r.assigned_employee_ids.length > 0);
    const step9 = (invCount ?? 0) >= 1;
    const step10 = (hazCount ?? 0) >= 1;

    const base: GettingStartedItem[] = [
      { id: 1, done: step1, section: "settings" },
      { id: 2, done: step2, section: "office" },
      { id: 3, done: step3, section: "employees" },
      { id: 4, done: step4, section: "office" },
      { id: 5, done: step5, section: "schedule" },
      { id: 6, done: step6, section: "settings" },
    ];

    const items: GettingStartedItem[] = [...base];

    if (includeOps) {
      items.push(
        { id: 7, done: step7, section: "site" },
        { id: 8, done: step8, section: "site" }
      );
    }

    if (includeLogistics) {
      items.push({ id: 9, done: step9, section: "warehouse" });
    }

    if (includeSecurity) {
      items.push({ id: 10, done: step10, section: "hazards" });
    }

    const done = items.filter((x) => x.done).length;
    const total = items.length;

    return NextResponse.json({
      plan,
      items,
      steps: items.map((x) => x.done),
      done,
      total,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Query failed";
    console.error("[getting-started]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
