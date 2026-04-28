import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRole } from "@/lib/supabase-admin";
import {
  mapDbRowToFormInstance,
  mapDbRowToFormTemplate,
  MACHIN_FORM_TEMPLATE_SLUG_KEY,
} from "@/lib/formInstancesDb";
import { INITIAL_FORM_TEMPLATES } from "@/lib/formTemplates";
import type { FormInstance, FormTemplate } from "@/types/forms";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

function sanitizeInstance(inst: FormInstance): FormInstance {
  const fv = { ...inst.fieldValues };
  delete fv[MACHIN_FORM_TEMPLATE_SLUG_KEY];
  return { ...inst, fieldValues: fv };
}

async function resolveTemplate(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceRole>>,
  templateIdUuid: string | null,
  slugFallback: string | null
): Promise<FormTemplate | null> {
  if (templateIdUuid) {
    const { data } = await admin
      .from("form_templates")
      .select("*")
      .eq("id", templateIdUuid)
      .maybeSingle();
    if (data) return mapDbRowToFormTemplate(data as Record<string, unknown>);
  }
  const slug = slugFallback ?? "";
  if (!slug) return null;
  return INITIAL_FORM_TEMPLATES.find((t) => t.id === slug) ?? null;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    if (!token?.trim()) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const admin = createSupabaseServiceRole();
    if (!admin) {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const { data: row, error } = await admin
      .from("form_instances")
      .select("*")
      .eq("sign_token", token.trim())
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const raw = row as Record<string, unknown>;
    const expiresRaw = raw.token_expires_at;
    if (expiresRaw != null && new Date(String(expiresRaw)) < new Date()) {
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }

    const instance = mapDbRowToFormInstance(raw);
    const tplUuid = raw.template_id != null ? String(raw.template_id) : null;
    const fv = raw.field_values as Record<string, unknown> | undefined;
    const slugFromFv =
      fv && typeof fv[MACHIN_FORM_TEMPLATE_SLUG_KEY] === "string"
        ? (fv[MACHIN_FORM_TEMPLATE_SLUG_KEY] as string)
        : null;

    const template = await resolveTemplate(admin, tplUuid, slugFromFv ?? instance.templateId);

    if (!template) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const companyId = raw.company_id != null ? String(raw.company_id) : "";
    let companyName = "";
    let companyLogoUrl: string | null = null;
    let companyAddress: string | null = null;
    let companyPhone: string | null = null;
    let companyEmail: string | null = null;

    if (companyId) {
      const { data: co } = await admin
        .from("companies")
        .select("name, logo_url, address, phone, email")
        .eq("id", companyId)
        .maybeSingle();
      const c = co as {
        name?: string | null;
        logo_url?: string | null;
        address?: string | null;
        phone?: string | null;
        email?: string | null;
      } | null;
      if (c) {
        companyName = typeof c.name === "string" ? c.name : "";
        companyLogoUrl = typeof c.logo_url === "string" && c.logo_url.trim() ? c.logo_url.trim() : null;
        companyAddress = typeof c.address === "string" ? c.address : null;
        companyPhone = typeof c.phone === "string" ? c.phone : null;
        companyEmail = typeof c.email === "string" ? c.email : null;
      }
    }

    return NextResponse.json({
      instance: sanitizeInstance(instance),
      template,
      companyName,
      companyLogoUrl,
      companyAddress,
      companyPhone,
      companyEmail,
      docNumber: raw.doc_number != null ? String(raw.doc_number) : null,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
