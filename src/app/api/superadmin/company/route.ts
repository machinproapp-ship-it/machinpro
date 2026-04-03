import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperadminAccess } from "@/lib/verify-api-session";
import { getLimitsForPlan, resolvePaidPlanForCheckout, type PaidPlanKey } from "@/lib/stripe";

export const runtime = "nodejs";

type Body = {
  companyId: string;
  action: "extend_trial" | "change_plan" | "cancel";
  planKey?: PaidPlanKey | string;
  /** Days to add to current trial end (or from now if no trial). Capped server-side. */
  days?: number;
  preset?: string;
  internal_note?: string | null;
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
    let extraDays = 14;
    if (body.preset === "beta_founder_90") {
      extraDays = 90;
    } else if (typeof body.days === "number" && Number.isFinite(body.days)) {
      const n = Math.floor(body.days);
      if (n > 0 && n <= 365) extraDays = n;
    }
    const base = sub?.trial_ends_at ? new Date(sub.trial_ends_at as string) : new Date();
    const end = new Date(base.getTime() + extraDays * 86400000).toISOString();
    const lim = getLimitsForPlan("esencial");
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
    const note = typeof body.internal_note === "string" ? body.internal_note.trim() || null : null;
    await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: auth.userId,
      user_name: "superadmin",
      action: "superadmin_trial_extended",
      entity_type: "company",
      entity_id: companyId,
      new_value: {
        trial_ends_at: end,
        days_added: extraDays,
        preset: body.preset ?? null,
        internal_note: note,
      },
    });
    return NextResponse.json({ ok: true, trial_ends_at: end, days_added: extraDays });
  }

  if (action === "change_plan") {
    const pk = resolvePaidPlanForCheckout(typeof planKey === "string" ? planKey : "");
    if (!pk) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    const limits = getLimitsForPlan(pk);
    await admin
      .from("companies")
      .update({ plan: pk })
      .eq("id", companyId);
    const patch = {
      plan: pk,
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
      new_value: { plan: pk },
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
