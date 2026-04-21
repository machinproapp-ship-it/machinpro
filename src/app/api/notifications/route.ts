import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getBearerToken,
  getSessionUserAndCompany,
  insertNotificationRow,
  resolveTargetUserId,
  verifyInternalSecret,
} from "@/lib/notifications-server";
import { sendPushToUser } from "@/lib/serverWebPush";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

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

/**
 * GET: últimas 20 notificaciones del usuario + conteo no leídas.
 * POST: crea notificación (JWT mismo company + target en company, o x-internal-secret + service insert via admin).
 */
export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const client = userClient(token);
  if (!client) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const { searchParams } = req.nextUrl;
  const limitRaw = parseInt(searchParams.get("limit") || "30", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 30;
  const offsetRaw = parseInt(searchParams.get("offset") || "0", 10);
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
  const unreadOnly = searchParams.get("unread") === "1";
  const typeFilter = searchParams.get("type")?.trim();

  let listQuery = client
    .from("notifications")
    .select("id, company_id, user_id, type, title, body, data, read, read_at, created_at, expires_at")
    .order("created_at", { ascending: false });
  if (unreadOnly) listQuery = listQuery.eq("read", false);
  if (typeFilter) listQuery = listQuery.eq("type", typeFilter);
  const { data: rows, error } = await listQuery.range(offset, offset + limit - 1);

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return NextResponse.json({ notifications: [], unreadCount: 0, disabled: true, hasMore: false });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let list = (rows ?? []) as Record<string, unknown>[];
  list = list.filter((r) => {
    const d = r.data as Record<string, unknown> | null | undefined;
    return !(d && typeof d === "object" && d.dismissed === true);
  });
  const { count, error: countErr } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);

  const unreadCount = !countErr && typeof count === "number" ? count : list.filter((r) => !r.read).length;
  const hasMore = list.length >= limit;

  return NextResponse.json({
    notifications: list,
    unreadCount,
    hasMore,
  });
}

export async function POST(req: NextRequest) {
  const admin = createSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as {
    companyId?: string;
    targetUserId?: string;
    targetEmployeeKey?: string;
    type?: string;
    title?: string;
    body?: string | null;
    data?: Record<string, unknown>;
    expires_at?: string | null;
  };

  const companyId = typeof b.companyId === "string" ? b.companyId.trim() : "";
  const type = typeof b.type === "string" ? b.type.trim() : "";
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!companyId || !type || !title) {
    return NextResponse.json({ error: "companyId, type and title required" }, { status: 400 });
  }

  const internalOk = await verifyInternalSecret(req);
  let actorCompany: string | null = null;

  if (!internalOk) {
    const session = await getSessionUserAndCompany(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.companyId !== companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    actorCompany = session.companyId;
  }

  const targetKey =
    typeof b.targetUserId === "string" && b.targetUserId.trim()
      ? b.targetUserId.trim()
      : typeof b.targetEmployeeKey === "string"
        ? b.targetEmployeeKey.trim()
        : "";

  if (!targetKey) {
    return NextResponse.json({ error: "targetUserId or targetEmployeeKey required" }, { status: 400 });
  }

  const resolvedUserId = await resolveTargetUserId(admin, companyId, targetKey);
  if (!resolvedUserId) return NextResponse.json({ error: "Target user not found" }, { status: 404 });

  const { data: targetRow } = await admin
    .from("user_profiles")
    .select("company_id")
    .eq("id", resolvedUserId)
    .maybeSingle();
  const tco = targetRow as { company_id?: string | null } | null;
  if (!tco || String(tco.company_id ?? "") !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!internalOk && !actorCompany) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ins = await insertNotificationRow(admin, {
    company_id: companyId,
    user_id: resolvedUserId,
    type,
    title,
    body: b.body ?? null,
    data: b.data,
    expires_at: b.expires_at ?? null,
  });

  if (!ins.ok) return NextResponse.json({ error: ins.error }, { status: 500 });

  const bodyText = b.body != null && String(b.body).trim() ? String(b.body).trim() : title;
  void sendPushToUser(admin, companyId, resolvedUserId, {
    title,
    body: bodyText,
    url: "/",
    type,
  });

  return NextResponse.json({ ok: true, id: ins.id });
}
