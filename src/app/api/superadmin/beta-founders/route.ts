import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperadminAccess } from "@/lib/verify-api-session";

export const runtime = "nodejs";

/** Stripe coupon id BETA_FOUNDER — companies on extended trial / beta pricing (approximation via subscription state). */
export async function GET(req: NextRequest) {
  const auth = await verifySuperadminAccess(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const { data: subs } = await admin
    .from("subscriptions")
    .select("company_id, status, plan, trial_ends_at, current_period_end")
    .or("status.eq.trialing,plan.eq.trial");

  const rows = subs ?? [];
  const companyIds = [...new Set(rows.map((s) => String((s as { company_id?: string }).company_id ?? "").trim()).filter(Boolean))];
  let nameByCompany: Record<string, string> = {};
  if (companyIds.length > 0) {
    const { data: cos } = await admin.from("companies").select("id, name").in("id", companyIds);
    for (const c of cos ?? []) {
      const row = c as { id?: string; name?: string };
      if (row.id) nameByCompany[row.id] = String(row.name ?? "");
    }
  }

  const list = rows.map((s) => {
    const row = s as {
      company_id?: string | null;
      status?: string;
      plan?: string;
      trial_ends_at?: string | null;
      current_period_end?: string | null;
    };
    const cid = String(row.company_id ?? "");
    return {
      company_id: cid,
      company_name: nameByCompany[cid] ?? cid,
      status: row.status ?? "",
      plan: row.plan ?? "",
      trial_ends_at: row.trial_ends_at ?? null,
      coupon_code_label: "BETA_FOUNDER",
      note:
        row.status === "trialing"
          ? "trial"
          : row.plan === "trial"
            ? "trial_plan"
            : "sub",
    };
  });

  return NextResponse.json({ founders: list });
}
