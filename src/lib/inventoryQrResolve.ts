import { parseInventoryQrPayload } from "@/lib/inventoryQr";

/** Minimal fields needed to match a scanned QR against local inventory rows. */
export type InventoryQrLookupRow = {
  id: string;
  deletedAt?: string;
  qrCodeText?: string;
};

/** Resolve inventory item id from MachinPro JSON QR or plain `qr_code` text (same company). */
export function resolveInventoryItemIdFromQrScan(
  scanText: string,
  items: InventoryQrLookupRow[],
  companyId?: string | null
): string | undefined {
  const trimmed = scanText.trim();
  if (!trimmed) return undefined;

  const payload = parseInventoryQrPayload(trimmed);
  if (payload && (!companyId || payload.companyId === companyId)) {
    const byPayload = items.find((i) => i.id === payload.itemId && !i.deletedAt);
    if (byPayload) return byPayload.id;
  }

  const byPlain = items.find((i) => !i.deletedAt && i.qrCodeText?.trim() === trimmed);
  return byPlain?.id;
}
