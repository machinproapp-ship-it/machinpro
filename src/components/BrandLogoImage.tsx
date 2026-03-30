"use client";

import type { ComponentProps } from "react";
import Image from "next/image";

export type BrandLogoImageProps = {
  src: string;
  alt?: string;
  /** Fixed outer box (Tailwind), e.g. `h-10 w-10`. Must set explicit height & width. */
  boxClassName: string;
  /** Zoom inside the clip rect to hide typical transparent padding in PNG logos. */
  scale?: number;
  priority?: boolean;
  sizes?: string;
  /** Applied to the inner `Image` (e.g. drop-shadow). */
  imageClassName?: string;
  onError?: ComponentProps<typeof Image>["onError"];
};

/**
 * Logo display: clips transparent margins via overflow + slight scale, `object-contain` inside.
 * Remote URLs use `unoptimized` so `next.config` remotePatterns are not required.
 */
export function BrandLogoImage({
  src,
  alt = "",
  boxClassName,
  scale = 1.22,
  priority,
  sizes = "96px",
  imageClassName,
  onError,
}: BrandLogoImageProps) {
  const unoptimized =
    src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//");

  return (
    <div className={`relative shrink-0 overflow-hidden ${boxClassName}`} style={{ padding: 0 }}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={`object-contain object-center ${imageClassName ?? ""}`.trim()}
        style={{ padding: 0, transform: `scale(${scale})` }}
        priority={priority}
        unoptimized={unoptimized}
        onError={onError}
      />
    </div>
  );
}
