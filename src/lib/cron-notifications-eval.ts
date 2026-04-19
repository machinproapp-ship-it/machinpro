import type { SupabaseClient } from "@supabase/supabase-js";
import { runTrialExpiryNotificationsForCompany } from "@/lib/cron-trial-expiry";
import { insertNotificationRow } from "@/lib/notifications-server";
import { dispatchWebPushToUser } from "@/lib/push-dispatch";

const DEDUP_HOURS = 23;

async function recentNotificationExists(
  admin: SupabaseClient,
  companyId: string,
  userId: string,
  type: string,
  dedupeKey: string
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_HOURS * 3600000).toISOString();
  const { data, error } = await admin
    .from("notifications")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("type", type)
    .gte("created_at", since)
    .filter("data->>dedupe", "eq", dedupeKey)
    .limit(1);
  if (error) return true;
  return (data?.length ?? 0) > 0;
}

async function notifyUser(
  admin: SupabaseClient,
  companyId: string,
  userId: string,
  type: string,
  title: string,
  body: string,
  dedupeKey: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  if (await recentNotificationExists(admin, companyId, userId, type, dedupeKey)) return false;
  const ins = await insertNotificationRow(admin, {
    company_id: companyId,
    user_id: userId,
    type,
    title,
    body,
    data: { dedupe: dedupeKey, ...(data ?? {}) },
  });
  if (!ins.ok) return false;
  await dispatchWebPushToUser(admin, companyId, userId, { title, body, type, url: "/" });
  return true;
}

async function profileIdsByRoles(
  admin: SupabaseClient,
  companyId: string,
  roles: string[]
): Promise<string[]> {
  const { data, error } = await admin
    .from("user_profiles")
    .select("id, role")
    .eq("company_id", companyId);
  if (error || !data?.length) return [];
  const set = new Set(roles.map((r) => r.toLowerCase()));
  return (data as { id: string; role?: string }[])
    .filter((r) => set.has(String(r.role ?? "").toLowerCase()))
    .map((r) => String(r.id));
}

async function adminIds(admin: SupabaseClient, companyId: string): Promise<string[]> {
  return profileIdsByRoles(admin, companyId, ["admin"]);
}

async function formApproverIds(admin: SupabaseClient, companyId: string): Promise<string[]> {
  return profileIdsByRoles(admin, companyId, ["admin", "supervisor"]);
}

async function inventoryAlertRecipientIds(admin: SupabaseClient, companyId: string): Promise<string[]> {
  return profileIdsByRoles(admin, companyId, ["admin", "supervisor", "logistic"]);
}

async function notifyMany(
  admin: SupabaseClient,
  companyId: string,
  userIds: string[],
  type: string,
  title: string,
  body: string,
  dedupeKey: string,
  data?: Record<string, unknown>
): Promise<number> {
  let n = 0;
  const uniq = [...new Set(userIds)];
  for (const uid of uniq) {
    const ok = await notifyUser(admin, companyId, uid, type, title, body, dedupeKey, data);
    if (ok) n += 1;
  }
  return n;
}

/** Best-effort cron evaluation: tolerates missing tables/columns (Supabase errors → skip). */
export async function runCronNotificationsForCompany(
  admin: SupabaseClient,
  companyId: string
): Promise<{ created: number; skipped: string[] }> {
  let created = 0;
  const skipped: string[] = [];

  const admins = await adminIds(admin, companyId);
  if (!admins.length) skipped.push("no_admins");

  const run = async (label: string, fn: () => Promise<number>) => {
    try {
      created += await fn();
    } catch (e) {
      skipped.push(`${label}:${e instanceof Error ? e.message : String(e)}`);
    }
  };

  await run("certificates_expiring", async () => {
    let n = 0;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("certificates")
      .select("id, name, expiry_date, company_id, employee_id")
      .eq("company_id", companyId)
      .lte("expiry_date", ymd(in30))
      .gt("expiry_date", ymd(now));
    if (error) return 0;
    for (const row of (data ?? []) as { id: string; name?: string; expiry_date?: string }[]) {
      const dedupe = `cert_exp_30:${row.id}:${row.expiry_date ?? ""}`;
      const title = "Certificate expiring soon";
      const body = `${row.name ?? "Certificate"} · ${row.expiry_date ?? ""}`;
      n += await notifyMany(admin, companyId, admins, "cron_cert_expiring_30", title, body, dedupe, {
        certificate_id: row.id,
      });
    }
    return n;
  });

  await run("certificates_expired", async () => {
    let n = 0;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("certificates")
      .select("id, name, expiry_date, company_id")
      .eq("company_id", companyId)
      .lt("expiry_date", today);
    if (error) return 0;
    for (const row of (data ?? []) as { id: string; name?: string; expiry_date?: string }[]) {
      const dedupe = `cert_expired:${row.id}:${today}`;
      n += await notifyMany(admin, companyId, admins, "cron_cert_expired", "Certificate expired", `${row.name ?? "Certificate"} · ${row.expiry_date ?? ""}`, dedupe, {
        certificate_id: row.id,
      });
    }
    return n;
  });

  await run("inventory_low", async () => {
    const recipients = [...new Set([...admins, ...(await inventoryAlertRecipientIds(admin, companyId))])];
    if (!recipients.length) return 0;
    let n = 0;
    const { data, error } = await admin
      .from("inventory_items")
      .select("id, name, quantity, min_stock, low_stock_threshold, company_id")
      .eq("company_id", companyId);
    if (error) return 0;
    for (const row of (data ?? []) as {
      id: string;
      name?: string;
      quantity?: number;
      min_stock?: number;
      low_stock_threshold?: number;
    }[]) {
      const min = Number(row.min_stock ?? row.low_stock_threshold ?? 0);
      const qty = Number(row.quantity ?? 0);
      if (min <= 0 || qty > min) continue;
      const dedupe = `inv_low:${row.id}`;
      n += await notifyMany(
        admin,
        companyId,
        recipients,
        "cron_inventory_low",
        "Low stock",
        `${row.name ?? "Item"} · ${qty} (min ${min})`,
        dedupe,
        { inventory_item_id: row.id }
      );
    }
    return n;
  });

  await run("inventory_onsite_30d", async () => {
    let n = 0;
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data, error } = await admin
      .from("inventory_items")
      .select("id, name, location, updated_at, company_id")
      .eq("company_id", companyId)
      .eq("location", "onsite")
      .lt("updated_at", cutoff);
    if (error) return 0;
    for (const row of (data ?? []) as { id: string; name?: string }[]) {
      const dedupe = `onsite30:${row.id}:${cutoff.slice(0, 10)}`;
      n += await notifyMany(
        admin,
        companyId,
        admins,
        "cron_tool_onsite_30d",
        "Tool onsite 30+ days",
        row.name ?? "Inventory item",
        dedupe,
        { inventory_item_id: row.id }
      );
    }
    return n;
  });

  await run("clock_open_12h", async () => {
    let n = 0;
    const cutoff = new Date(Date.now() - 12 * 3600000).toISOString();
    const { data, error } = await admin
      .from("clock_entries")
      .select("id, employee_id, clock_out, updated_at, clock_in_at, company_id, date")
      .eq("company_id", companyId)
      .is("clock_out", null);
    if (error) {
      const { data: rows, error: e2 } = await admin.from("clock_entries").select("id, employee_id, clock_out, date").is("clock_out", null);
      if (e2 || !rows?.length) return 0;
      const today = new Date();
      for (const row of rows as { id: string; employee_id?: string; date?: string }[]) {
        const d = row.date ? new Date(row.date + "T23:59:59") : null;
        if (!d || today.getTime() - d.getTime() < 12 * 3600000) continue;
        const dedupe = `clock12:${row.id}`;
        n += await notifyMany(
          admin,
          companyId,
          admins,
          "cron_clock_open_12h",
          "Open clock entry 12+ hours",
          `Employee ${row.employee_id ?? "?"} · ${row.date ?? ""}`,
          dedupe,
          { clock_entry_id: row.id }
        );
      }
      return n;
    }
    for (const row of (data ?? []) as {
      id: string;
      employee_id?: string;
      updated_at?: string;
      clock_in_at?: string;
    }[]) {
      const ts = row.clock_in_at || row.updated_at;
      if (ts && new Date(ts).getTime() > new Date(cutoff).getTime()) continue;
      const dedupe = `clock12:${row.id}`;
      n += await notifyMany(
        admin,
        companyId,
        admins,
        "cron_clock_open_12h",
        "Open clock entry 12+ hours",
        `Employee ${row.employee_id ?? "?"}`,
        dedupe,
        { clock_entry_id: row.id }
      );
    }
    return n;
  });

  await run("training_expiring", async () => {
    let n = 0;
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("training_records")
      .select("id, expiry_date, company_id, user_id, course_name")
      .eq("company_id", companyId)
      .lte("expiry_date", in30)
      .gt("expiry_date", today);
    if (error) {
      const { data: alt, error: e2 } = await admin
        .from("training_assignments")
        .select("id, expires_at, company_id, user_id")
        .eq("company_id", companyId)
        .not("expires_at", "is", null)
        .lte("expires_at", in30)
        .gt("expires_at", new Date().toISOString());
      if (e2 || !alt?.length) return 0;
      for (const row of alt as { id: string; expires_at?: string }[]) {
        const dedupe = `train_exp:${row.id}`;
        n += await notifyMany(
          admin,
          companyId,
          admins,
          "cron_training_expiring",
          "Training expiring soon",
          row.expires_at ?? "",
          dedupe,
          { training_assignment_id: row.id }
        );
      }
      return n;
    }
    for (const row of (data ?? []) as { id: string; expiry_date?: string; course_name?: string }[]) {
      const dedupe = `train_exp:${row.id}`;
      n += await notifyMany(
        admin,
        companyId,
        admins,
        "cron_training_expiring",
        "Training expiring soon",
        `${row.course_name ?? "Training"} · ${row.expiry_date ?? ""}`,
        dedupe,
        { training_record_id: row.id }
      );
    }
    return n;
  });

  await run("forms_pending_approval", async () => {
    const approvers = await formApproverIds(admin, companyId);
    if (!approvers.length) return 0;
    let n = 0;
    const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data, error } = await admin
      .from("form_instances")
      .select("id, status, updated_at, company_id, template_id")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .lt("updated_at", cutoff);
    if (error) return 0;
    for (const row of (data ?? []) as { id: string; template_id?: string }[]) {
      const dedupe = `form_pend:${row.id}`;
      n += await notifyMany(
        admin,
        companyId,
        approvers,
        "cron_form_pending_approval",
        "Form pending approval",
        "A completed form is waiting for approval (24h+)",
        dedupe,
        { form_instance_id: row.id, template_id: row.template_id }
      );
    }
    return n;
  });

  await run("trial_expiry", async () => {
    const r = await runTrialExpiryNotificationsForCompany(admin, companyId);
    if (r.skipped.length) {
      for (const s of r.skipped) skipped.push(`trial:${s}`);
    }
    return r.created;
  });

  return { created, skipped };
}
