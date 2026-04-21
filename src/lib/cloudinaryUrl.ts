/**
 * Injects Cloudinary delivery transforms for smaller payloads and faster LCP.
 * Returns the original string if not a res.cloudinary.com image URL.
 */
export function cloudinaryThumb(url: string): string {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/w_400,h_300,c_fill,f_auto,q_auto/");
}

export function cloudinaryAvatar(url: string): string {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/w_100,h_100,c_fill,f_auto,q_auto/");
}

export function cloudinaryFull(url: string): string {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/w_1200,f_auto,q_auto/");
}
