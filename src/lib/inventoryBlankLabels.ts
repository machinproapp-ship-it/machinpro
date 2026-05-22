import { supabase } from "@/lib/supabase";
import { buildInventoryBlankQrPayload } from "@/lib/inventoryQr";

export type InventoryBlankLabelRow = {
  id: string;
  company_id: string;
  qr_code: string;
  sequence_number: number;
  generated_at: string;
  generated_by: string | null;
  consumed_at: string | null;
  consumed_into_item_id: string | null;
};

export type BlankLabelInsertRow = {
  id: string;
  company_id: string;
  qr_code: string;
  sequence_number: number;
  generated_by: string | null;
};

/** Padding: #001 if N<1000, #01 if N<100 (spec). */
export function formatBlankLabelSequence(sequenceNumber: number, batchTotal: number): string {
  const pad = batchTotal >= 1000 ? 4 : batchTotal >= 100 ? 3 : 2;
  return `#${String(sequenceNumber).padStart(pad, "0")}`;
}

export function newBlankLabelId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `blank-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function getMaxBlankLabelSequence(companyId: string): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from("inventory_blank_labels")
    .select("sequence_number")
    .eq("company_id", companyId)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return typeof data?.sequence_number === "number" ? data.sequence_number : 0;
}

export function buildBlankLabelsBatch(
  companyId: string,
  count: number,
  startSequence: number,
  generatedBy: string | null
): BlankLabelInsertRow[] {
  const rows: BlankLabelInsertRow[] = [];
  for (let i = 0; i < count; i++) {
    const id = newBlankLabelId();
    const sequence_number = startSequence + i + 1;
    rows.push({
      id,
      company_id: companyId,
      qr_code: buildInventoryBlankQrPayload(id),
      sequence_number,
      generated_by: generatedBy,
    });
  }
  return rows;
}

export async function insertBlankLabelsBatch(rows: BlankLabelInsertRow[]): Promise<void> {
  if (!supabase) throw new Error("supabase_unavailable");
  const { error } = await supabase.from("inventory_blank_labels").insert(rows);
  if (error) throw error;
}

export async function fetchBlankLabelByQrCode(
  companyId: string,
  qrCode: string
): Promise<InventoryBlankLabelRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("inventory_blank_labels")
    .select("*")
    .eq("company_id", companyId)
    .eq("qr_code", qrCode.trim())
    .maybeSingle();
  if (error) throw error;
  return data as InventoryBlankLabelRow | null;
}

export async function fetchBlankLabelById(
  companyId: string,
  blankId: string
): Promise<InventoryBlankLabelRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("inventory_blank_labels")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", blankId)
    .maybeSingle();
  if (error) throw error;
  return data as InventoryBlankLabelRow | null;
}

export async function consumeBlankLabel(
  companyId: string,
  blankLabelId: string,
  itemId: string
): Promise<void> {
  if (!supabase) throw new Error("supabase_unavailable");
  const { error } = await supabase
    .from("inventory_blank_labels")
    .update({
      consumed_at: new Date().toISOString(),
      consumed_into_item_id: itemId,
    })
    .eq("company_id", companyId)
    .eq("id", blankLabelId)
    .is("consumed_at", null);
  if (error) throw error;
}
