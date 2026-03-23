import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperadminAccess } from "@/lib/verify-api-session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await verifySuperadminAccess(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("invitations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let pendingCount = 0;
  let acceptedThisMonth = 0;
  for (const r of rows) {
    const row = r as { status?: string; expires_at?: string; accepted_at?: string | null };
    const pending =
      row.status === "pending" && row.expires_at && new Date(row.expires_at).getTime() >= now.getTime();
    if (pending) pendingCount += 1;
    if (row.status === "accepted" && row.accepted_at) {
      if (new Date(row.accepted_at).getTime() >= startOfMonth) acceptedThisMonth += 1;
    }
  }

  return NextResponse.json({
    invitations: rows,
    pendingCount,
    acceptedThisMonth,
  });
}
