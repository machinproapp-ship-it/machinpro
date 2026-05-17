import { pdf } from "@react-pdf/renderer";
import { QrLabelsPdf, type QrLabelPdfItem } from "@/components/inventory/QrLabelsPdf";
import { generateQrDataUrlFromText } from "@/lib/inventoryQr";
import type { AveryLabelFormat } from "@/lib/inventoryQrLabelFormats";
import { formatBlankLabelSequence, type BlankLabelInsertRow } from "@/lib/inventoryBlankLabels";

function safeFilenamePart(value: string): string {
  return value.replace(/[^\w\-]+/g, "_").slice(0, 40) || "company";
}

export function buildBlankQrLabelsPdfFilename(companyName: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `MachinPro_QR_BlankLabels_${safeFilenamePart(companyName)}_${day}.pdf`;
}

export async function downloadBlankInventoryQrLabelsPdf(opts: {
  rows: BlankLabelInsertRow[];
  format: AveryLabelFormat;
  companyName: string;
}): Promise<{ filename: string; count: number }> {
  const qrWidth = opts.format === "avery-5160" || opts.format === "avery-5161" ? 120 : 160;
  const total = opts.rows.length;

  const withQr: QrLabelPdfItem[] = await Promise.all(
    opts.rows.map(async (row) => ({
      id: row.id,
      name: formatBlankLabelSequence(row.sequence_number, total),
      qrDataUrl: await generateQrDataUrlFromText(row.qr_code, qrWidth),
    }))
  );

  const blob = await pdf(
    <QrLabelsPdf items={withQr} format={opts.format} companyName="" variant="blank" />
  ).toBlob();

  const filename = buildBlankQrLabelsPdfFilename(opts.companyName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return { filename, count: opts.rows.length };
}
