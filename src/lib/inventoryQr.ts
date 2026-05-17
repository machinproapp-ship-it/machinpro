import QRCode from "qrcode";

export type InventoryQrPayload = {
  companyId: string;
  itemId: string;
  itemName: string;
  type: string;
};

export type ParsedMachinProQr =
  | { kind: "item"; companyId: string; itemId: string; itemName: string; type: string }
  | { kind: "blank"; companyId: string; blankId: string };

/** MachinPro v1 QR payload for existing inventory items. */
export function buildInventoryQrV1Payload(companyId: string, itemId: string): string {
  return JSON.stringify({ v: 1, companyId, itemId });
}

/** MachinPro v1 QR payload for blank (virgin) labels. */
export function buildInventoryQrBlankV1Payload(companyId: string, blankId: string): string {
  return JSON.stringify({ v: 1, companyId, blankId });
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

export async function generateQrDataUrlFromText(data: string, width = 200): Promise<string> {
  return QRCode.toDataURL(data, {
    margin: 0,
    width,
    errorCorrectionLevel: "M",
  });
}

/** Parse MachinPro JSON QR (item or blank). */
export function parseMachinProQr(scanText: string): ParsedMachinProQr | null {
  const t = scanText.trim();
  if (!t) return null;
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    if (o.v === 1 && typeof o.companyId === "string") {
      if (typeof o.blankId === "string") {
        return { kind: "blank", companyId: o.companyId, blankId: o.blankId };
      }
      if (typeof o.itemId === "string") {
        return {
          kind: "item",
          companyId: o.companyId,
          itemId: o.itemId,
          itemName: typeof o.itemName === "string" ? o.itemName : "",
          type: typeof o.type === "string" ? o.type : "",
        };
      }
    }
    if (
      typeof o.companyId === "string" &&
      typeof o.itemId === "string" &&
      typeof o.itemName === "string" &&
      typeof o.type === "string"
    ) {
      return {
        kind: "item",
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

/** @deprecated Prefer `parseMachinProQr`. Returns item payloads only. */
export function parseInventoryQrPayload(scanText: string): InventoryQrPayload | null {
  const parsed = parseMachinProQr(scanText);
  if (!parsed || parsed.kind !== "item") return null;
  return {
    companyId: parsed.companyId,
    itemId: parsed.itemId,
    itemName: parsed.itemName,
    type: parsed.type,
  };
}
