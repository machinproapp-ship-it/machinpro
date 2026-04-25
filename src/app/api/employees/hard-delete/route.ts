import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRole } from "@/lib/supabase-admin";
import { verifyCompanyAdmin } from "@/lib/verify-api-session";

/**
 * GDPR / PIPEDA hard delete: removes personal data and Auth user.
 * Only profiles with `deleted_at` set (soft-deleted) may be purged.
 * Requires company admin. Audit logs are insert-only (never delete target rows).
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const admin = createSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  let body: { companyId?: string; employeeId?: string; userId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const targetUserId = (
    typeof body.employeeId === "string" && body.employeeId.trim()
      ? body.employeeId.trim()
      : typeof body.userId === "string"
        ? body.userId.trim()
        : ""
  ) as string;
  if (!companyId || !targetUserId) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization")?.trim() ?? "";
  const hasBearer = /^Bearer\s+\S+/i.test(authHeader);
  if (!hasBearer) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const actor = await verifyCompanyAdmin(req, companyId);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (actor.userId === targetUserId) {
    return NextResponse.json({ ok: false, error: "Cannot delete own account" }, { status: 400 });
  }

  const { data: target, error: fetchErr } = await admin
    .from("user_profiles")
    .select("id, company_id, full_name, email, role, profile_status, employee_id, deleted_at")
    .eq("id", targetUserId)
    .maybeSingle();

  if (fetchErr || !target) {
    return NextResponse.json({ ok: false, error: "Employee not found" }, { status: 404 });
  }

  const row = target as {
    id: string;
    company_id?: string | null;
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
    profile_status?: string | null;
    employee_id?: string | null;
    deleted_at?: string | null;
  };

  if (row.company_id !== companyId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const delAt = row.deleted_at;
  if (delAt == null || String(delAt).trim() === "") {
    return NextResponse.json(
      { ok: false, error: "Hard delete is only allowed for soft-deleted employees (deleted_at set)" },
      { status: 400 }
    );
  }

  const deletedEmployeeName =
    (typeof row.full_name === "string" && row.full_name.trim()) ||
    (typeof row.email === "string" && row.email.trim()) ||
    targetUserId;

  const { data: actorProfile } = await admin
    .from("user_profiles")
    .select("full_name, display_name")
    .eq("id", actor.userId)
    .maybeSingle();
  const ap = actorProfile as { full_name?: string | null; display_name?: string | null } | null;
  const actorName =
    (typeof ap?.full_name === "string" && ap.full_name.trim()) ||
    (typeof ap?.display_name === "string" && ap.display_name.trim()) ||
    "Admin";

  const legacyEmpId = row.employee_id != null ? String(row.employee_id).trim() : "";

  const run = async (label: string, fn: () => Promise<{ error: { message: string } | null }>) => {
    const { error } = await fn();
    if (error) console.error(`[employees/hard-delete] ${label}`, error.message);
  };

  await run("employee_documents", async () => {
    const { error } = await admin.from("employee_documents").delete().eq("user_id", targetUserId);
    return { error };
  });

  await run("time_entries", async () => {
    const { error } = await admin.from("time_entries").delete().eq("user_id", targetUserId);
    return { error };
  });

  await run("gps_tracking", async () => {
    const { error } = await admin.from("gps_tracking").delete().eq("user_id", targetUserId);
    return { error };
  });

  await run("vacation_requests", async () => {
    const { error } = await admin.from("vacation_requests").delete().eq("user_id", targetUserId);
    return { error };
  });

  await run("employee_projects", async () => {
    const { error } = await admin.from("employee_projects").delete().eq("user_id", targetUserId);
    return { error };
  });

  if (legacyEmpId) {
    await run("certificates", async () => {
      const { error } = await admin.from("certificates").delete().eq("employee_id", legacyEmpId);
      return { error };
    });
  }

  if (legacyEmpId) {
    await run("clock_entries", async () => {
      const { error } = await admin.from("clock_entries").delete().eq("employee_id", legacyEmpId);
      return { error };
    });
  }
  await run("clock_entries_profile", async () => {
    const { error } = await admin.from("clock_entries").delete().eq("employee_id", targetUserId);
    return { error };
  });

  const { data: schedRows } = await admin
    .from("schedule_entries")
    .select("id, employee_ids")
    .eq("company_id", companyId);
  for (const sr of schedRows ?? []) {
    const r = sr as { id?: string; employee_ids?: string[] | null };
    const ids = Array.isArray(r.employee_ids) ? r.employee_ids : [];
    if (!ids.includes(targetUserId) && (!legacyEmpId || !ids.includes(legacyEmpId))) continue;
    const next = ids.filter((x) => x !== targetUserId && (!legacyEmpId || x !== legacyEmpId));
    if (next.length === 0) {
      await admin.from("schedule_entries").delete().eq("id", r.id ?? "");
    } else {
      await admin.from("schedule_entries").update({ employee_ids: next }).eq("id", r.id ?? "");
    }
  }

  const { error: authDelErr } = await admin.auth.admin.deleteUser(targetUserId);
  if (authDelErr) {
    console.error("[employees/hard-delete] auth.admin.deleteUser", authDelErr);
    return NextResponse.json(
      {
        ok: false,
        error: authDelErr.message,
        hint: "Related rows may block deletion. Check Supabase logs and FK constraints.",
      },
      { status: 500 }
    );
  }

  const { error: profDelErr } = await admin.from("user_profiles").delete().eq("id", targetUserId);
  if (profDelErr) {
    console.error("[employees/hard-delete] user_profiles delete", profDelErr);
  }

  const { error: auditErr } = await admin.from("audit_logs").insert({
    company_id: companyId,
    user_id: actor.userId,
    user_name: actorName,
    action: "hard_delete",
    entity_type: "employee",
    entity_id: targetUserId,
    entity_name: deletedEmployeeName,
    new_value: { deleted_employee_name: deletedEmployeeName, reason: "GDPR/PIPEDA" },
  });
  if (auditErr) {
    console.error("[employees/hard-delete] audit insert", auditErr);
  }

  return NextResponse.json({ ok: true, success: true });
}
