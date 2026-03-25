import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyCanManageEmployees } from "@/lib/verify-api-session";

export const runtime = "nodejs";

function baseRoleFromCustomRoleId(customRoleId: string): "admin" | "supervisor" | "worker" | "logistic" {
  if (customRoleId === "role-admin") return "admin";
  if (customRoleId === "role-supervisor") return "supervisor";
  if (customRoleId === "role-logistic") return "logistic";
  return "worker";
}

export async function POST(req: NextRequest) {
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: {
    companyId?: string;
    fullName?: string;
    email?: string;
    phone?: string | null;
    customRoleId?: string | null;
    profileStatus?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
    payType?: string | null;
    payAmount?: number | null;
    payCurrency?: string | null;
    payPeriod?: string | null;
    vacationPolicyEnabled?: boolean;
    vacationDaysAnnual?: number | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const customRoleId =
    typeof body.customRoleId === "string" && body.customRoleId.trim()
      ? body.customRoleId.trim()
      : "role-worker";
  const profileStatus =
    typeof body.profileStatus === "string" && body.profileStatus.trim()
      ? body.profileStatus.trim()
      : "active";

  const emergencyName =
    typeof body.emergencyContactName === "string" ? body.emergencyContactName.trim() || null : null;
  const emergencyPhone =
    typeof body.emergencyContactPhone === "string" ? body.emergencyContactPhone.trim() || null : null;
  const emergencyRelation =
    typeof body.emergencyContactRelation === "string" ? body.emergencyContactRelation.trim() || null : null;
  const rawPayType = typeof body.payType === "string" ? body.payType.trim() : "";
  const payType = rawPayType === "fixed" || rawPayType === "hourly" ? rawPayType : null;
  const payAmount =
    typeof body.payAmount === "number" && !Number.isNaN(body.payAmount) ? body.payAmount : null;
  const payCurrency =
    typeof body.payCurrency === "string" && body.payCurrency.trim() ? body.payCurrency.trim() : null;
  const payPeriod =
    typeof body.payPeriod === "string" && ["monthly", "biweekly", "weekly"].includes(body.payPeriod)
      ? body.payPeriod
      : null;
  const vacationPolicyEnabled = body.vacationPolicyEnabled === true;
  const vacationDaysAnnual =
    typeof body.vacationDaysAnnual === "number" && !Number.isNaN(body.vacationDaysAnnual)
      ? body.vacationDaysAnnual
      : null;

  if (!companyId || !fullName || !email) {
    return NextResponse.json({ error: "Missing companyId, fullName or email" }, { status: 400 });
  }

  const authz = await verifyCanManageEmployees(req, companyId);
  if (!authz) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: exists } = await admin.from("user_profiles").select("id").eq("email", email).maybeSingle();
  if (exists) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const tempPassword = randomBytes(24).toString("base64url") + "Aa1!";
  let userId: string | null = null;
  try {
    const { data: createdUser, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false,
      user_metadata: { full_name: fullName, phone: phone ?? undefined },
    });

    if (authErr || !createdUser.user) {
      return NextResponse.json(
        { error: authErr?.message ?? "Could not create auth user" },
        { status: 400 }
      );
    }
    userId = createdUser.user.id;

    const baseRole = baseRoleFromCustomRoleId(customRoleId);

    const effectivePayType = payType;
    const { error: baseErr } = await admin.from("user_profiles").upsert(
      {
        id: userId,
        company_id: companyId,
        full_name: fullName,
        display_name: fullName,
        email,
        phone,
        role: baseRole,
        custom_role_id: customRoleId,
        profile_status: profileStatus,
        use_role_permissions: true,
      },
      { onConflict: "id" }
    );

    if (baseErr) {
      console.error("[api/employees/create] base profile upsert:", baseErr);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: baseErr.message }, { status: 500 });
    }

    const { error: extErr } = await admin
      .from("user_profiles")
      .update({
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        emergency_contact_relation: emergencyRelation,
        pay_type: effectivePayType,
        pay_amount: effectivePayType ? payAmount : null,
        pay_currency: effectivePayType ? payCurrency : null,
        pay_period: effectivePayType ? payPeriod : null,
        vacation_policy_enabled: vacationPolicyEnabled,
        vacation_days_allowed: vacationPolicyEnabled ? vacationDaysAnnual : null,
      })
      .eq("id", userId);

    if (extErr) {
      console.error("[api/employees/create] extended profile fields (employee still created):", extErr);
      return NextResponse.json({ id: userId, warning: extErr.message });
    }

    return NextResponse.json({ id: userId });
  } catch (e) {
    if (userId) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        /* ignore */
      }
    }
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
