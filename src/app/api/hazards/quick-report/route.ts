import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServiceRole } from "@/lib/supabase-admin";
import type { RolePermissions } from "@/types/roles";
import type { HazardCategory, HazardProbability, HazardSeverity } from "@/types/hazard";
import { getRiskScore } from "@/types/hazard";

export const runtime = "nodejs";

const CATEGORIES: HazardCategory[] = [
  "electrical",
  "chemical",
  "physical",
  "ergonomic",
  "biological",
  "fire",
  "other",
];
const SEVERITIES: HazardSeverity[] = ["low", "medium", "high", "critical"];
const PROBS: HazardProbability[] = ["low", "medium", "high"];

type PostBody = {
  companyId?: string;
  projectId?: string | null;
  title?: string;
  description?: string | null;
  category?: string;
  severity?: string;
  probability?: string;
};

async function sessionAndProfile(req: NextRequest): Promise<{
  userId: string;
  companyId: string;
  role: string;
  useInherit: boolean;
  custom: Partial<RolePermissions> | null;
  fullName: string | null;
} | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const admin = createSupabaseServiceRole();
  if (!admin) return null;
  const { data } = await admin
    .from("user_profiles")
    .select("company_id, role, use_role_permissions, custom_permissions, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const row = data as {
    company_id?: string | null;
    role?: string | null;
    use_role_permissions?: boolean | null;
    custom_permissions?: Partial<RolePermissions> | null;
    full_name?: string | null;
  } | null;
  if (!row?.company_id) return null;
  const useInherit = row.use_role_permissions !== false;
  return {
    userId: user.id,
    companyId: String(row.company_id),
    role: String(row.role ?? "worker"),
    useInherit,
    custom: row.custom_permissions ?? null,
    fullName: row.full_name ?? null,
  };
}

function canReportHazard(p: {
  role: string;
  useInherit: boolean;
  custom: Partial<RolePermissions> | null;
}): boolean {
  if (p.role === "admin") return true;
  if (!p.useInherit && p.custom?.canManageHazards === true) return true;
  if (p.useInherit && p.role === "supervisor") return true;
  return false;
}

export async function POST(req: NextRequest) {
  const sess = await sessionAndProfile(req);
  if (!sess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  if (!companyId || companyId !== sess.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canReportHazard(sess)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const category = (CATEGORIES.includes(body.category as HazardCategory)
    ? body.category
    : "other") as HazardCategory;
  const severity = (SEVERITIES.includes(body.severity as HazardSeverity)
    ? body.severity
    : "medium") as HazardSeverity;
  const probability = (PROBS.includes(body.probability as HazardProbability)
    ? body.probability
    : "medium") as HazardProbability;

  const projectId =
    typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;

  const admin = createSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (projectId) {
    const { data: pr } = await admin
      .from("projects")
      .select("id, name, company_id, archived")
      .eq("id", projectId)
      .eq("company_id", companyId)
      .maybeSingle();
    const proj = pr as { id?: string; archived?: boolean } | null;
    if (!proj || proj.archived === true) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }
  }

  let projectName: string | null = null;
  if (projectId) {
    const { data: pn } = await admin.from("projects").select("name").eq("id", projectId).maybeSingle();
    projectName = ((pn as { name?: string } | null)?.name ?? null) as string | null;
  }

  const score = getRiskScore(severity, probability);
  const description = typeof body.description === "string" ? body.description.trim() || null : null;

  const { data: inserted, error: insErr } = await admin
    .from("hazards")
    .insert({
      company_id: companyId,
      project_id: projectId,
      project_name: projectName,
      title,
      description,
      category,
      severity,
      probability,
      risk_score: score,
      status: "open",
      reported_by: sess.userId,
      reported_by_name: sess.fullName?.trim() || null,
      photos: [],
      corrective_actions: [],
      tags: ["quick_action"],
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("[hazards/quick-report]", insErr);
    return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const hid = String((inserted as { id: string }).id);

  const { error: auditErr } = await admin.from("audit_logs").insert({
    company_id: companyId,
    user_id: sess.userId,
    user_name: sess.fullName?.trim() || null,
    action: "hazard_reported_quick_action",
    entity_type: "hazard",
    entity_id: hid,
    entity_name: title,
    new_value: {
      project_id: projectId,
      category,
      severity,
      source: "central_quick_action",
    },
  });
  if (auditErr) console.error("[hazards/quick-report] audit", auditErr);

  return NextResponse.json({ ok: true, id: hid });
}
