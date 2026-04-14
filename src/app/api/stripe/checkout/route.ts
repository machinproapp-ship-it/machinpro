import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyCompanyAccess } from "@/lib/verify-api-session";
import { getPppTierFromCountryCode } from "@/lib/geoTier";
import {
  getStripe,
  getStripePriceId,
  ensurePppCoupons,
  checkoutDiscountsForTier,
  getPlanFromPriceId,
  resolvePaidPlanForCheckout,
  STRIPE_COUPON_BETA_FOUNDER_ID,
  type PaidPlanKey,
  type BillingPeriod,
} from "@/lib/stripe";
import type { GeoTier } from "@/lib/geoTier";

export const runtime = "nodejs";

function appPublicOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "").trim();
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

type Body = {
  priceId?: string | null;
  countryCode?: string | null;
  /** Alias de `countryCode` (AH-17 PPP). */
  country?: string | null;
  billingCycle?: string | null;
  /** Legacy */
  plan?: PaidPlanKey | string;
  period?: BillingPeriod | string;
  companyId: string;
  companyName?: string;
  email?: string;
  tier?: GeoTier;
  /** Apply Stripe coupon `BETA_FOUNDER` (create in Dashboard with this id). */
  betaFounder?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const {
      priceId: priceIdRaw,
      countryCode: countryCodeRaw,
      country: countryBody,
      billingCycle: billingCycleRaw,
      companyId,
      companyName,
      email,
    } = body;

    if (!companyId?.trim()) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
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

    const ipCountry = (
      req.headers.get("x-vercel-ip-country") ??
      req.headers.get("cf-ipcountry") ??
      ""
    )
      .trim()
      .toUpperCase();
    const bodyCountry =
      typeof countryCodeRaw === "string"
        ? countryCodeRaw.trim().toUpperCase()
        : typeof countryBody === "string"
          ? countryBody.trim().toUpperCase()
          : "";
    const effectiveCountry = bodyCountry || ipCountry || "US";
    const checkoutTier = getPppTierFromCountryCode(effectiveCountry);

    let plan: PaidPlanKey | null;
    let period: BillingPeriod;
    let priceId: string;

    const priceIdStr = typeof priceIdRaw === "string" ? priceIdRaw.trim() : "";
    if (priceIdStr) {
      const parsed = getPlanFromPriceId(priceIdStr);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });
      }
      plan = parsed.plan;
      period = parsed.period;
      priceId = priceIdStr;
    } else {
      plan = resolvePaidPlanForCheckout(typeof body.plan === "string" ? body.plan : "");
      const p =
        typeof body.period === "string" && body.period.trim() === "annual"
          ? "annual"
          : typeof billingCycleRaw === "string" && billingCycleRaw.trim() === "annual"
            ? "annual"
            : "monthly";
      period = p;
      if (!plan) {
        return NextResponse.json({ error: "Missing plan or priceId" }, { status: 400 });
      }
      priceId = getStripePriceId(plan, period);
    }

    await ensurePppCoupons(stripe);
    const betaFounder = body.betaFounder === true;
    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined = betaFounder
      ? [{ coupon: STRIPE_COUPON_BETA_FOUNDER_ID }]
      : checkoutDiscountsForTier(checkoutTier);

    const base = appPublicOrigin();

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
      success_url: `${base}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing`,
      /** Tier 1 sin cupón PPP: el usuario puede introducir `BETA_FOUNDER`. Con PPP o beta UI, no combinar códigos. */
      allow_promotion_codes: !betaFounder && checkoutTier === 1,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          company_id: companyId,
          plan_key: plan,
          billing_period: period,
          geo_tier: String(checkoutTier),
          checkout_country: effectiveCountry,
        },
      },
      metadata: {
        company_id: companyId,
        plan_key: plan,
        billing_period: period,
        geo_tier: String(checkoutTier),
        checkout_country: effectiveCountry,
      },
      ...(discounts ? { discounts } : {}),
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
