import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getCountryConfig } from "@/lib/countryConfig";
import { getLimitsForPlan, type PlanKey } from "@/lib/stripe";
import type { InvitationPlan } from "@/types/invitation";
import { fullAdministratorPermissions } from "@/lib/roles-supabase";

export const runtime = "nodejs";

function planKeyForLimits(p: InvitationPlan): PlanKey {
  if (p === "trial" || p === "starter") return "starter";
  if (p === "pro") return "pro";
  return "enterprise";
}

function companyPlanColumn(p: InvitationPlan): string {
  if (p === "pro") return "professional";
  if (p === "enterprise") return "enterprise";
  return "starter";
}

function languageForCountry(code: string): string {
  const upper = code.toUpperCase();
  const map: Record<string, string> = {
    ES: "es",
    MX: "es",
    FR: "fr",
    DE: "de",
    IT: "it",
    PT: "pt",
    NL: "nl",
    PL: "pl",
    BR: "pt",
    AT: "de",
    CH: "de",
    BE: "fr",
  };
  return map[upper] ?? "en";
}

export async function POST(req: NextRequest) {
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: {
    token?: string;
    email?: string;
    password?: string;
    companyName?: string;
    fullName?: string;
    country?: string;
    phone?: string;
    termsAccepted?: boolean;
    taxId?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const country = typeof body.country === "string" ? body.country.trim().toUpperCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const termsAccepted = body.termsAccepted === true;
  const taxIdRaw = typeof body.taxId === "string" ? body.taxId.trim().slice(0, 120) : "";
  const taxIdNorm = taxIdRaw || null;

  if (!token || !email || !password || !companyName || !fullName || !country) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!termsAccepted) {
    return NextResponse.json({ error: "Terms must be accepted" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password too short" }, { status: 400 });
  }

  const { data: invRow, error: invErr } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (invErr || !invRow) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
  }

  const inv = invRow as {
    id: string;
    email: string;
    company_name: string;
    plan: InvitationPlan;
    status: string;
    expires_at: string;
  };

  if (inv.status !== "pending") {
    return NextResponse.json({ error: "Invitation already used or cancelled" }, { status: 400 });
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Invitation expired" }, { status: 400 });
  }
  if (inv.email.toLowerCase() !== email) {
    return NextResponse.json({ error: "Email does not match invitation" }, { status: 400 });
  }

  const countryCfg = getCountryConfig(country);
  const lang = languageForCountry(countryCfg.code);

  const limits = getLimitsForPlan(planKeyForLimits(inv.plan));
  const nowIso = new Date().toISOString();
  const trialEnd = new Date(Date.now() + 14 * 86400000).toISOString();

  let userId: string | null = null;
  let companyId: string | null = null;
  let subscriptionInserted = false;

  try {
    const { data: createdUser, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || undefined,
      },
    });

    if (authErr || !createdUser.user) {
      return NextResponse.json({ error: authErr?.message ?? "Could not create user" }, { status: 400 });
    }
    userId = createdUser.user.id;

    const { data: comp, error: compErr } = await admin
      .from("companies")
      .insert({
        name: companyName,
        country: countryCfg.code,
        country_code: country,
        tax_id: taxIdNorm,
        language: lang,
        currency: countryCfg.currency,
        plan: companyPlanColumn(inv.plan),
        is_active: true,
        activated_at: nowIso,
      })
      .select("id")
      .single();

    if (compErr || !comp) {
      throw new Error(compErr?.message ?? "company insert failed");
    }
    companyId = (comp as { id: string }).id;

    const { error: seedRoleErr } = await admin.from("roles").insert({
      company_id: companyId,
      name: "Administrador",
      color: "#b45309",
      permissions: fullAdministratorPermissions(),
      is_system: true,
    });
    if (seedRoleErr) {
      throw new Error(seedRoleErr.message);
    }

    const { error: profErr } = await admin.from("user_profiles").upsert(
      {
        id: userId,
        role: "admin",
        company_id: companyId,
        full_name: fullName,
        display_name: fullName,
      },
      { onConflict: "id" }
    );

    if (profErr) {
      throw new Error(profErr.message);
    }

    const { error: subErr } = await admin.from("subscriptions").insert({
      company_id: companyId,
      plan: inv.plan,
      status: "trialing",
      trial_ends_at: trialEnd,
      seats_limit: limits.seats_limit,
      projects_limit: limits.projects_limit,
      storage_limit_gb: limits.storage_limit_gb,
      geo_tier: 1,
    });

    if (subErr) {
      throw new Error(subErr.message);
    }

    const { error: invUpErr } = await admin
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: nowIso,
        created_company_id: companyId,
      })
      .eq("id", inv.id);

    if (invUpErr) {
      throw new Error(invUpErr.message);
    }

    await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: userId,
      user_name: fullName,
      action: "invitation_accepted",
      entity_type: "company",
      entity_id: companyId,
      entity_name: companyName,
      new_value: { invitation_id: inv.id, email },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    if (subscriptionInserted && companyId) {
      await admin.from("subscriptions").delete().eq("company_id", companyId);
    }
    if (companyId) {
      await admin.from("companies").delete().eq("id", companyId);
    }
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
