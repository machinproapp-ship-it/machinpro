import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyCanManageEmployees } from "@/lib/verify-api-session";
import { ROLE_PERMISSION_KEYS, type RolePermissions } from "@/types/roles";
import { getAppBaseUrl } from "@/lib/app-url";
import { transactionalEmailLangFromCode } from "@/lib/emailTransactionalI18n";
import {
  buildEmployeeInviteEmailHtml,
  employeeInviteSubject,
} from "@/lib/transactionalEmailHtml";
import { seedEmployeeDocumentsFromCountry } from "@/lib/employeeDocumentUtils";

export const runtime = "nodejs";

function sanitizeCustomPermissions(input: unknown): Partial<RolePermissions> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const out: Partial<RolePermissions> = {};
  for (const key of ROLE_PERMISSION_KEYS) {
    const v = o[key];
    if (typeof v === "boolean") (out as Record<string, boolean>)[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

function legacyEnumFromCustomRoleId(customRoleId: string): "admin" | "supervisor" | "worker" | "logistic" | null {
  if (customRoleId === "role-admin") return "admin";
  if (customRoleId === "role-supervisor") return "supervisor";
  if (customRoleId === "role-logistic") return "logistic";
  if (customRoleId === "role-worker") return "worker";
  return null;
}

async function resolveRoleFields(
  admin: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
  companyId: string,
  customRoleIdRaw: string | null
): Promise<{ profileRole: "admin" | "supervisor" | "worker" | "logistic"; customRoleIdOut: string | null }> {
  const trimmed = customRoleIdRaw?.trim() || "";
  if (trimmed) {
    const legacy = legacyEnumFromCustomRoleId(trimmed);
    if (legacy) return { profileRole: legacy, customRoleIdOut: trimmed };
    const { data: roleRow } = await admin
      .from("roles")
      .select("name")
      .eq("id", trimmed)
      .eq("company_id", companyId)
      .maybeSingle();
    if (roleRow && typeof (roleRow as { name?: string }).name === "string") {
      const n = String((roleRow as { name: string }).name).toLowerCase();
      if (n.includes("administr")) return { profileRole: "admin", customRoleIdOut: trimmed };
      if (n.includes("supervisor")) return { profileRole: "supervisor", customRoleIdOut: trimmed };
      if (n.includes("logist")) return { profileRole: "logistic", customRoleIdOut: trimmed };
      return { profileRole: "worker", customRoleIdOut: trimmed };
    }
  }
  const { data: empRow } = await admin
    .from("roles")
    .select("id")
    .eq("company_id", companyId)
    .ilike("name", "Empleado")
    .maybeSingle();
  const empId = empRow && (empRow as { id?: string }).id != null ? String((empRow as { id: string }).id) : null;
  return { profileRole: "worker", customRoleIdOut: empId };
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
    useRolePermissions?: boolean;
    customPermissions?: unknown;
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
  const customRoleIdBody =
    typeof body.customRoleId === "string" && body.customRoleId.trim() ? body.customRoleId.trim() : null;
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
  const payType =
    rawPayType === "fixed" || rawPayType === "hourly" || rawPayType === "production"
      ? rawPayType
      : null;
  const payAmount =
    typeof body.payAmount === "number" && !Number.isNaN(body.payAmount) ? body.payAmount : null;
  const payCurrency =
    typeof body.payCurrency === "string" && body.payCurrency.trim() ? body.payCurrency.trim() : null;
  const payPeriod =
    typeof body.payPeriod === "string" && ["monthly", "biweekly", "weekly"].includes(body.payPeriod)
      ? body.payPeriod
      : null;
  const useRolePermissions = body.useRolePermissions !== false;
  const customPermissionsStored = useRolePermissions
    ? null
    : sanitizeCustomPermissions(body.customPermissions) ?? {};
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

    const { profileRole: baseRole, customRoleIdOut: customRoleId } = await resolveRoleFields(
      admin,
      companyId,
      customRoleIdBody
    );

    const effectivePayType = payType;
    const payAmountForRow =
      effectivePayType === "production" ? null : effectivePayType ? payAmount : null;
    /** Columnas user_profiles: pay_*, vacation_policy_enabled, vacation_days_allowed (no usar payment_*). */
    const { error: profErr } = await admin.from("user_profiles").upsert(
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
        use_role_permissions: useRolePermissions,
        custom_permissions: customPermissionsStored,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        emergency_contact_relation: emergencyRelation,
        pay_type: effectivePayType,
        pay_amount: payAmountForRow,
        pay_currency:
          effectivePayType && effectivePayType !== "production" ? payCurrency : null,
        pay_period: effectivePayType === "fixed" ? payPeriod : null,
        vacation_policy_enabled: vacationPolicyEnabled,
        vacation_days_allowed: vacationPolicyEnabled ? vacationDaysAnnual : null,
        vacation_days_per_year:
          vacationDaysAnnual != null && vacationDaysAnnual > 0 ? Math.round(vacationDaysAnnual) : 20,
      },
      { onConflict: "id" }
    );

    if (profErr) {
      console.error("[api/employees/create] profile upsert:", profErr);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const { data: coRow } = await admin
      .from("companies")
      .select("country_code")
      .eq("id", companyId)
      .maybeSingle();
    const countryCode =
      typeof (coRow as { country_code?: string } | null)?.country_code === "string"
        ? (coRow as { country_code: string }).country_code
        : undefined;
    const seededDocs = seedEmployeeDocumentsFromCountry(countryCode, undefined);
    for (const doc of seededDocs) {
      const ins = await admin.from("employee_documents").insert({
        company_id: companyId,
        user_id: userId,
        name: doc.name,
        name_key: doc.nameKey ?? null,
        file_url: doc.documentUrl ?? null,
        expiry_date: doc.expiryDate ?? null,
        alert_days: doc.alertDays ?? 30,
        required: doc.required ?? true,
      });
      if (ins.error) {
        console.error("[api/employees/create] employee_documents seed:", ins.error);
        break;
      }
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const { data: compRow } = await admin
          .from("companies")
          .select("name, language")
          .eq("id", companyId)
          .maybeSingle();
        const comp = compRow as { name?: string | null; language?: string | null } | null;
        const companyDisplayName = (comp?.name ?? "").trim() || "MachinPro";
        const emailLang = transactionalEmailLangFromCode("en");

        const { data: inviterRow } = await admin
          .from("user_profiles")
          .select("full_name, display_name")
          .eq("id", authz.userId)
          .maybeSingle();
        const ir = inviterRow as { full_name?: string | null; display_name?: string | null } | null;
        const adminName =
          (typeof ir?.full_name === "string" && ir.full_name.trim()) ||
          (typeof ir?.display_name === "string" && ir.display_name.trim()) ||
          "MachinPro";

        const baseTrim = getAppBaseUrl().replace(/\/$/, "");
        const redirectTo = `${baseTrim}/login`;
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });
        const actionLink = linkData?.properties?.action_link;

        if (linkErr || !actionLink) {
          console.error("[api/employees/create] generateLink:", linkErr);
        } else {
          const html = buildEmployeeInviteEmailHtml({
            adminName,
            companyName: companyDisplayName,
            lang: emailLang,
            ctaUrl: actionLink,
          });
          const resendCli = new Resend(resendKey);
          const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
          const { error: mailErr } = await resendCli.emails.send({
            from,
            to: email,
            replyTo: "support@machin.pro",
            subject: employeeInviteSubject(companyDisplayName, emailLang),
            html,
          });
          if (mailErr) console.error("[api/employees/create] invite email:", mailErr);
        }
      } catch (e) {
        console.error("[api/employees/create] invite email:", e);
      }
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
