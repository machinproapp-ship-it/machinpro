import { parseInventoryQrUrl } from "@/lib/inventoryQrUrl";
import { parseMachinProQr } from "@/lib/inventoryQr";
import { buildInventoryBlankQrUrl } from "@/lib/inventoryQrUrl";
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

function findItemById(items: InventoryQrLookupRow[], itemId: string): string | undefined {
  const row = items.find((i) => i.id === itemId && !i.deletedAt);
  return row?.id;
}

async function resolveBlankById(
  blankId: string,
  companyId: string,
  items: InventoryQrLookupRow[],
  qrCodeForAvailable?: string
): Promise<InventoryQrScanResult> {
  const row = await fetchBlankLabelById(companyId, blankId);
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
    qrCode: qrCodeForAvailable ?? row.qr_code ?? buildInventoryBlankQrUrl(row.id),
    sequenceNumber: row.sequence_number,
  };
}

/** Resolve inventory item id from MachinPro QR URL, JSON, or plain `qr_code` text. */
export function resolveInventoryItemIdFromQrScan(
  scanText: string,
  items: InventoryQrLookupRow[],
  companyId?: string | null
): string | undefined {
  const trimmed = scanText.trim();
  if (!trimmed) return undefined;

  const urlParsed = parseInventoryQrUrl(trimmed);
  if (urlParsed?.kind === "item") {
    return findItemById(items, urlParsed.itemId);
  }

  const parsed = parseMachinProQr(trimmed);
  if (parsed?.kind === "item" && (!companyId || parsed.companyId === companyId)) {
    return findItemById(items, parsed.itemId);
  }

  const byPlain = items.find((i) => !i.deletedAt && i.qrCodeText?.trim() === trimmed);
  return byPlain?.id;
}

/** Full QR scan resolution: URL paths, legacy JSON, blank labels, plain text. */
export async function resolveInventoryQrScan(
  scanText: string,
  items: InventoryQrLookupRow[],
  companyId?: string | null
): Promise<InventoryQrScanResult> {
  const trimmed = scanText.trim();
  if (!trimmed) return { kind: "unknown" };

  const urlParsed = parseInventoryQrUrl(trimmed);
  if (urlParsed) {
    if (urlParsed.kind === "item") {
      const itemId = findItemById(items, urlParsed.itemId);
      if (itemId) return { kind: "item", itemId };
      return { kind: "unknown" };
    }
    if (!companyId) return { kind: "unknown" };
    return resolveBlankById(urlParsed.blankId, companyId, items, trimmed);
  }

  const parsed = parseMachinProQr(trimmed);

  if (parsed?.kind === "item") {
    if (companyId && parsed.companyId !== companyId) {
      return { kind: "unknown" };
    }
    const itemId = findItemById(items, parsed.itemId);
    if (itemId) return { kind: "item", itemId };
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
