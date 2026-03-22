import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperadminAccess } from "@/lib/verify-api-session";
import { getLimitsForPlan, type PlanKey } from "@/lib/stripe";

export const runtime = "nodejs";

type Body = {
  companyId: string;
  action: "extend_trial" | "change_plan" | "cancel";
  planKey?: PlanKey;
};

export async function POST(req: NextRequest) {
  const auth = await verifySuperadminAccess(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { companyId, action, planKey } = body;
  if (!companyId || !action) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: sub } = await admin.from("subscriptions").select("*").eq("company_id", companyId).maybeSingle();

  if (action === "extend_trial") {
    const extraDays = 14;
    const base = sub?.trial_ends_at ? new Date(sub.trial_ends_at as string) : new Date();
    const end = new Date(base.getTime() + extraDays * 86400000).toISOString();
    const lim = getLimitsForPlan("starter");
    if (sub) {
      await admin.from("subscriptions").update({ trial_ends_at: end, status: "trialing" }).eq("company_id", companyId);
    } else {
      await admin.from("subscriptions").insert({
        company_id: companyId,
        plan: "trial",
        status: "trialing",
        trial_ends_at: end,
        seats_limit: lim.seats_limit,
        projects_limit: lim.projects_limit,
        storage_limit_gb: lim.storage_limit_gb,
        geo_tier: 1,
      });
    }
    await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: auth.userId,
      user_name: "superadmin",
      action: "superadmin_trial_extended",
      entity_type: "company",
      entity_id: companyId,
      new_value: { trial_ends_at: end },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "change_plan") {
    if (!planKey || !["starter", "pro", "enterprise"].includes(planKey)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    const limits = getLimitsForPlan(planKey);
    await admin
      .from("companies")
      .update({ plan: planKey === "pro" ? "professional" : planKey })
      .eq("id", companyId);
    const patch = {
      plan: planKey,
      seats_limit: limits.seats_limit,
      projects_limit: limits.projects_limit,
      storage_limit_gb: limits.storage_limit_gb,
    };
    if (sub) {
      await admin.from("subscriptions").update(patch).eq("company_id", companyId);
    } else {
      await admin.from("subscriptions").insert({
        company_id: companyId,
        status: "trialing",
        ...patch,
      });
    }
    await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: auth.userId,
      user_name: "superadmin",
      action: "superadmin_plan_changed",
      entity_type: "company",
      entity_id: companyId,
      new_value: { plan: planKey },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    if (sub) {
      await admin
        .from("subscriptions")
        .update({ status: "canceled", cancel_at_period_end: false })
        .eq("company_id", companyId);
    }
    await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: auth.userId,
      user_name: "superadmin",
      action: "superadmin_subscription_canceled",
      entity_type: "company",
      entity_id: companyId,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
