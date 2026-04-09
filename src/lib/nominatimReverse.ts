const cache = new Map<string, string>();

/**
 * Best-effort reverse geocode (Nominatim). Respects 1 req/s; caller should throttle batches.
 */
export async function nominatimReverseLabel(
  lat: number,
  lng: number,
  acceptLanguage: string
): Promise<string> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": acceptLanguage || "en",
    },
  });
  if (!res.ok) return "";
  const j = (await res.json()) as { display_name?: string };
  const label = typeof j.display_name === "string" ? j.display_name.trim() : "";
  if (label) cache.set(key, label);
  return label;
}
