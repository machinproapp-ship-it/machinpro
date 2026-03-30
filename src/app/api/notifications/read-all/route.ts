import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBearerToken } from "@/lib/notifications-server";

export const runtime = "nodejs";

function userClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function PATCH(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const client = userClient(token);
  if (!client) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const now = new Date().toISOString();
  const { error } = await client
    .from("notifications")
    .update({ read: true, read_at: now })
    .eq("read", false);

  if (error) {
    if (error.code === "42P01") return NextResponse.json({ ok: false, disabled: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
