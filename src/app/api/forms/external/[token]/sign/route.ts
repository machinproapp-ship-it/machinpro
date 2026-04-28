import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRole } from "@/lib/supabase-admin";
import { mapDbRowToFormInstance } from "@/lib/formInstancesDb";
import type { AttendeeRecord } from "@/types/forms";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

function isLikelyPngDataUrl(sig: string): boolean {
  const s = sig.trim();
  return s.startsWith("data:image/png;base64,") && s.length > 80;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    if (!token?.trim()) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    let body: {
      name?: string;
      company?: string;
      email?: string;
      signature?: string;
      orientationGiven?: boolean;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const signature = typeof body.signature === "string" ? body.signature : "";
    const company = typeof body.company === "string" ? body.company.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!name || !isLikelyPngDataUrl(signature)) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }

    const admin = createSupabaseServiceRole();
    if (!admin) {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const { data: row, error: fetchErr } = await admin
      .from("form_instances")
      .select("*")
      .eq("sign_token", token.trim())
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const raw = row as Record<string, unknown>;
    const expiresRaw = raw.token_expires_at;
    if (expiresRaw != null && new Date(String(expiresRaw)) < new Date()) {
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }

    const instance = mapDbRowToFormInstance(raw);
    const attendees = [...instance.attendees];
    const lower = name.toLowerCase();

    const idx = attendees.findIndex((a) => a.name.trim().toLowerCase() === lower);

    const orientationGiven = body.orientationGiven === true;

    let nextAttendees: AttendeeRecord[];
    if (idx >= 0) {
      nextAttendees = attendees.map((a, i) =>
        i === idx
          ? {
              ...a,
              company: company || a.company,
              signedAt: new Date().toISOString(),
              signature,
              orientationGiven,
              isExternal: a.isExternal !== false,
            }
          : a
      );
    } else {
      nextAttendees = [
        ...attendees,
        {
          id: `att-ext-${crypto.randomUUID()}`,
          name,
          company: company || undefined,
          isExternal: true,
          signedAt: new Date().toISOString(),
          signature,
          orientationGiven,
        },
      ];
    }

    const { error: upErr } = await admin
      .from("form_instances")
      .update({
        attendees: nextAttendees,
        updated_at: new Date().toISOString(),
      })
      .eq("id", instance.id);

    if (upErr) {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    const { error: logErr } = await admin.from("form_external_signatures_log").insert({
      form_instance_id: instance.id,
      attendee_name: name,
      attendee_company: company || null,
      attendee_email: email || null,
      ip_address: ip,
      user_agent: userAgent,
    });

    if (logErr) {
      console.error("[forms/external/sign] audit log", logErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[forms/external/sign]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
