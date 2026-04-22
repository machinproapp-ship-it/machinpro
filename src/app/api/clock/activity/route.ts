import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBearerToken } from "@/lib/notifications-server";
import { createSupabaseServiceRole } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type PostBody = {
  companyId?: string;
  timeEntryId?: string;
  action?: "break_toggle" | "project_switch";
  /** For project_switch */
  toProjectId?: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

async function sessionUserCompany(req: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const admin = createSupabaseServiceRole();
  if (!admin) return null;
  const { data } = await admin.from("user_profiles").select("company_id").eq("id", user.id).maybeSingle();
  const row = data as { company_id?: string | null } | null;
  const companyId = row?.company_id != null ? String(row.company_id) : "";
  if (!companyId) return null;
  return { userId: user.id, companyId };
}

async function fetchBreakState(
  admin: SupabaseClient,
  timeEntryId: string
): Promise<boolean> {
  const { data: rows, error } = await admin
    .from("clock_entries")
    .select("event_kind, created_at")
    .eq("parent_time_entry_id", timeEntryId)
    .order("created_at", { ascending: true });
  if (error || !rows?.length) return false;
  let onBreak = false;
  for (const r of rows) {
    const k = (r as { event_kind?: string }).event_kind;
    if (k === "break_start") onBreak = true;
    else if (k === "break_end") onBreak = false;
  }
  return onBreak;
}

export async function GET(req: NextRequest) {
  const session = await sessionUserCompany(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId")?.trim() ?? "";
  const timeEntryId = url.searchParams.get("timeEntryId")?.trim() ?? "";
  if (!companyId || !timeEntryId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  if (companyId !== session.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: te } = await admin
    .from("time_entries")
    .select("user_id, company_id")
    .eq("id", timeEntryId)
    .maybeSingle();
  const row = te as { user_id?: string; company_id?: string } | null;
  if (!row || row.company_id !== companyId || row.user_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const onBreak = await fetchBreakState(admin, timeEntryId);
    return NextResponse.json({ onBreak });
  } catch (e) {
    console.error("[api/clock/activity] GET", e);
    return NextResponse.json({ error: "query_failed", onBreak: false }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const session = await sessionUserCompany(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const timeEntryId = typeof body.timeEntryId === "string" ? body.timeEntryId.trim() : "";
  const action = body.action;

  if (!companyId || !timeEntryId || (action !== "break_toggle" && action !== "project_switch")) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }
  if (companyId !== session.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: teRaw, error: teErr } = await admin
    .from("time_entries")
    .select("id, user_id, company_id, project_id, clock_out_at, clock_in_at")
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
    clock_out_at: string | null;
    clock_in_at: string;
  };

  if (te.company_id !== companyId || te.user_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (te.clock_out_at) {
    return NextResponse.json({ error: "Already clocked out" }, { status: 409 });
  }

  const { data: prof } = await admin
    .from("user_profiles")
    .select("employee_id, full_name")
    .eq("id", session.userId)
    .maybeSingle();
  const profile = prof as { employee_id?: string | null; full_name?: string | null } | null;
  const employeeIdForRow = (profile?.employee_id != null ? String(profile.employee_id) : session.userId) as string;
  const userName = (profile?.full_name ?? "").trim() || undefined;

  const inD = new Date(te.clock_in_at);
  const dateStr = `${inD.getFullYear()}-${pad2(inD.getMonth() + 1)}-${pad2(inD.getDate())}`;
  const now = new Date();
  const hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:00`;

  const projectIdForRow = te.project_id ?? null;

  const auditInsert = async (auditAction: string, entityId: string, newVal: Record<string, unknown>) => {
    const { error: auditErr } = await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: session.userId,
      user_name: userName ?? null,
      action: auditAction,
      entity_type: "clock_entry",
      entity_id: entityId,
      new_value: newVal,
    });
    if (auditErr) console.error("[api/clock/activity] audit", auditErr);
  };

  if (action === "break_toggle") {
    let onBreak: boolean;
    try {
      onBreak = await fetchBreakState(admin, timeEntryId);
    } catch (e) {
      console.error("[api/clock/activity] break state", e);
      return NextResponse.json({ error: "break_state_unavailable" }, { status: 503 });
    }
    const nextKind = onBreak ? "break_end" : "break_start";
    const rowId = `ce_${crypto.randomUUID().replace(/-/g, "")}`;

    const { error: insErr } = await admin.from("clock_entries").insert({
      id: rowId,
      employee_id: employeeIdForRow,
      project_id: projectIdForRow,
      project_code: null,
      date: dateStr,
      clock_in: hm,
      clock_out: null,
      event_kind: nextKind,
      parent_time_entry_id: timeEntryId,
      event_payload: null,
    });

    if (insErr) {
      console.error("[api/clock/activity] insert break", insErr);
      return NextResponse.json({ error: insErr.message ?? "Insert failed" }, { status: 500 });
    }

    await auditInsert(
      nextKind === "break_start" ? "clock_break_started" : "clock_break_ended",
      rowId,
      { timeEntryId, kind: nextKind }
    );

    return NextResponse.json({ ok: true, onBreak: nextKind === "break_start" });
  }

  // project_switch
  const toProjectId =
    typeof body.toProjectId === "string" && body.toProjectId.trim() ? body.toProjectId.trim() : null;
  if (!toProjectId) {
    return NextResponse.json({ error: "toProjectId required" }, { status: 400 });
  }
  if (toProjectId === te.project_id) {
    return NextResponse.json({ error: "Same project" }, { status: 400 });
  }

  const { data: proj } = await admin.from("projects").select("id, company_id").eq("id", toProjectId).maybeSingle();
  const pr = proj as { id?: string; company_id?: string } | null;
  if (!pr || pr.company_id !== companyId) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  const rowId = `ce_${crypto.randomUUID().replace(/-/g, "")}`;
  const { error: insErr } = await admin.from("clock_entries").insert({
    id: rowId,
    employee_id: employeeIdForRow,
    project_id: toProjectId,
    project_code: null,
    date: dateStr,
    clock_in: hm,
    clock_out: null,
    event_kind: "project_switch",
    parent_time_entry_id: timeEntryId,
    event_payload: {
      from_project_id: te.project_id,
      to_project_id: toProjectId,
    },
  });
  if (insErr) {
    console.error("[api/clock/activity] insert switch", insErr);
    return NextResponse.json({ error: insErr.message ?? "Insert failed" }, { status: 500 });
  }

  const { error: upErr } = await admin.from("time_entries").update({ project_id: toProjectId }).eq("id", timeEntryId);
  if (upErr) {
    console.error("[api/clock/activity] update te", upErr);
    return NextResponse.json({ error: upErr.message ?? "Update failed" }, { status: 500 });
  }

  await auditInsert("clock_project_switched", rowId, {
    timeEntryId,
    from_project_id: te.project_id,
    to_project_id: toProjectId,
  });

  return NextResponse.json({ ok: true, projectId: toProjectId });
}
