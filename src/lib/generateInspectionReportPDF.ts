import jsPDF from "jspdf";
import type { ProjectPhoto } from "@/lib/useProjectPhotos";

const MM = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const INNER_W = PAGE_W - 2 * MM;

function localeForLanguage(lang?: string): string {
  const m: Record<string, string> = {
    es: "es-ES",
    en: "en-GB",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-PT",
    nl: "nl-NL",
    pl: "pl-PL",
    sv: "sv-SE",
    no: "nb-NO",
    da: "da-DK",
    fi: "fi-FI",
    cs: "cs-CZ",
    ro: "ro-RO",
    hu: "hu-HU",
    el: "el-GR",
    tr: "tr-TR",
    uk: "uk-UA",
    hr: "hr-HR",
    sk: "sk-SK",
    bg: "bg-BG",
  };
  return m[lang ?? "es"] ?? "en-GB";
}

function imageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" {
  if (dataUrl.includes("image/png")) return "PNG";
  return "JPEG";
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read fail"));
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInspectionReportPDF(params: {
  photos: ProjectPhoto[];
  projectName: string;
  companyName: string;
  companyLogoUrl?: string;
  inspectorName: string;
  reportTitle: string;
  labels: Record<string, string>;
  language?: string;
}): Promise<Blob> {
  const { photos, projectName, companyName, companyLogoUrl, inspectorName, reportTitle, labels: t, language } =
    params;
  const locale = localeForLanguage(language);
  const reportDate = new Date();
  const reportDateLong = reportDate.toLocaleDateString(locale, { dateStyle: "long" });
  const footerStamp = reportDate.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });

  const totalPages = 1 + photos.length;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const drawFooter = (pageIndex: number) => {
    const p = pageIndex + 1;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);
    const left = `MachinPro · ${companyName} · ${t.inspection_report_page ?? "Page"} ${p} ${t.inspection_report_of ?? "of"} ${totalPages}`;
    doc.text(left, MM, PAGE_H - MM);
    doc.text(footerStamp, PAGE_W - MM, PAGE_H - MM, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };

  // ─── Cover ───
  let y = MM;
  if (companyLogoUrl) {
    const logoData = await fetchImageDataUrl(companyLogoUrl);
    if (logoData) {
      try {
        const fmt = imageFormatFromDataUrl(logoData);
        const prop = doc.getImageProperties(logoData);
        const lw = 45;
        const lh = Math.min(20, (prop.height / prop.width) * lw);
        doc.addImage(logoData, fmt, MM, y, lw, lh);
        y = y + lh + 6;
      } catch {
        y = MM + 4;
      }
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("MachinPro", MM, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(companyName, MM, y + 5);

  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(t.inspection_report_cover ?? "Inspection Report", PAGE_W / 2, y, { align: "center" });
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const coverTitleLines = doc.splitTextToSize(reportTitle, INNER_W);
  doc.text(coverTitleLines, MM, y);
  y += coverTitleLines.length * 5.5 + 4;

  doc.text(`${t.inspection_report_project ?? "Project"}: ${projectName}`, MM, y);
  y += 7;
  doc.text(`${t.inspection_report_inspector ?? "Inspector"}: ${inspectorName}`, MM, y);
  y += 7;
  doc.text(`${t.inspection_report_date ?? "Inspection date"}: ${reportDateLong}`, MM, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text(`${t.inspection_report_total ?? "Total deficiencies"}: ${photos.length}`, MM, y);

  drawFooter(0);

  const maxImgH = 100;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]!;
    doc.addPage();
    const pageIdx = i + 1;

    y = MM;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`#${i + 1} · ${t.inspection_report_deficiency ?? "Deficiency"}`, MM, y);
    y += 9;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const imgData = await fetchImageDataUrl(photo.photo_url);
    if (imgData) {
      try {
        const fmt = imageFormatFromDataUrl(imgData);
        const prop = doc.getImageProperties(imgData);
        let dw = INNER_W;
        let dh = (prop.height / prop.width) * dw;
        if (dh > maxImgH) {
          dh = maxImgH;
          dw = (prop.width / prop.height) * dh;
        }
        doc.addImage(imgData, fmt, MM, y, dw, dh);
        y += dh + 6;
      } catch {
        const miss = doc.splitTextToSize(`(${t.inspection_report ?? "Report"} — image)`, INNER_W);
        doc.text(miss, MM, y);
        y += miss.length * 5 + 4;
      }
    } else {
      const miss = doc.splitTextToSize(`(${t.inspection_report ?? "Report"} — image unavailable)`, INNER_W);
      doc.text(miss, MM, y);
      y += miss.length * 5 + 4;
    }

    if (photo.notes?.trim()) {
      const noteLines = doc.splitTextToSize(photo.notes.trim(), INNER_W);
      doc.setFontSize(10);
      doc.text(noteLines, MM, y);
      y += noteLines.length * 5 + 4;
    }

    const captured = new Date(photo.created_at);
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(captured.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }), MM, y);
    y += 6;

    if (photo.gps_lat != null && photo.gps_lng != null) {
      const g = `${photo.gps_lat.toFixed(6)}, ${photo.gps_lng.toFixed(6)}${
        photo.gps_accuracy != null ? ` (±${Math.round(photo.gps_accuracy)}m)` : ""
      }`;
      doc.text(`GPS: ${g}`, MM, y);
      y += 5;
    }

    if (photo.location?.trim()) {
      const locLines = doc.splitTextToSize(photo.location.trim(), INNER_W);
      doc.text(locLines, MM, y);
      y += locLines.length * 4.5;
    }

    doc.setTextColor(0, 0, 0);
    drawFooter(pageIdx);
  }

  return doc.output("blob");
}
