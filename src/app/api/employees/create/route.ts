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
        use_role_permissions: true,
      },
      { onConflict: "id" }
    );

    if (profErr) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profErr.message }, { status: 500 });
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
