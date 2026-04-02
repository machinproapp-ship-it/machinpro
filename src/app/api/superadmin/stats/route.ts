import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperadminAccess } from "@/lib/verify-api-session";
import { PAID_PLAN_ORDER, PLAN_PRICES_CAD, type PaidPlanKey } from "@/lib/stripe";

export const runtime = "nodejs";

function planKeyFromRow(plan: string | null | undefined): PaidPlanKey | "trial" | null {
  const q = (plan ?? "").toLowerCase().trim();
  if (q === "trial") return "trial";
  if ((PAID_PLAN_ORDER as string[]).includes(q)) return q as PaidPlanKey;
  if (q === "starter" || q === "foundation" || q === "horarios") return "esencial";
  if (q === "pro" || q === "professional" || q === "obras") return "operaciones";
  if (q === "enterprise") return "todo_incluido";
  return null;
}

function monthlyEquivalentMrr(plan: PaidPlanKey, billingPeriod: string | null | undefined): number {
  const prices = PLAN_PRICES_CAD[plan];
  if (billingPeriod === "annual") return Math.round((prices.annual / 12) * 10) / 10;
  return prices.monthly;
}

export async function GET(_req: NextRequest) {
  const auth = await verifySuperadminAccess(_req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: companies, error: cErr } = await admin.from("companies").select("id");
  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const { count: userTotal, error: uErr } = await admin
    .from("user_profiles")
    .select("id", { count: "exact", head: true });
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  const { data: subs } = await admin.from("subscriptions").select("*");
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  let mrrCad = 0;
  let trialsActive = 0;
  let conversionsWeek = 0;

  const planDist: Record<string, number> = { trial: 0, other: 0 };
  for (const k of PAID_PLAN_ORDER) planDist[k] = 0;

  for (const s of subs ?? []) {
    const row = s as {
      status: string;
      plan: string;
      billing_period: string | null;
      updated_at?: string;
    };
    if (row.status === "trialing") trialsActive += 1;
    if (row.status === "active") {
      const pk = planKeyFromRow(row.plan);
      if (pk && pk !== "trial") mrrCad += monthlyEquivalentMrr(pk, row.billing_period);
    }
    const updated = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    if (row.status === "active" && updated >= weekAgo) conversionsWeek += 1;

    const distKey = planKeyFromRow(row.plan);
    if (row.status === "trialing" || distKey === "trial") {
      planDist.trial += 1;
    } else if (distKey && distKey in planDist) {
      planDist[distKey] += 1;
    } else {
      planDist.other += 1;
    }
  }

  return NextResponse.json({
    totalCompanies: companies?.length ?? 0,
    totalUsers: userTotal ?? 0,
    mrrCadApprox: Math.round(mrrCad),
    trialsActive,
    conversionsWeek,
    planDistribution: planDist,
  });
}
