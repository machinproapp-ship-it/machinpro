import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedEmployeeCert } from "@/lib/employeeCertificatesJson";
import { parseProfileCertificates } from "@/lib/employeeCertificatesJson";
import { insertNotificationRow } from "@/lib/notifications-server";
import { dispatchWebPushToUser } from "@/lib/push-dispatch";

export const CERT_NOTIF_TYPES = ["cert_expiring_15", "cert_expiring_7", "cert_expiring_3", "cert_expired"] as const;
export type CertNotificationType = (typeof CERT_NOTIF_TYPES)[number];

/** YYYY-MM-DD → days from today (local midnight). */
export function daysUntilExpiry(expiryIsoDate: string): number | null {
  const parts = expiryIsoDate.split("-").map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const expiry = new Date(y, m - 1, d);
  expiry.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((expiry.getTime() - today.getTime()) / 86400000);
}

export function classifyCertNotification(daysLeft: number): CertNotificationType | null {
  if (daysLeft < 0) return "cert_expired";
  if (daysLeft <= 3) return "cert_expiring_3";
  if (daysLeft <= 7) return "cert_expiring_7";
  if (daysLeft <= 15) return "cert_expiring_15";
  return null;
}

function isCertActive(c: ParsedEmployeeCert, daysLeft: number | null): boolean {
  if (daysLeft === null) return false;
  const st = (c.status ?? "").toLowerCase();
  if (st === "expired" && daysLeft >= 0) return false;
  return true;
}

const RECENT_MS = 7 * 86400000;

async function hasRecentCertNotification(
  admin: SupabaseClient,
  companyId: string,
  userId: string,
  type: string,
  certificateId: string
): Promise<boolean> {
  const since = new Date(Date.now() - RECENT_MS).toISOString();
  const { data, error } = await admin
    .from("notifications")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("type", type)
    .gte("created_at", since)
    .filter("data->>certificate_id", "eq", certificateId)
    .limit(1);
  if (error) return true;
  return (data?.length ?? 0) > 0;
}

async function sendCertNotification(
  admin: SupabaseClient,
  companyId: string,
  userId: string,
  type: CertNotificationType,
  cert: ParsedEmployeeCert,
  titleEn: string,
  bodyEn: string
): Promise<boolean> {
  const exists = await hasRecentCertNotification(admin, companyId, userId, type, cert.id);
  if (exists) return false;
  const res = await insertNotificationRow(admin, {
    company_id: companyId,
    user_id: userId,
    type,
    title: titleEn,
    body: bodyEn,
    data: {
      certificate_id: cert.id,
      cert_name: cert.name,
      expiry_date: cert.expiryDate,
      severity:
        type === "cert_expired"
          ? "expired"
          : type === "cert_expiring_3" || type === "cert_expiring_7"
            ? "urgent"
            : "warning",
    },
  });
  if (res.ok) {
    void dispatchWebPushToUser(admin, companyId, userId, {
      title: titleEn,
      body: bodyEn,
      url: "/",
      type,
    });
  }
  return res.ok;
}

/** Returns counts of notifications attempted vs skipped (deduped). */
export async function runCertificateNotificationsForCompany(
  admin: SupabaseClient,
  companyId: string
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;

  const { data: profiles, error: profErr } = await admin
    .from("user_profiles")
    .select("id, certificates")
    .eq("company_id", companyId);
  if (profErr) {
    return { created: 0, errors: [profErr.message] };
  }

  const rows = (profiles ?? []) as { id?: string; certificates?: unknown }[];
  const { data: adminRows, error: admErr } = await admin
    .from("user_profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("role", "admin");
  if (admErr) errors.push(admErr.message);
  const adminIds = [...new Set((adminRows ?? []).map((r) => String((r as { id: string }).id)).filter(Boolean))];

  const titleFor = (type: CertNotificationType): string => {
    if (type === "cert_expiring_15") return "Certificate expiring soon";
    if (type === "cert_expiring_7") return "Certificate expiring soon";
    if (type === "cert_expiring_3") return "Certificate expiring soon";
    return "Certificate expired";
  };
  const bodyFor = (type: CertNotificationType, certName: string): string => {
    if (type === "cert_expiring_15") return `${certName} expires in 15 days`;
    if (type === "cert_expiring_7") return `${certName} expires in 7 days`;
    if (type === "cert_expiring_3") return `${certName} expires in 3 days`;
    return `${certName} has expired`;
  };

  for (const row of rows) {
    const ownerId = row.id != null ? String(row.id) : "";
    if (!ownerId) continue;
    const certs = parseProfileCertificates(row.certificates);
    for (const cert of certs) {
      const daysLeft = daysUntilExpiry(cert.expiryDate);
      if (!isCertActive(cert, daysLeft)) continue;
      const notifType = daysLeft !== null ? classifyCertNotification(daysLeft) : null;
      if (!notifType) continue;

      const titleEn = titleFor(notifType);
      const bodyEn = bodyFor(notifType, cert.name);
      const targets = new Set<string>([ownerId, ...adminIds]);

      for (const uid of targets) {
        try {
          const ok = await sendCertNotification(admin, companyId, uid, notifType, cert, titleEn, bodyEn);
          if (ok) created += 1;
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }
    }
  }

  return { created, errors };
}
