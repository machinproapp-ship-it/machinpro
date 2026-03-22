import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getLimitsForPlan, getPlanFromPriceId, getStripe } from "@/lib/stripe";
import type { PlanKey } from "@/lib/stripe";

export const runtime = "nodejs";

function mapStripeStatus(
  s: Stripe.Subscription.Status
): "trialing" | "active" | "past_due" | "canceled" | "unpaid" {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "active";
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET missing");
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
  }

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid payload";
    console.error("[stripe/webhook] verify", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(admin, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await markSubscriptionCanceled(admin, sub);
        break;
      }
      default:
        break;
    }
  } catch (e: unknown) {
    console.error("[stripe/webhook] handler", e);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Campos de periodo (tipos Clover pueden omitirlos; el payload webhook sigue incluyéndolos). */
function subscriptionPeriodTimestamps(sub: Stripe.Subscription): {
  start: number | null;
  end: number | null;
  trialEnd: number | null;
} {
  const raw = sub as unknown as Record<string, unknown>;
  const start = typeof raw.current_period_start === "number" ? raw.current_period_start : null;
  const end = typeof raw.current_period_end === "number" ? raw.current_period_end : null;
  const trialEnd = typeof raw.trial_end === "number" ? raw.trial_end : null;
  return { start, end, trialEnd };
}

async function syncSubscription(admin: ReturnType<typeof createSupabaseAdmin>, sub: Stripe.Subscription) {
  if (!admin) return;

  const { start: cps, end: cpe, trialEnd } = subscriptionPeriodTimestamps(sub);

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const mapped = getPlanFromPriceId(priceId);
  const plan: PlanKey = mapped?.plan ?? "starter";
  const billing_period = mapped?.period ?? "monthly";

  const limits = getLimitsForPlan(plan);
  const companyId = sub.metadata?.company_id;
  let resolvedCompanyId = companyId;

  if (!resolvedCompanyId && sub.customer) {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(sub.customer as string);
    if (!customer.deleted && "metadata" in customer) {
      resolvedCompanyId = customer.metadata?.company_id ?? undefined;
    }
  }

  if (!resolvedCompanyId) {
    console.warn("[stripe/webhook] No company_id on subscription", sub.id);
    return;
  }

  const geoTierRaw = sub.metadata?.geo_tier;
  const geo_tier = geoTierRaw != null ? parseInt(String(geoTierRaw), 10) : 1;

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("company_id", resolvedCompanyId)
    .maybeSingle();

  const row = {
    id: (existing?.id as string | undefined) ?? crypto.randomUUID(),
    company_id: resolvedCompanyId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    plan,
    status: mapStripeStatus(sub.status),
    billing_period,
    trial_ends_at: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
    current_period_start: cps ? new Date(cps * 1000).toISOString() : null,
    current_period_end: cpe ? new Date(cpe * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    seats_limit: limits.seats_limit,
    projects_limit: limits.projects_limit,
    storage_limit_gb: limits.storage_limit_gb,
    geo_tier: Number.isFinite(geo_tier) ? geo_tier : 1,
  };

  const { error } = await admin.from("subscriptions").upsert(row, { onConflict: "company_id" });
  if (error) {
    console.error("[stripe/webhook] upsert", error);
    throw error;
  }
}

async function markSubscriptionCanceled(admin: ReturnType<typeof createSupabaseAdmin>, sub: Stripe.Subscription) {
  if (!admin) return;
  const companyId = sub.metadata?.company_id;
  if (!companyId) {
    const { data: bySub } = await admin
      .from("subscriptions")
      .select("company_id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();
    if (!bySub?.company_id) {
      console.warn("[stripe/webhook] delete: no company", sub.id);
      return;
    }
    await admin
      .from("subscriptions")
      .update({ status: "canceled", plan: "trial" })
      .eq("stripe_subscription_id", sub.id);
    return;
  }

  await admin
    .from("subscriptions")
    .update({ status: "canceled", plan: "trial" })
    .eq("company_id", companyId);
}
