import { pdf } from "@react-pdf/renderer";
import { QrLabelsPdf, type QrLabelPdfItem } from "@/components/inventory/QrLabelsPdf";
import { generateInventoryQrV1DataUrl } from "@/lib/inventoryQr";
import type { AveryLabelFormat } from "@/lib/inventoryQrLabelFormats";

export type QrLabelSourceItem = {
  id: string;
  name: string;
  model?: string;
};

function safeFilenamePart(value: string): string {
  return value.replace(/[^\w\-]+/g, "_").slice(0, 40) || "company";
}

export function buildQrLabelsPdfFilename(companyName: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `MachinPro_QR_Labels_${safeFilenamePart(companyName)}_${day}.pdf`;
}

export async function downloadInventoryQrLabelsPdf(opts: {
  items: QrLabelSourceItem[];
  format: AveryLabelFormat;
  companyId: string;
  companyName: string;
}): Promise<{ filename: string; count: number }> {
  const qrWidth = opts.format === "avery-5160" || opts.format === "avery-5161" ? 120 : 160;
  const withQr: QrLabelPdfItem[] = await Promise.all(
    opts.items.map(async (item) => ({
      id: item.id,
      name: item.name,
      model: item.model,
      qrDataUrl: await generateInventoryQrV1DataUrl(item.id, opts.companyId, qrWidth),
    }))
  );

  const blob = await pdf(
    <QrLabelsPdf items={withQr} format={opts.format} companyName={opts.companyName} />
  ).toBlob();

  const filename = buildQrLabelsPdfFilename(opts.companyName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return { filename, count: opts.items.length };
}
