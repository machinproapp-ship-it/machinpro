import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Body = {
  visitorId?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const visitorId = body.visitorId;
  if (!visitorId || typeof visitorId !== "string") {
    return NextResponse.json({ error: "visitorId required" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const checkOut = new Date().toISOString();

  const { data, error } = await admin
    .from("visitor_logs")
    .update({ check_out: checkOut, status: "checked_out" })
    .eq("id", visitorId)
    .eq("status", "checked_in")
    .select("id, visitor_name, check_in, check_out, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Visitor not found or already checked out" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, visitor: data });
}
