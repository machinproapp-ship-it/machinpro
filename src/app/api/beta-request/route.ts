import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { COUNTRY_CONFIG, getCountryConfig } from "@/lib/countryConfig";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const COMPANY_TYPE_KEYS = ["construction", "engineering", "architecture", "other"] as const;
type CompanyTypeKey = (typeof COMPANY_TYPE_KEYS)[number];

const COMPANY_LABELS: Record<string, Record<CompanyTypeKey, string>> = {
  es: {
    construction: "Construcción",
    engineering: "Ingeniería",
    architecture: "Arquitectura",
    other: "Otro",
  },
  en: {
    construction: "Construction",
    engineering: "Engineering",
    architecture: "Architecture",
    other: "Other",
  },
  fr: {
    construction: "Construction",
    engineering: "Ingénierie",
    architecture: "Architecture",
    other: "Autre",
  },
  de: {
    construction: "Bau",
    engineering: "Ingenieurwesen",
    architecture: "Architektur",
    other: "Sonstiges",
  },
  it: {
    construction: "Costruzione",
    engineering: "Ingegneria",
    architecture: "Architettura",
    other: "Altro",
  },
  pt: {
    construction: "Construção",
    engineering: "Engenharia",
    architecture: "Arquitetura",
    other: "Outro",
  },
};

const MAIN_LOCALES = new Set(["es", "en", "fr", "de", "it", "pt"]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function companyTypeLabel(locale: string, key: CompanyTypeKey): string {
  const loc = MAIN_LOCALES.has(locale) ? locale : "en";
  return COMPANY_LABELS[loc]?.[key] ?? COMPANY_LABELS.en[key];
}

export async function POST(req: NextRequest) {
  let body: {
    name?: string;
    email?: string;
    country?: string;
    companyType?: string;
    message?: string | null;
    privacyAccepted?: boolean;
    locale?: string;
    /** @deprecated */
    company?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const countryCode = typeof body.country === "string" ? body.country.trim().toUpperCase() : "";
  const companyTypeRaw = typeof body.companyType === "string" ? body.companyType.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() || null : null;
  const privacyAccepted = body.privacyAccepted === true;
  const locale = typeof body.locale === "string" ? body.locale.trim().slice(0, 2).toLowerCase() : "en";

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }
  if (!countryCode || !COUNTRY_CONFIG[countryCode]) {
    return NextResponse.json({ error: "Valid country is required" }, { status: 400 });
  }
  if (!COMPANY_TYPE_KEYS.includes(companyTypeRaw as CompanyTypeKey)) {
    return NextResponse.json({ error: "Valid company type is required" }, { status: 400 });
  }
  if (!privacyAccepted) {
    return NextResponse.json({ error: "Privacy policy must be accepted" }, { status: 400 });
  }

  const companyType = companyTypeRaw as CompanyTypeKey;
  const countryConfig = getCountryConfig(countryCode);
  const countryName = countryConfig.name;
  const typeLabel = companyTypeLabel(locale, companyType);

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { error: insErr } = await admin.from("beta_requests").insert({
    name,
    email,
    company: companyType,
    country: countryCode,
    message,
    status: "pending",
  });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ ok: true });
  }

  try {
    const resend = new Resend(resendKey);
    const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
    const subject = `Nueva solicitud Beta Founder — ${name} (${countryName})`;
    const html = `<p>Nueva solicitud <strong>Beta Founder</strong></p>
<ul>
<li><strong>Nombre:</strong> ${escapeHtml(name)}</li>
<li><strong>Email:</strong> ${escapeHtml(email)}</li>
<li><strong>País:</strong> ${escapeHtml(countryName)} (${escapeHtml(countryCode)})</li>
<li><strong>Tipo de empresa:</strong> ${escapeHtml(typeLabel)} (${escapeHtml(companyType)})</li>
<li><strong>Idioma del formulario:</strong> ${escapeHtml(locale)}</li>
<li><strong>Mensaje:</strong> ${message ? escapeHtml(message).replace(/\n/g, "<br/>") : "—"}</li>
<li><strong>Política de privacidad:</strong> Aceptada</li>
</ul>`;

    const { error: sendErr } = await resend.emails.send({
      from,
      to: "info@machin.pro",
      replyTo: email,
      subject,
      html,
    });

    if (sendErr) {
      return NextResponse.json({ error: sendErr.message ?? "Email send failed" }, { status: 502 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email send failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
