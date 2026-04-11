import { jsPDF } from "jspdf";

export function imageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" {
  if (dataUrl.includes("image/png")) return "PNG";
  return "JPEG";
}

export async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read"));
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Returns Y (mm) below header row. */
export async function drawPdfBrandedHeader(doc: jsPDF, opts: { companyLogoUrl?: string | null }): Promise<number> {
  const top = 10;
  if (opts.companyLogoUrl?.trim()) {
    const data = await fetchImageDataUrl(opts.companyLogoUrl.trim());
    if (data) {
      try {
        doc.addImage(data, imageFormatFromDataUrl(data), 14, top, 36, 16);
      } catch {
        /* invalid image */
      }
    }
  }
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  if (origin) {
    const mp = await fetchImageDataUrl(`${origin}/icons/icon-192x192.png`);
    if (mp) {
      try {
        doc.addImage(mp, imageFormatFromDataUrl(mp), 166, top, 16, 16);
      } catch {
        /* ignore */
      }
    }
  }
  return top + 22;
}

export function drawMachinProPdfFooter(doc: jsPDF, footerText: string, pageW = 210): void {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setFont("helvetica", "normal");
    doc.text(footerText, pageW / 2, 287, { align: "center" });
    doc.setTextColor(0);
  }
}
