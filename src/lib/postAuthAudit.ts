/** Best-effort client-side auth audit POST; never throws. */
export async function postAuthAudit(opts: {
  action: string;
  email?: string;
  companyId?: string | null;
  accessToken?: string | null;
}): Promise<void> {
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    await fetch(`${origin}/api/auth/audit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.accessToken ? { Authorization: `Bearer ${opts.accessToken}` } : {}),
      },
      body: JSON.stringify({
        action: opts.action,
        ...(opts.email ? { email: opts.email } : {}),
        ...(opts.companyId ? { companyId: opts.companyId } : {}),
      }),
    });
  } catch {
    /* ignore */
  }
}
