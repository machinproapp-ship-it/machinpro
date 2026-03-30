/** Force browser download of a remote image (e.g. Cloudinary) via fetch + blob. */

import JSZip from "jszip";

export function slugifyForFilename(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "Proyecto";
}

export function extensionFromImageUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.(jpe?g|png|gif|webp|bmp|avif)$/i);
    if (m) {
      const e = m[1]!.toLowerCase();
      return e === "jpeg" || e === "jpg" ? ".jpg" : `.${e}`;
    }
  } catch {
    /* ignore */
  }
  return ".jpg";
}

export function galleryPhotoFilename(
  projectName: string,
  createdAtIso: string,
  photoId: string,
  imageUrl: string
): string {
  const slug = slugifyForFilename(projectName);
  const ymd = createdAtIso.includes("T")
    ? createdAtIso.slice(0, 10)
    : createdAtIso.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const ext = extensionFromImageUrl(imageUrl);
  return `${slug}_${ymd}_${photoId}${ext}`;
}

/** Single ZIP for bulk gallery export: `[proyecto]_[fecha].zip`. */
export function galleryBulkZipFilename(projectName: string): string {
  const slug = slugifyForFilename(projectName);
  const ymd = new Date().toISOString().slice(0, 10);
  return `${slug}_${ymd}.zip`;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export async function downloadImageUrlAsFile(imageUrl: string, filename: string): Promise<void> {
  const res = await fetch(imageUrl, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  triggerBlobDownload(blob, filename);
}

export async function fetchImageBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

/** Pack remote images into a ZIP; reports progress after each file is fetched and added. */
export async function buildGalleryPhotosZip(
  files: { url: string; pathInZip: string }[],
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const total = files.length;
  for (let i = 0; i < total; i++) {
    const { url, pathInZip } = files[i]!;
    const blob = await fetchImageBlob(url);
    zip.file(pathInZip, blob);
    onProgress?.(i + 1, total);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function formatGalleryDownloadProgress(
  template: string,
  current: number,
  total: number
): string {
  return template.replace(/\{current\}/g, String(current)).replace(/\{total\}/g, String(total));
}
