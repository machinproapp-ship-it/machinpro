"use client";

import type { ComponentProps } from "react";
import Image from "next/image";
import { cloudinaryAvatar } from "@/lib/cloudinaryUrl";

export type BrandLogoImageProps = {
  src: string;
  alt?: string;
  /** Fixed outer box (Tailwind), e.g. `h-10 w-10`. Must set explicit height & width. */
  boxClassName: string;
  /** Zoom inside the clip rect; default `1` (no zoom). */
  scale?: number;
  priority?: boolean;
  sizes?: string;
  /** Applied to the inner `Image` (e.g. drop-shadow). */
  imageClassName?: string;
  onError?: ComponentProps<typeof Image>["onError"];
};

/**
 * Logo display: `object-contain` inside a clipped, rounded box (no border/ring).
 * Remote URLs use `unoptimized` so `next.config` remotePatterns are not required.
 */
export function BrandLogoImage({
  src,
  alt = "",
  boxClassName,
  scale = 1.0,
  priority,
  sizes = "96px",
  imageClassName,
  onError,
}: BrandLogoImageProps) {
  const displaySrc = cloudinaryAvatar(src);
  const unoptimized =
    displaySrc.startsWith("http://") ||
    displaySrc.startsWith("https://") ||
    displaySrc.startsWith("//");

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl ${boxClassName}`}
      style={{ padding: 0 }}
    >
      <Image
        src={displaySrc}
        alt={alt}
        fill
        sizes={sizes}
        className={`object-contain object-center ${imageClassName ?? ""}`.trim()}
        style={{ padding: 0, transform: `scale(${scale})` }}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        unoptimized={unoptimized}
        onError={onError}
      />
    </div>
  );
}
