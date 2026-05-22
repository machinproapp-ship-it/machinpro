import QRCode from "qrcode";
import {
  buildInventoryBlankQrUrl,
  buildInventoryItemQrUrl,
  parseInventoryQrUrl,
  type ParsedInventoryQrUrl,
} from "@/lib/inventoryQrUrl";

export type { ParsedInventoryQrUrl };

export type InventoryQrPayload = {
  companyId: string;
  itemId: string;
  itemName: string;
  type: string;
};

export type ParsedMachinProQr =
  | { kind: "item"; companyId: string; itemId: string; itemName: string; type: string }
  | { kind: "blank"; companyId: string; blankId: string };

/** @deprecated Use `buildInventoryItemQrUrl`. Legacy JSON v1 for old printed labels. */
export function buildInventoryQrV1Payload(companyId: string, itemId: string): string {
  return JSON.stringify({ v: 1, companyId, itemId });
}

/** @deprecated Use `buildInventoryBlankQrUrl`. Legacy JSON v1 for old printed labels. */
export function buildInventoryQrBlankV1Payload(companyId: string, blankId: string): string {
  return JSON.stringify({ v: 1, companyId, blankId });
}

export function buildInventoryItemQrPayload(itemId: string): string {
  return buildInventoryItemQrUrl(itemId);
}

export function buildInventoryBlankQrPayload(blankId: string): string {
  return buildInventoryBlankQrUrl(blankId);
}

export async function generateInventoryQrDataUrl(payload: InventoryQrPayload): Promise<string> {
  return generateQrDataUrlFromText(buildInventoryItemQrUrl(payload.itemId), 280);
}

export async function generateInventoryQrV1DataUrl(
  itemId: string,
  _companyId?: string,
  width = 200
): Promise<string> {
  return generateQrDataUrlFromText(buildInventoryItemQrUrl(itemId), width);
}

export async function generateQrDataUrlFromText(data: string, width = 200): Promise<string> {
  return QRCode.toDataURL(data, {
    margin: 0,
    width,
    errorCorrectionLevel: "M",
  });
}

/** Parse legacy JSON MachinPro QR (item or blank). URL payloads use `parseInventoryQrUrl`. */
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

/** Unified parse: URL first, then legacy JSON. */
export function parseInventoryQrPayload(
  scanText: string
): ParsedMachinProQr | ParsedInventoryQrUrl | null {
  const urlParsed = parseInventoryQrUrl(scanText);
  if (urlParsed) return urlParsed;
  return parseMachinProQr(scanText);
}
