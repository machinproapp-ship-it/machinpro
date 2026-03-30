import { NextRequest, NextResponse } from "next/server";
import { runCertificateNotificationsForCompany } from "@/lib/certificate-notifications";
import { verifyCronSecret } from "@/lib/notifications-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * Vercel Cron (daily). Requires header `x-cron-secret: $CRON_SECRET`.
 * Runs certificate expiry checks for every active company.
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
  const results: { companyId: string; created: number; errors: string[] }[] = [];
  for (const row of list) {
    const companyId = String(row.id);
    const r = await runCertificateNotificationsForCompany(admin, companyId);
    results.push({ companyId, created: r.created, errors: r.errors });
  }

  return NextResponse.json({
    ok: true,
    companies: list.length,
    results,
  });
}
