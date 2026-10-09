import { jsPDF } from "jspdf";
import { drawMachinProPdfFooter, drawPdfBrandedHeader, fetchImageDataUrl, imageFormatFromDataUrl } from "@/lib/pdfBranding";
import { checklistLabel, regulationRefFor, templateLabel, verifyChain, type EquipmentInspection } from "@/lib/inspections";

/**
 * Informe de inspecciones previas al uso (prueba de diligencia debida).
 * Incluye hora del servidor y del móvil, inspector, GPS, checklist, defectos, fotos, firma,
 * declaración y las huellas SHA-256 encadenadas.
 */

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const INNER_W = PAGE_W - 2 * MARGIN;
const BOTTOM = 272;

function cloudinaryThumb(url: string, w = 360): string {
  return url.includes("/upload/") ? url.replace("/upload/", `/upload/w_${w},c_limit,q_70,f_jpg/`) : url;
}

export async function generateEquipmentInspectionsPdf(params: {
  inspections: EquipmentInspection[];
  title: string;
  companyName: string;
  companyLogoUrl?: string | null;
  countryCode?: string | null;
  locale?: string | null;
  labels: Record<string, string>;
  /** Todas las inspecciones de la empresa (orden indiferente) para verificar la cadena de huellas. */
  chainSource?: EquipmentInspection[];
  fileName: string;
}): Promise<void> {
  const t = params.labels;
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(params.locale ?? undefined) : "—");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await drawPdfBrandedHeader(doc, { companyLogoUrl: params.companyLogoUrl });

  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = 16;
    }
  };
  const text = (s: string, size = 10, bold = false, color: [number, number, number] = [20, 20, 20]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(s, INNER_W) as string[];
    ensure(lines.length * (size * 0.45) + 1);
    doc.text(lines, MARGIN, y);
    y += lines.length * (size * 0.45) + 1.5;
  };

  text(params.companyName, 14, true);
  text(params.title, 12, true, [194, 65, 12]);
  text(`${t.inspectionReportGenerated ?? "Generado"}: ${fmt(new Date().toISOString())}`, 9, false, [100, 100, 100]);

  if (params.chainSource && params.chainSource.length > 1) {
    const sorted = [...params.chainSource].sort((a, b) => a.serverRecordedAt.localeCompare(b.serverRecordedAt));
    const chain = verifyChain(sorted);
    text(
      chain.ok
        ? t.inspectionChainVerified ?? "Cadena de huellas verificada: ningún registro ha sido alterado."
        : t.inspectionChainBroken ?? "Atención: la cadena de huellas presenta discrepancias.",
      9,
      true,
      chain.ok ? [4, 120, 87] : [185, 28, 28]
    );
  }
  y += 2;

  const resultLabel = (r: string) =>
    r === "fail"
      ? t.inspectionResultFail ?? "NO APTO"
      : r === "pass_with_notes"
        ? t.inspectionResultPassWithNotes ?? "Apto con observaciones"
        : t.inspectionResultPass ?? "Apto";
  const statusLabel = (s: string) =>
    s === "defect" ? t.inspectionStatusDefect ?? "Defecto" : s === "na" ? t.inspectionStatusNa ?? "No aplica" : t.inspectionStatusOk ?? "Correcto";

  for (const insp of params.inspections) {
    ensure(40);
    doc.setDrawColor(230, 230, 230);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
    text(`${insp.itemLabel ?? "—"}${insp.itemSerial ? ` · ${t.serialNumber ?? "N.º de serie"}: ${insp.itemSerial}` : ""}`, 11, true);
    text(
      `${t.inspectionResult ?? "Resultado"}: ${resultLabel(insp.result)}`,
      10,
      true,
      insp.result === "fail" ? [185, 28, 28] : insp.result === "pass_with_notes" ? [180, 83, 9] : [4, 120, 87]
    );
    text(`${t.inspectionInspector ?? "Inspector"}: ${insp.inspectorName ?? "—"}`, 9);
    text(`${t.inspectionServerTime ?? "Hora del servidor"}: ${fmt(insp.serverRecordedAt)}   ·   ${t.inspectionDeviceTime ?? "Hora del móvil"}: ${fmt(insp.clientRecordedAt)}`, 9);
    if (insp.gpsLat != null && insp.gpsLng != null) {
      text(`GPS: ${insp.gpsLat.toFixed(6)}, ${insp.gpsLng.toFixed(6)}${insp.gpsAccuracy != null ? ` (±${Math.round(insp.gpsAccuracy)} m)` : ""}`, 9);
    }
    if (insp.templateSnapshot) {
      const ref = regulationRefFor(insp.templateSnapshot.regulation_refs, params.countryCode);
      text(`${t.inspectionTemplate ?? "Plantilla"}: ${templateLabel(insp.templateSnapshot, t)}${ref ? ` · ${ref}` : ""}`, 9);
      for (const c of insp.templateSnapshot.checklist ?? []) {
        const a = insp.answers[c.id];
        if (!a) continue;
        text(`  • ${checklistLabel(c, t)} — ${statusLabel(a.status)}${a.note ? `: ${a.note}` : ""}`, 8.5, a.status === "defect", a.status === "defect" ? [185, 28, 28] : [40, 40, 40]);
      }
    }
    if (insp.defects) text(`${t.inspectionDefects ?? "Defectos"}: ${insp.defects}`, 9, true, [185, 28, 28]);
    if (insp.notes) text(`${t.inspectionNotes ?? "Observaciones"}: ${insp.notes}`, 9);
    if (insp.supersedesId) text(`${t.inspectionCorrectionOf ?? "Corrección de la inspección"} ${insp.supersedesId}`, 8.5, false, [100, 100, 100]);

    // Fotos (miniaturas)
    const thumbs = insp.photoUrls.slice(0, 4);
    if (thumbs.length) {
      ensure(42);
      let x = MARGIN;
      for (const url of thumbs) {
        const data = await fetchImageDataUrl(cloudinaryThumb(url));
        if (data) {
          try {
            doc.addImage(data, imageFormatFromDataUrl(data), x, y, 40, 30);
          } catch {
            /* imagen no válida */
          }
        }
        x += 44;
      }
      y += 34;
      if (insp.photoUrls.length > thumbs.length) text(`+${insp.photoUrls.length - thumbs.length}`, 8);
    }
    if (insp.signatureUrl) {
      const sig = await fetchImageDataUrl(insp.signatureUrl);
      if (sig) {
        ensure(22);
        try {
          doc.addImage(sig, imageFormatFromDataUrl(sig), MARGIN, y, 50, 15);
        } catch {
          /* ignore */
        }
        y += 18;
      }
    }
    if (insp.declarationText) text(`[x] ${insp.declarationText}`, 8, false, [70, 70, 70]);
    text(`${t.inspectionVerificationCode ?? "Código de verificación"} (SHA-256): ${insp.contentHash}`, 7, false, [110, 110, 110]);
    text(`${t.inspectionPrevHash ?? "Huella anterior"}: ${insp.prevHash ?? "—"}`, 7, false, [110, 110, 110]);
    if (insp.photoHashes?.length) text(`${t.inspectionPhotoHashes ?? "Huellas de las fotos"}: ${insp.photoHashes.join(", ")}`, 6.5, false, [130, 130, 130]);
    y += 3;
  }

  drawMachinProPdfFooter(
    doc,
    `${params.companyName} · ${t.inspectionReportFooter ?? "Generado con MachinPro"}`,
    PAGE_W,
    t.inspectionImmutablePdf ?? "Registro inalterable. Cada inspección está encadenada con la anterior mediante huella SHA-256."
  );
  void PAGE_H;
  doc.save(params.fileName);
}
