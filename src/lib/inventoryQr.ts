import QRCode from "qrcode";

export type InventoryQrPayload = {
  companyId: string;
  itemId: string;
  itemName: string;
  type: string;
};

/** MachinPro v1 QR payload (tenant-safe, used on printed Avery labels). */
export function buildInventoryQrV1Payload(companyId: string, itemId: string): string {
  return JSON.stringify({ v: 1, companyId, itemId });
}

export async function generateInventoryQrDataUrl(payload: InventoryQrPayload): Promise<string> {
  const data = JSON.stringify(payload);
  return QRCode.toDataURL(data, { margin: 1, width: 280, errorCorrectionLevel: "M" });
}

export async function generateInventoryQrV1DataUrl(
  companyId: string,
  itemId: string,
  width = 200
): Promise<string> {
  return QRCode.toDataURL(buildInventoryQrV1Payload(companyId, itemId), {
    margin: 0,
    width,
    errorCorrectionLevel: "M",
  });
}

/** Intenta parsear JSON del QR; si falla, devuelve null. */
export function parseInventoryQrPayload(scanText: string): InventoryQrPayload | null {
  const t = scanText.trim();
  if (!t) return null;
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    if (
      o.v === 1 &&
      typeof o.companyId === "string" &&
      typeof o.itemId === "string"
    ) {
      return {
        companyId: o.companyId,
        itemId: o.itemId,
        itemName: typeof o.itemName === "string" ? o.itemName : "",
        type: typeof o.type === "string" ? o.type : "",
      };
    }
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
