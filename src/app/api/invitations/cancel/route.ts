import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperadminAccess } from "@/lib/verify-api-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await verifySuperadminAccess(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: { invitationId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const invitationId = typeof body.invitationId === "string" ? body.invitationId.trim() : "";
  if (!invitationId) {
    return NextResponse.json({ error: "Missing invitationId" }, { status: 400 });
  }

  const { error } = await admin
    .from("invitations")
    .update({ status: "expired" })
    .eq("id", invitationId)
    .in("status", ["pending"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
