/** Etiquetas de lista según type (claves en locales). */
export function notificationDisplayTitle(type: string, storedTitle: string, tl: Record<string, string>): string {
  const map: Record<string, string> = {
    photo_approved: tl.notif_photo_approved_title ?? storedTitle,
    photo_rejected: tl.notif_photo_rejected_title ?? storedTitle,
    project_assigned: tl.notif_project_assigned_title ?? storedTitle,
    shift_created: tl.notif_shift_created_title ?? storedTitle,
    shift_updated: tl.notif_shift_updated_title ?? storedTitle,
    daily_report_pending: tl.notif_daily_report_title ?? storedTitle,
    daily_report_submitted: tl.notif_daily_report_submitted_title ?? storedTitle,
    cert_expiring_15: tl.notif_cert_expiring_15_title ?? storedTitle,
    cert_expiring_7: tl.notif_cert_expiring_7_title ?? storedTitle,
    cert_expired: tl.notif_cert_expired_title ?? storedTitle,
  };
  return map[type] ?? storedTitle ?? "";
}

export function notificationDisplayBody(
  type: string,
  storedBody: string | null | undefined,
  data: Record<string, unknown> | null | undefined,
  tl: Record<string, string>
): string | null {
  const cert = typeof data?.cert_name === "string" ? data.cert_name : "";
  const proj = typeof data?.project === "string" ? data.project : "";
  const dt = typeof data?.date === "string" ? data.date : "";
  const map: Record<string, string> = {
    daily_report_submitted: (tl.notif_daily_report_submitted_body ?? "")
      .replace(/\{project\}/g, proj)
      .replace(/\{date\}/g, dt),
    cert_expiring_15: (tl.notif_cert_expiring_15_body ?? "").replace(/\{cert\}/g, cert),
    cert_expiring_7: (tl.notif_cert_expiring_7_body ?? "").replace(/\{cert\}/g, cert),
    cert_expired: (tl.notif_cert_expired_body ?? "").replace(/\{cert\}/g, cert),
  };
  const localized = map[type];
  if (localized) return localized || null;
  return storedBody ?? null;
}

export function formatNotificationRelative(iso: string, tl: Record<string, string>): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return tl.notifications_just_now ?? "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return (tl.notifications_minutes_ago ?? "{n} min ago").replace("{n}", String(Math.max(1, min)));
  const h = Math.floor(min / 60);
  if (h < 48) return (tl.notifications_hours_ago ?? "{n} h ago").replace("{n}", String(Math.max(1, h)));
  const d = Math.floor(h / 24);
  return (tl.notifications_days_ago ?? "{n} d ago").replace("{n}", String(Math.max(1, d)));
}
