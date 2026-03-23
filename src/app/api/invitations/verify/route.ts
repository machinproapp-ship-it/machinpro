import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { InvitationPlan, InvitationStatus } from "@/types/invitation";

export const runtime = "nodejs";

type InvitationVerifyRow = {
  email: string;
  company_name: string;
  plan: InvitationPlan;
  message: string | null;
  status: InvitationStatus;
  expires_at: string;
};

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ valid: false as const, reason: "missing_token" });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ valid: false as const, reason: "server_error" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("invitations")
    .select("email, company_name, plan, message, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ valid: false as const, reason: "not_found" });
  }

  const inv = data as InvitationVerifyRow;
  const now = Date.now();
  const exp = new Date(inv.expires_at).getTime();
  if (exp < now) {
    return NextResponse.json({ valid: false as const, reason: "expired" });
  }
  if (inv.status === "accepted") {
    return NextResponse.json({ valid: false as const, reason: "accepted" });
  }
  if (inv.status === "expired") {
    return NextResponse.json({ valid: false as const, reason: "expired" });
  }

  return NextResponse.json({
    valid: true as const,
    invitation: {
      email: inv.email,
      company_name: inv.company_name,
      plan: inv.plan,
      message: inv.message,
      expires_at: inv.expires_at,
    },
  });
}
