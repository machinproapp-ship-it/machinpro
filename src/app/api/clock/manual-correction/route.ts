import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServiceRole } from "@/lib/supabase-admin";
import type { RolePermissions } from "@/types/roles";

export const runtime = "nodejs";

type PostBody = {
  companyId?: string;
  timeEntryId?: string;
  clockInIso?: string;
  clockOutIso?: string;
  note?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

async function bearerSession(req: NextRequest): Promise<{ userId: string } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { userId: user.id };
}

function allowsCorrection(opts: {
  viewerId: string;
  entryUserId: string;
  entryDayYmd: string;
  todayYmdUtc: string;
  role: string;
  useInherit: boolean;
  custom: Partial<RolePermissions> | null;
}): boolean {
  const { viewerId, entryUserId, entryDayYmd, todayYmdUtc, role, useInherit, custom } = opts;
  if (viewerId === entryUserId && entryDayYmd === todayYmdUtc) return true;
  if (role === "admin") return true;
  if (!useInherit && custom?.canManageTeamAvailability === true) return true;
  if (useInherit && role === "supervisor") return true;
  return false;
}

export async function POST(req: NextRequest) {
  const sess = await bearerSession(req);
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const timeEntryId = typeof body.timeEntryId === "string" ? body.timeEntryId.trim() : "";
  const clockInIso = typeof body.clockInIso === "string" ? body.clockInIso.trim() : "";
  const clockOutIso = typeof body.clockOutIso === "string" ? body.clockOutIso.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!companyId || !timeEntryId || !clockInIso || !clockOutIso || !note) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const newIn = new Date(clockInIso);
  const newOut = new Date(clockOutIso);
  if (Number.isNaN(newIn.getTime()) || Number.isNaN(newOut.getTime())) {
    return NextResponse.json({ error: "Invalid timestamps" }, { status: 400 });
  }
  if (newOut.getTime() <= newIn.getTime()) {
    return NextResponse.json({ error: "clock_out_must_be_after_in" }, { status: 400 });
  }

  const admin = createSupabaseServiceRole();
  if (!admin) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const { data: prof } = await admin
    .from("user_profiles")
    .select("company_id, role, use_role_permissions, custom_permissions, employee_id, full_name")
    .eq("id", sess.userId)
    .maybeSingle();

  const profile = prof as {
    company_id?: string | null;
    role?: string | null;
    use_role_permissions?: boolean | null;
    custom_permissions?: Partial<RolePermissions> | null;
    employee_id?: string | null;
    full_name?: string | null;
  } | null;

  if (!profile?.company_id || String(profile.company_id) !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = String(profile.role ?? "worker");
  const useInherit = profile.use_role_permissions !== false;
  const custom = profile.custom_permissions ?? null;

  const { data: teRaw, error: teErr } = await admin
    .from("time_entries")
    .select("id, user_id, company_id, project_id, clock_in_at, clock_out_at")
    .eq("id", timeEntryId)
    .maybeSingle();

  if (teErr || !teRaw) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const te = teRaw as {
    id: string;
    user_id: string;
    company_id: string;
    project_id: string | null;
    clock_in_at: string;
    clock_out_at: string | null;
  };

  if (te.company_id !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!te.clock_out_at) {
    return NextResponse.json({ error: "Shift not completed" }, { status: 409 });
  }

  const entryIn = new Date(te.clock_in_at);
  const entryDayYmd = `${entryIn.getUTCFullYear()}-${pad2(entryIn.getUTCMonth() + 1)}-${pad2(entryIn.getUTCDate())}`;
  const today = new Date();
  const todayYmdUtc = `${today.getUTCFullYear()}-${pad2(today.getUTCMonth() + 1)}-${pad2(today.getUTCDate())}`;

  if (
    !allowsCorrection({
      viewerId: sess.userId,
      entryUserId: te.user_id,
      entryDayYmd,
      todayYmdUtc,
      role,
      useInherit,
      custom,
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const prevIn = te.clock_in_at;
  const prevOut = te.clock_out_at;

  const newInIso = newIn.toISOString();
  const newOutIso = newOut.toISOString();

  const { error: upErr } = await admin
    .from("time_entries")
    .update({
      clock_in_at: newInIso,
      clock_out_at: newOutIso,
      status: "manual",
      notes: note.slice(0, 2000),
    })
    .eq("id", timeEntryId)
    .eq("company_id", companyId);

  if (upErr) {
    console.error("[clock/manual-correction] update", upErr);
    return NextResponse.json({ error: upErr.message ?? "Update failed" }, { status: 500 });
  }

  const empId =
    profile.employee_id != null && String(profile.employee_id).trim()
      ? String(profile.employee_id)
      : sess.userId;

  const rowId = `ce_${crypto.randomUUID().replace(/-/g, "")}`;
  const payload = {
    note,
    previous_clock_in_at: prevIn,
    previous_clock_out_at: prevOut,
    corrected_clock_in_at: newInIso,
    corrected_clock_out_at: newOutIso,
  };

  /** Same calendar day as original entry start (UTC) */
  const dateStr = entryDayYmd;

  const { error: ceErr } = await admin.from("clock_entries").insert({
    id: rowId,
    employee_id: empId,
    project_id: te.project_id,
    project_code: null,
    date: dateStr,
    clock_in: `${pad2(newIn.getUTCHours())}:${pad2(newIn.getUTCMinutes())}:00`,
    clock_out: `${pad2(newOut.getUTCHours())}:${pad2(newOut.getUTCMinutes())}:00`,
    event_kind: "manual_correction",
    parent_time_entry_id: timeEntryId,
    event_payload: payload,
  });

  if (ceErr) {
    console.error("[clock/manual-correction] clock_entries insert", ceErr);
    return NextResponse.json({ error: ceErr.message ?? "Correction log failed" }, { status: 500 });
  }

  const { error: auditErr } = await admin.from("audit_logs").insert({
    company_id: companyId,
    user_id: sess.userId,
    user_name: profile.full_name?.trim() ?? null,
    action: "clock_manual_correction",
    entity_type: "clock_entry",
    entity_id: rowId,
    new_value: {
      time_entry_id: timeEntryId,
      note,
      payload,
    },
  });
  if (auditErr) console.error("[clock/manual-correction] audit", auditErr);

  return NextResponse.json({ ok: true });
}
