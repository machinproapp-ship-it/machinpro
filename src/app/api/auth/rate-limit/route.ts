import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_IP_FAILS = 5;
const MAX_EMAIL_FAILS = 10;

const ipFails = new Map<string, number[]>();
const emailFails = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

function prune(ts: number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;
  return ts.filter((t) => t > cutoff);
}

function pushFail(map: Map<string, number[]>, key: string, now: number) {
  const cur = prune(map.get(key) ?? [], now);
  cur.push(now);
  map.set(key, cur);
}

function clearKey(map: Map<string, number[]>, key: string) {
  map.delete(key);
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  const now = Date.now();
  const ipKey = ip;
  const emailKey = email || "_";
  const ipArr = prune(ipFails.get(ipKey) ?? [], now);
  const emailArr = prune(emailFails.get(emailKey) ?? [], now);
  const ipBlocked = ipArr.length >= MAX_IP_FAILS;
  const emailBlocked = email && emailArr.length >= MAX_EMAIL_FAILS;
  const blocked = ipBlocked || emailBlocked;
  const ipLeft = Math.max(0, MAX_IP_FAILS - ipArr.length);
  const emailLeft = email ? Math.max(0, MAX_EMAIL_FAILS - emailArr.length) : MAX_EMAIL_FAILS;
  const attemptsLeft = Math.min(ipLeft, emailLeft);
  const oldest = [...ipArr, ...emailArr].sort((a, b) => a - b)[0];
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
  const ip = clientIp(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const now = Date.now();
  pushFail(ipFails, ip, now);
  if (email) pushFail(emailFails, email, now);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ip = clientIp(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  clearKey(ipFails, ip);
  if (email) clearKey(emailFails, email);
  return NextResponse.json({ ok: true });
}
