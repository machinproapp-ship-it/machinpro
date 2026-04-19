import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getCountryConfig } from "@/lib/countryConfig";
import { getLimitsForPlan } from "@/lib/stripe";
import { fullAdministratorPermissions } from "@/lib/roles-supabase";
import { buildWelcomeEmailHtml, buildWelcomeEmailSubject } from "@/lib/transactionalEmailHtml";

export const runtime = "nodejs";

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAuth = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAuth.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing } = await admin
    .from("user_profiles")
    .select("id, company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing?.company_id) {
    return NextResponse.json({ ok: true, alreadyProvisioned: true });
  }

  const meta = user.user_metadata as Record<string, unknown> | null | undefined;
  if (meta?.registration_source !== "free") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companyName = typeof meta.company_name === "string" ? meta.company_name.trim() : "";
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const countryRaw =
    (typeof meta.signup_country === "string" ? meta.signup_country.trim().toUpperCase() : "") || "US";

  if (!companyName || !fullName) {
    return NextResponse.json({ error: "Missing signup metadata" }, { status: 400 });
  }

  const countryCfg = getCountryConfig(countryRaw);
  const countryCode = countryCfg.code.toUpperCase();
  const lang = languageForCountry(countryCfg.code);

  const limits = getLimitsForPlan("esencial");
  const nowIso = new Date().toISOString();
  const trialEnd = new Date(Date.now() + 14 * 86400000).toISOString();

  let userId: string | null = user.id;
  let companyId: string | null = null;

  try {
    const { data: comp, error: compErr } = await admin
      .from("companies")
      .insert({
        name: companyName,
        country: countryCfg.code,
        country_code: countryCode,
        tax_id: null,
        language: lang,
        currency: countryCfg.currency,
        plan: "esencial",
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
      plan: "trial",
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

    await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: userId,
      user_name: fullName,
      action: "employee_created",
      entity_type: "company",
      entity_id: companyId,
      entity_name: companyName,
      new_value: { source: "free_registration", email: user.email },
    });

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && user.email) {
      try {
        const html = buildWelcomeEmailHtml({
          userName: fullName,
          companyName,
          lang: "en",
        });
        const subject = buildWelcomeEmailSubject(fullName, companyName, "en");
        const resend = new Resend(resendKey);
        const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
        await resend.emails.send({
          from,
          to: user.email,
          replyTo: "support@machin.pro",
          subject,
          html,
        });
      } catch (e) {
        console.error("[register-free/provision] welcome email:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Provision failed";
    if (companyId) {
      await admin.from("subscriptions").delete().eq("company_id", companyId);
      await admin.from("companies").delete().eq("id", companyId);
    }
    console.error("[register-free/provision]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
