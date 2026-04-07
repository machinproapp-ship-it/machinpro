import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRole } from "@/lib/supabase-admin";
import { verifyCanManageEmployees } from "@/lib/verify-api-session";
import { zonedYmdHmToUtcIso } from "@/lib/dateUtils";

export const runtime = "nodejs";

type Body = {
  companyId?: string;
  targetUserId?: string;
  mode?: "in" | "out";
  date?: string;
  time?: string;
  timeZone?: string;
  projectId?: string | null;
  notes?: string | null;
  timeEntryId?: string;
};

function mapRowToResponse(
  row: {
    id: string;
    user_id: string;
    project_id: string | null;
    clock_in_at: string;
    clock_out_at: string | null;
  },
  legacyEmployeeId: string | null
) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const inD = new Date(row.clock_in_at);
  const dateStr = `${inD.getFullYear()}-${pad(inD.getMonth() + 1)}-${pad(inD.getDate())}`;
  const clockIn = `${pad(inD.getHours())}:${pad(inD.getMinutes())}`;
  let clockOut: string | undefined;
  if (row.clock_out_at) {
    const outD = new Date(row.clock_out_at);
    clockOut = `${pad(outD.getHours())}:${pad(outD.getMinutes())}`;
  }
  const employeeId = legacyEmployeeId ?? row.user_id;
  return {
    id: row.id,
    employeeId,
    projectId: row.project_id ?? undefined,
    date: dateStr,
    clockIn,
    clockOut,
  };
}

export async function POST(req: NextRequest) {
  const admin = createSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
  const mode = body.mode;
  const dateYmd = typeof body.date === "string" ? body.date.trim() : "";
  const timeHm = typeof body.time === "string" ? body.time.trim() : "";
  const timeZone = typeof body.timeZone === "string" && body.timeZone.trim() ? body.timeZone.trim() : "UTC";
  const projectId =
    body.projectId === null || body.projectId === undefined || body.projectId === ""
      ? null
      : String(body.projectId);
  const notesRaw = typeof body.notes === "string" ? body.notes.trim() : "";
  const timeEntryId = typeof body.timeEntryId === "string" ? body.timeEntryId.trim() : "";

  if (!companyId || !targetUserId || (mode !== "in" && mode !== "out")) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const actor = await verifyCanManageEmployees(req, companyId);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data: targetProfile, error: targetErr } = await admin
    .from("user_profiles")
    .select("id, company_id, employee_id")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetErr || !targetProfile) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const tp = targetProfile as { id: string; company_id?: string | null; employee_id?: string | null };
  if (tp.company_id !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const legacyEmployeeId = tp.employee_id != null ? String(tp.employee_id) : null;
  const auditEmployeeId = legacyEmployeeId ?? targetUserId;

  const { data: actorProfile } = await admin
    .from("user_profiles")
    .select("full_name")
    .eq("id", actor.userId)
    .maybeSingle();
  const actorName = (actorProfile as { full_name?: string } | null)?.full_name ?? "";

  try {
    if (mode === "in") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd) || !/^\d{1,2}:\d{2}$/.test(timeHm)) {
        return NextResponse.json({ error: "Invalid date or time" }, { status: 400 });
      }

      const { data: openRows } = await admin
        .from("time_entries")
        .select("id")
        .eq("company_id", companyId)
        .eq("user_id", targetUserId)
        .is("clock_out_at", null)
        .limit(5);

      if (openRows && openRows.length > 0) {
        return NextResponse.json({ error: "Employee already has an open clock entry" }, { status: 409 });
      }

      const clockInAt = zonedYmdHmToUtcIso(dateYmd, timeHm, timeZone);
      const noteLine = notesRaw ? `[manual] ${notesRaw}` : "[manual]";

      const { data: inserted, error: insErr } = await admin
        .from("time_entries")
        .insert({
          company_id: companyId,
          user_id: targetUserId,
          project_id: projectId,
          clock_in_at: clockInAt,
          status: "active",
          notes: noteLine,
        })
        .select("id, user_id, project_id, clock_in_at, clock_out_at")
        .single();

      if (insErr || !inserted) {
        console.error("[time-entries/manual] insert", insErr);
        return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 500 });
      }

      const row = inserted as {
        id: string;
        user_id: string;
        project_id: string | null;
        clock_in_at: string;
        clock_out_at: string | null;
      };

      const { error: auditErr } = await admin.from("audit_logs").insert({
        company_id: companyId,
        user_id: actor.userId,
        user_name: actorName,
        action: "manual_clock_in",
        entity_type: "clock_entry",
        entity_id: row.id,
        entity_name: auditEmployeeId,
        new_value: {
          employeeId: auditEmployeeId,
          projectId: projectId ?? undefined,
          time: clockInAt,
          registeredBy: actor.userId,
        },
      });
      if (auditErr) console.error("[time-entries/manual] audit", auditErr);

      return NextResponse.json({
        ok: true,
        entry: mapRowToResponse(row, legacyEmployeeId),
      });
    }

    // mode === "out"
    if (!timeEntryId) {
      return NextResponse.json({ error: "timeEntryId required" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd) || !/^\d{1,2}:\d{2}$/.test(timeHm)) {
      return NextResponse.json({ error: "Invalid date or time" }, { status: 400 });
    }

    const { data: existing, error: exErr } = await admin
      .from("time_entries")
      .select("id, user_id, company_id, clock_in_at, clock_out_at, status, notes")
      .eq("id", timeEntryId)
      .maybeSingle();

    if (exErr || !existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const ex = existing as {
      id: string;
      user_id: string;
      company_id: string;
      clock_in_at: string;
      clock_out_at: string | null;
      status: string;
      notes: string | null;
    };

    if (ex.company_id !== companyId || ex.user_id !== targetUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (ex.clock_out_at) {
      return NextResponse.json({ error: "Already clocked out" }, { status: 409 });
    }

    const clockOutAt = zonedYmdHmToUtcIso(dateYmd, timeHm, timeZone);
    const clockInMs = new Date(ex.clock_in_at).getTime();
    const clockOutMs = new Date(clockOutAt).getTime();
    if (clockOutMs < clockInMs) {
      return NextResponse.json({ error: "Clock-out time must be after clock-in" }, { status: 400 });
    }
    const totalMins = Math.max(0, Math.round((clockOutMs - clockInMs) / 60_000));

    const prevNotes = (ex.notes ?? "").trim();
    const outNote = notesRaw ? `${prevNotes ? `${prevNotes}\n` : ""}[manual out] ${notesRaw}` : prevNotes;

    const { data: updated, error: upErr } = await admin
      .from("time_entries")
      .update({
        clock_out_at: clockOutAt,
        status: "completed",
        total_minutes: totalMins,
        notes: outNote || null,
      })
      .eq("id", timeEntryId)
      .select("id, user_id, project_id, clock_in_at, clock_out_at")
      .single();

    if (upErr || !updated) {
      console.error("[time-entries/manual] update", upErr);
      return NextResponse.json({ error: upErr?.message ?? "Update failed" }, { status: 500 });
    }

    const urow = updated as {
      id: string;
      user_id: string;
      project_id: string | null;
      clock_in_at: string;
      clock_out_at: string | null;
    };

    const { error: auditErr } = await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: actor.userId,
      user_name: actorName,
      action: "manual_clock_out",
      entity_type: "clock_entry",
      entity_id: urow.id,
      entity_name: auditEmployeeId,
      new_value: {
        employeeId: auditEmployeeId,
        projectId: urow.project_id ?? undefined,
        time: clockOutAt,
        registeredBy: actor.userId,
      },
    });
    if (auditErr) console.error("[time-entries/manual] audit out", auditErr);

    return NextResponse.json({
      ok: true,
      entry: mapRowToResponse(urow, legacyEmployeeId),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
