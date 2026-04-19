import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getBearerToken } from "@/lib/notifications-server";

export const runtime = "nodejs";

/** Soft-hide: merges `data.dismissed = true` for the owner's row. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const { createClient } = await import("@supabase/supabase-js");
  const authClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: uErr,
  } = await authClient.auth.getUser();
  if (uErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const { data: row, error: fErr } = await admin
    .from("notifications")
    .select("id, user_id, data")
    .eq("id", id)
    .maybeSingle();
  if (fErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const uid = String((row as { user_id?: string }).user_id ?? "");
  if (uid !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const prevData =
    row.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {};
  const nextData = { ...prevData, dismissed: true };

  const { error: uErr2 } = await admin.from("notifications").update({ data: nextData }).eq("id", id);
  if (uErr2) return NextResponse.json({ error: uErr2.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
