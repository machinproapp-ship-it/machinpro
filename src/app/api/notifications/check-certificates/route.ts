import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { runCertificateNotificationsForCompany } from "@/lib/certificate-notifications";
import { getSessionUserAndCompany, verifyCronSecret } from "@/lib/notifications-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const admin = createSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const cronOk = verifyCronSecret(req);
  let companyId = "";

  if (cronOk) {
    companyId = req.nextUrl.searchParams.get("companyId")?.trim() ?? "";
    if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  } else {
    const session = await getSessionUserAndCompany(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: me } = await admin.from("user_profiles").select("role").eq("id", session.userId).maybeSingle();
    const role = String((me as { role?: string } | null)?.role ?? "").toLowerCase();
    if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    companyId = session.companyId;
  }

  const result = await runCertificateNotificationsForCompany(admin, companyId);
  const status = result.errors.length > 0 && result.created === 0 ? 500 : 200;
  return NextResponse.json({ ok: status === 200, companyId, ...result }, { status });
}
