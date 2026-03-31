import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId: rawId } = await ctx.params;
  const projectId = rawId ? decodeURIComponent(rawId) : "";
  if (!projectId.trim()) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: project, error: pErr } = await admin
    .from("projects")
    .select("id, name, company_id")
    .eq("id", projectId.trim())
    .eq("archived", false)
    .maybeSingle();

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: company, error: cErr } = await admin
    .from("companies")
    .select("id, name, logo_url")
    .eq("id", project.company_id)
    .maybeSingle();

  if (cErr || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json({
    companyId: company.id,
    companyName: company.name,
    logoUrl: typeof company.logo_url === "string" && company.logo_url.trim() ? company.logo_url.trim() : null,
    projectId: project.id,
    projectName: project.name,
  });
}
