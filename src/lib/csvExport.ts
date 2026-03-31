/** CSV helpers for client-side exports (UTF-8 BOM for Excel). */

export function csvCell(s: string | null | undefined): string {
  const v = String(s ?? "").replace(/"/g, '""');
  return `"${v}"`;
}

export function downloadCsvUtf8(filename: string, lines: string[]): void {
  const blob = new Blob(["\ufeff", lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Safe ASCII-ish slug for filenames. */
export function fileSlugCompany(name: string, fallback: string): string {
  const base = (name || fallback).trim() || "company";
  return (
    base
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "company"
  );
}

export function filenameDateYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
