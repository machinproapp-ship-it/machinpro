import QRCode from "qrcode";

export type InventoryQrPayload = {
  companyId: string;
  itemId: string;
  itemName: string;
  type: string;
};

export async function generateInventoryQrDataUrl(payload: InventoryQrPayload): Promise<string> {
  const data = JSON.stringify(payload);
  return QRCode.toDataURL(data, { margin: 1, width: 280, errorCorrectionLevel: "M" });
}

/** Intenta parsear JSON del QR; si falla, devuelve null. */
export function parseInventoryQrPayload(scanText: string): InventoryQrPayload | null {
  const t = scanText.trim();
  if (!t) return null;
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    if (
      typeof o.companyId === "string" &&
      typeof o.itemId === "string" &&
      typeof o.itemName === "string" &&
      typeof o.type === "string"
    ) {
      return {
        companyId: o.companyId,
        itemId: o.itemId,
        itemName: o.itemName,
        type: o.type,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}
