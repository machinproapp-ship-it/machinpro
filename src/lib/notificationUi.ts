/** Etiquetas de lista según type (claves en locales). */
export function notificationDisplayTitle(type: string, storedTitle: string, tl: Record<string, string>): string {
  const map: Record<string, string> = {
    photo_approved: tl.notif_photo_approved_title ?? storedTitle,
    photo_rejected: tl.notif_photo_rejected_title ?? storedTitle,
    project_assigned: tl.notif_project_assigned_title ?? storedTitle,
    shift_created: tl.notif_shift_created_title ?? storedTitle,
    shift_updated: tl.notif_shift_updated_title ?? storedTitle,
    daily_report_pending: tl.notif_daily_report_title ?? storedTitle,
  };
  return map[type] ?? storedTitle ?? "";
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
