import { parseMachinProQr } from "@/lib/inventoryQr";
import { fetchBlankLabelById, fetchBlankLabelByQrCode } from "@/lib/inventoryBlankLabels";

/** Minimal fields needed to match a scanned QR against local inventory rows. */
export type InventoryQrLookupRow = {
  id: string;
  deletedAt?: string;
  qrCodeText?: string;
  name?: string;
};

export type InventoryQrScanResult =
  | { kind: "item"; itemId: string }
  | {
      kind: "blank_available";
      blankId: string;
      qrCode: string;
      sequenceNumber: number;
    }
  | {
      kind: "blank_consumed";
      blankId: string;
      itemId: string;
      sequenceNumber: number;
      itemName?: string;
    }
  | { kind: "legacy_plain"; qrCode: string; itemId?: string }
  | { kind: "unknown" };

/** Resolve inventory item id from MachinPro JSON QR or plain `qr_code` text (same company). */
export function resolveInventoryItemIdFromQrScan(
  scanText: string,
  items: InventoryQrLookupRow[],
  companyId?: string | null
): string | undefined {
  const trimmed = scanText.trim();
  if (!trimmed) return undefined;

  const parsed = parseMachinProQr(trimmed);
  if (parsed?.kind === "item" && (!companyId || parsed.companyId === companyId)) {
    const byPayload = items.find((i) => i.id === parsed.itemId && !i.deletedAt);
    if (byPayload) return byPayload.id;
  }

  const byPlain = items.find((i) => !i.deletedAt && i.qrCodeText?.trim() === trimmed);
  return byPlain?.id;
}

/** Full QR scan resolution: items, blank labels, legacy plain text. */
export async function resolveInventoryQrScan(
  scanText: string,
  items: InventoryQrLookupRow[],
  companyId?: string | null
): Promise<InventoryQrScanResult> {
  const trimmed = scanText.trim();
  if (!trimmed) return { kind: "unknown" };

  const parsed = parseMachinProQr(trimmed);

  if (parsed?.kind === "item") {
    if (companyId && parsed.companyId !== companyId) {
      return { kind: "unknown" };
    }
    const byPayload = items.find((i) => i.id === parsed.itemId && !i.deletedAt);
    if (byPayload) return { kind: "item", itemId: byPayload.id };
    return { kind: "unknown" };
  }

  if (parsed?.kind === "blank") {
    if (companyId && parsed.companyId !== companyId) {
      return { kind: "unknown" };
    }
    if (!companyId) return { kind: "unknown" };

    const row =
      (await fetchBlankLabelByQrCode(companyId, trimmed)) ??
      (await fetchBlankLabelById(companyId, parsed.blankId));

    if (!row) return { kind: "unknown" };

    if (row.consumed_at && row.consumed_into_item_id) {
      const consumedItem = items.find(
        (i) => i.id === row.consumed_into_item_id && !i.deletedAt
      );
      return {
        kind: "blank_consumed",
        blankId: row.id,
        itemId: row.consumed_into_item_id,
        sequenceNumber: row.sequence_number,
        itemName: consumedItem?.name,
      };
    }

    return {
      kind: "blank_available",
      blankId: row.id,
      qrCode: row.qr_code,
      sequenceNumber: row.sequence_number,
    };
  }

  const legacyItemId = resolveInventoryItemIdFromQrScan(trimmed, items, companyId);
  if (legacyItemId) {
    return { kind: "item", itemId: legacyItemId };
  }

  if (!parsed) {
    return { kind: "legacy_plain", qrCode: trimmed };
  }

  return { kind: "unknown" };
}
