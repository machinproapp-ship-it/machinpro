/** Force browser download of a remote image (e.g. Cloudinary) via fetch + blob. */

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

export async function downloadImageUrlAsFile(imageUrl: string, filename: string): Promise<void> {
  const res = await fetch(imageUrl, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
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

export function formatGalleryDownloadProgress(
  template: string,
  current: number,
  total: number
): string {
  return template.replace(/\{current\}/g, String(current)).replace(/\{total\}/g, String(total));
}
