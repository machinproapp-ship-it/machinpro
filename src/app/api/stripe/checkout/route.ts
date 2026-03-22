import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAppBaseUrl } from "@/lib/app-url";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyCompanyAccess } from "@/lib/verify-api-session";
import { getStripe, getStripePriceId, type PlanKey } from "@/lib/stripe";
import type { GeoTier } from "@/lib/geoTier";

export const runtime = "nodejs";

type Body = {
  plan: PlanKey;
  period: "monthly" | "annual";
  companyId: string;
  companyName?: string;
  email?: string;
  tier: GeoTier;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { plan, period, companyId, companyName, email, tier } = body;
    if (!plan || !period || !companyId || tier == null) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const ok = await verifyCompanyAccess(req, companyId);
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const stripe = getStripe();
    const admin = createSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const priceId = getStripePriceId(plan, period);
    const base = getAppBaseUrl();

    let customerId: string | undefined;

    const { data: subRow } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("company_id", companyId)
      .maybeSingle();

    if (subRow?.stripe_customer_id) {
      customerId = subRow.stripe_customer_id as string;
    } else {
      try {
        const customers = await stripe.customers.search({
          query: `metadata['company_id']:'${companyId}'`,
          limit: 1,
        });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      } catch {
        const list = await stripe.customers.list({ limit: 100 });
        const found = list.data.find((c) => c.metadata?.company_id === companyId);
        if (found) customerId = found.id;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        name: companyName ?? undefined,
        metadata: {
          company_id: companyId,
          company_name: companyName ?? "",
        },
      });
      customerId = customer.id;
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/billing?canceled=1`,
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          company_id: companyId,
          plan_key: plan,
          billing_period: period,
          geo_tier: String(tier),
        },
      },
      metadata: {
        company_id: companyId,
        plan_key: plan,
        billing_period: period,
        geo_tier: String(tier),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json({ error: "No checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Checkout error";
    console.error("[stripe/checkout]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
