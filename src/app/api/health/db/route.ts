import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const start = Date.now();
    const { error } = await supabase.from("companies").select("id").limit(1);
    const elapsed = Date.now() - start;

    if (error) {
      return NextResponse.json(
        { status: "error", error: error.message, elapsed_ms: elapsed },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        service: "machinpro-db",
        elapsed_ms: elapsed,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: String(err) },
      { status: 503 }
    );
  }
}
