/**
 * Cloudinary image URL with a single text overlay watermark (ASCII-safe).
 */

export function getWatermarkedUrl(params: {
  publicIdOrUrl: string;
  projectName: string;
  employeeName: string;
  date: string;
  category: "progress" | "incident" | "health_safety";
  location?: string;
  cloudName: string;
}): string {
  const {
    publicIdOrUrl,
    projectName,
    employeeName,
    date,
    category,
    cloudName,
  } = params;

  if (!cloudName || !publicIdOrUrl) return publicIdOrUrl;

  const getPublicId = (url: string): string => {
    try {
      const match = url.match(
        /\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/
      );
      return match ? match[1] : url;
    } catch {
      return url;
    }
  };

  const publicId = publicIdOrUrl.startsWith("http")
    ? getPublicId(publicIdOrUrl)
    : publicIdOrUrl;

  if (!publicId || publicId === publicIdOrUrl)
    return publicIdOrUrl;

  const categoryLabel =
    category === "progress"
      ? "AVANCE"
      : category === "incident"
        ? "INCIDENCIA"
        : "HS";

  const safeProject = projectName
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .substring(0, 20)
    .trim()
    .replace(/ /g, "_");

  const safeEmployee = employeeName
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .substring(0, 20)
    .trim()
    .replace(/ /g, "_");

  const safeDate = date
    .replace(/[^0-9\-\/]/g, "")
    .substring(0, 10);

  const overlayText =
    `${safeProject}__${categoryLabel}__${safeEmployee}__${safeDate}`;

  const overlay = [
    `l_text:Arial_16_bold:${overlayText}`,
    `co_white`,
    `g_south_west`,
    `x_10`,
    `y_10`,
    `b_rgb:00000080`,
    `fl_layer_apply`,
  ].join(",");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${overlay}/${publicId}`;
}
