import { NextRequest, NextResponse } from "next/server";
import { verifyCompanyAdmin } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function nonEmpty(s: unknown): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * GET ?companyId= — admin only. Returns booleans for 5 onboarding checklist steps.
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
    const [{ data: co }, { data: otherEmps }, { count: projCount }, { count: timeCount }, { count: photoCount }] =
      await Promise.all([
        admin.from("companies").select("name, address, onboarding_complete").eq("id", companyId).maybeSingle(),
        admin
          .from("user_profiles")
          .select("id, profile_status")
          .eq("company_id", companyId)
          .neq("role", "admin"),
        admin
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("archived", false),
        admin
          .from("time_entries")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("user_id", auth.userId),
        admin
          .from("project_photos")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId),
      ]);

    const row = co as { name?: string | null; address?: string | null; onboarding_complete?: boolean | null } | null;
    const step1 = !!(row && nonEmpty(row.name) && nonEmpty(row.address));

    const empRows = (otherEmps ?? []) as { profile_status?: string | null }[];
    const step2 = empRows.some((r) => {
      const st = (r.profile_status ?? "active").toLowerCase().trim();
      return st === "active";
    });

    const step3 = (projCount ?? 0) > 0;
    const step4 = (timeCount ?? 0) > 0;
    const step5 = (photoCount ?? 0) > 0;

    const steps = [step1, step2, step3, step4, step5] as const;
    const done = steps.filter(Boolean).length;

    return NextResponse.json({
      steps: [...steps],
      done,
      total: 5,
      onboardingComplete: row?.onboarding_complete === true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Query failed";
    console.error("[getting-started]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
