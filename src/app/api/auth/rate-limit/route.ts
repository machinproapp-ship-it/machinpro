import { NextRequest, NextResponse } from "next/server";
import {
  clientIpFromNextRequest,
  rateLimitHeaders,
  rateLimitRecord,
} from "@/lib/ipRateLimiter";

export const runtime = "nodejs";

/** Failed login attempts per IP — max 5 per rolling minute. */
const WINDOW_MS = 60 * 1000;
const MAX_IP_FAILS = 5;

const ipFails = new Map<string, number[]>();

export async function GET(req: NextRequest) {
  const ip = clientIpFromNextRequest(req);
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const arr = (ipFails.get(ip) ?? []).filter((t) => t > cutoff);
  ipFails.set(ip, arr);
  const blocked = arr.length >= MAX_IP_FAILS;
  const attemptsLeft = Math.max(0, MAX_IP_FAILS - arr.length);
  const oldest = arr[0];
  const resetIn = oldest ? Math.max(0, Math.ceil((oldest + WINDOW_MS - now) / 1000)) : 0;
  return NextResponse.json({ blocked, attemptsLeft, resetIn });
}

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ip = clientIpFromNextRequest(req);
  const rl = rateLimitRecord(ipFails, ip, { windowMs: WINDOW_MS, max: MAX_IP_FAILS });
  const rh = rateLimitHeaders(rl);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429, headers: rh });
  }
  void body.email;
  return NextResponse.json({ ok: true }, { headers: rh });
}

export async function DELETE(req: NextRequest) {
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ip = clientIpFromNextRequest(req);
  ipFails.delete(ip);
  void body.email;
  return NextResponse.json({ ok: true });
}
