import { getAppBaseUrl } from "@/lib/app-url";

export type ParsedInventoryQrUrl =
  | { kind: "item"; itemId: string }
  | { kind: "blank"; blankId: string };

/** Public base URL for inventory QR links (env, Vercel preview, or current origin). */
export function getInventoryQrBaseUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".vercel.app")
    ) {
      return origin.replace(/\/$/, "");
    }
  }
  const base = getAppBaseUrl();
  return base.replace(/\/$/, "") || "https://machin.pro";
}

export function buildInventoryItemQrUrl(itemId: string): string {
  return `${getInventoryQrBaseUrl()}/q/i/${encodeURIComponent(itemId)}`;
}

export function buildInventoryBlankQrUrl(blankId: string): string {
  return `${getInventoryQrBaseUrl()}/q/b/${encodeURIComponent(blankId)}`;
}

/**
 * Detect MachinPro quick-scan paths `/q/i/{id}` and `/q/b/{id}` on any host
 * (machin.pro, localhost, *.vercel.app).
 */
export function parseInventoryQrUrl(scanText: string): ParsedInventoryQrUrl | null {
  const t = scanText.trim();
  if (!t) return null;

  const tryPath = (pathname: string): ParsedInventoryQrUrl | null => {
    const item = pathname.match(/\/q\/i\/([^/]+)/);
    if (item?.[1]) return { kind: "item", itemId: decodeURIComponent(item[1]) };
    const blank = pathname.match(/\/q\/b\/([^/]+)/);
    if (blank?.[1]) return { kind: "blank", blankId: decodeURIComponent(blank[1]) };
    return null;
  };

  if (t.includes("/q/i/") || t.includes("/q/b/")) {
    try {
      const url = t.includes("://") ? new URL(t) : new URL(t, "https://machin.pro");
      const fromUrl = tryPath(url.pathname);
      if (fromUrl) return fromUrl;
    } catch {
      /* fall through to path regex */
    }
    const pathOnly = t.startsWith("/") ? t : `/${t.replace(/^https?:\/\/[^/]+/, "")}`;
    return tryPath(pathOnly.split("?")[0] ?? pathOnly);
  }

  return null;
}
