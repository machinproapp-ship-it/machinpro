/** In-memory sliding-window rate limits per deployment instance (adequate for basic API protection). */

import type { NextRequest } from "next/server";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetUnix: number;
  limit: number;
};

export function rateLimitRecord(
  store: Map<string, number[]>,
  key: string,
  opts: { windowMs: number; max: number }
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const prev = store.get(key) ?? [];
  const trimmed = prev.filter((t) => t > cutoff);
  const oldest = trimmed[0] ?? now;
  const resetUnix = Math.ceil((oldest + opts.windowMs) / 1000);
  if (trimmed.length >= opts.max) {
    return {
      ok: false,
      remaining: 0,
      resetUnix,
      limit: opts.max,
    };
  }
  trimmed.push(now);
  store.set(key, trimmed);
  const remaining = Math.max(0, opts.max - trimmed.length);
  return { ok: true, remaining, resetUnix, limit: opts.max };
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(Math.max(0, r.remaining)),
    "X-RateLimit-Reset": String(r.resetUnix),
  };
}

export function clientIpFromHeaders(getHeader: (name: string) => string | null): string {
  const xf = getHeader("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = getHeader("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

export function clientIpFromNextRequest(req: NextRequest): string {
  return clientIpFromHeaders((name) => req.headers.get(name));
}
