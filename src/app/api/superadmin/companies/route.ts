import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperadminAccess } from "@/lib/verify-api-session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await verifySuperadminAccess(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: companies, error: cErr } = await admin
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });
  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const { data: subs } = await admin.from("subscriptions").select("*");
  const subByCompany = new Map<string, Record<string, unknown>>();
  for (const s of subs ?? []) {
    const row = s as { company_id: string };
    if (row.company_id) subByCompany.set(row.company_id, s as Record<string, unknown>);
  }

  const { data: profiles } = await admin.from("user_profiles").select("company_id");
  const userCountByCompany: Record<string, number> = {};
  for (const p of profiles ?? []) {
    const row = p as { company_id: string | null };
    if (!row.company_id) continue;
    userCountByCompany[row.company_id] = (userCountByCompany[row.company_id] ?? 0) + 1;
  }

  let projectCountByCompany: Record<string, number> = {};
  const { data: projects, error: pErr } = await admin.from("projects").select("company_id");
  if (!pErr && projects) {
    for (const pr of projects) {
      const row = pr as { company_id: string | null };
      if (!row.company_id) continue;
      projectCountByCompany[row.company_id] = (projectCountByCompany[row.company_id] ?? 0) + 1;
    }
  } else {
    projectCountByCompany = {};
  }

  const list = (companies ?? []).map((c) => {
    const row = c as Record<string, unknown>;
    const id = String(row.id ?? "");
    const sub = subByCompany.get(id) ?? null;
    return {
      ...row,
      id,
      subscription: sub
        ? {
            plan: sub.plan as string,
            status: sub.status as string,
            trial_ends_at: sub.trial_ends_at as string | null,
            current_period_end: sub.current_period_end as string | null,
            billing_period: sub.billing_period as string | null,
            stripe_subscription_id: sub.stripe_subscription_id as string | null,
          }
        : null,
      user_count: userCountByCompany[id] ?? 0,
      project_count: projectCountByCompany[id] ?? 0,
    };
  });

  return NextResponse.json({ companies: list });
}
