import { NextRequest, NextResponse } from "next/server";
import { runCronNotificationsForCompany } from "@/lib/cron-notifications-eval";
import { verifyCronSecret } from "@/lib/notifications-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * Vercel Cron (hourly). Requires header `x-cron-secret: $CRON_SECRET`.
 * Evaluates inventory, certificates, training, clock, forms; inserts notifications + web push.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const { data: companies, error } = await admin.from("companies").select("id").eq("is_active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (companies ?? []) as { id: string }[];
  const results: { companyId: string; created: number; skipped: string[] }[] = [];
  for (const row of list) {
    const companyId = String(row.id);
    const r = await runCronNotificationsForCompany(admin, companyId);
    results.push({ companyId, created: r.created, skipped: r.skipped });
  }

  return NextResponse.json({
    ok: true,
    companies: list.length,
    results,
  });
}
