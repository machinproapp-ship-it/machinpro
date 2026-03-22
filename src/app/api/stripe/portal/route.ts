import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyCompanyAccess } from "@/lib/verify-api-session";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

type Body = { companyId: string };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { companyId } = body;
    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
    }

    const ok = await verifyCompanyAccess(req, companyId);
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const admin = createSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const { data: subRow, error } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("company_id", companyId)
      .maybeSingle();

    if (error || !subRow?.stripe_customer_id) {
      return NextResponse.json({ error: "No billing customer" }, { status: 404 });
    }

    const stripe = getStripe();
    const base = getAppBaseUrl();
    const portal = await stripe.billingPortal.sessions.create({
      customer: subRow.stripe_customer_id as string,
      return_url: `${base}/billing`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Portal error";
    console.error("[stripe/portal]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
