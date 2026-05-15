"use client";

import { useCallback, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Camera, Loader2, X } from "lucide-react";
import { cloudinaryThumb } from "@/lib/cloudinaryUrl";

const CLOUD_NAME = "dwdlmxmkt";
const UPLOAD_PRESET = "i5dmd07o";

function L(labels: Record<string, string>, key: string, fb: string) {
  return labels[key] ?? fb;
}

export function InventoryItemPhotoPicker({
  labels,
  imageUrl,
  onChange,
  onUploadFailed,
}: {
  labels: Record<string, string>;
  /** Stored photo URL (`photo_url` / `imageUrl`). */
  imageUrl?: string;
  onChange: (nextUrl: string | undefined) => void;
  onUploadFailed?: () => void;
}) {
  const tx = labels;
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickFiles = () => inputRef.current?.click();

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;

      let toUpload = file;
      const maxBytes = 500 * 1024;
      if (file.size >= maxBytes) {
        setCompressing(true);
        try {
          toUpload = await imageCompression(file, {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
          });
        } catch {
          setCompressing(false);
          return;
        } finally {
          setCompressing(false);
        }
      }

      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", toUpload);
        fd.append("upload_preset", UPLOAD_PRESET);
        fd.append("folder", "machinpro/inventory");
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
          method: "POST",
          body: fd,
        });
        const data = (await res.json()) as { secure_url?: string };
        if (data.secure_url) onChange(data.secure_url);
        else onUploadFailed?.();
      } catch {
        onUploadFailed?.();
      } finally {
        setUploading(false);
      }
    },
    [onChange, onUploadFailed]
  );

  const busy = compressing || uploading;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void handleFile(f);
        }}
      />

      <div className="flex flex-wrap items-start gap-3">
        <div className="relative h-[200px] w-[200px] shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-slate-600 dark:bg-slate-800">
          {imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cloudinaryThumb(imageUrl)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => onChange(undefined)}
                className="absolute right-1.5 top-1.5 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg bg-black/55 text-xs text-white hover:bg-black/70"
                aria-label={L(tx, "inventory_photoRemove", "Remove photo")}
              >
                <span className="sr-only">{L(tx, "inventory_photoRemove", "Remove photo")}</span>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={pickFiles}
              disabled={busy}
              className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-sm text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-slate-700/80"
            >
              <Camera className="h-10 w-10 text-zinc-400 dark:text-zinc-500" aria-hidden />
              <span>{L(tx, "inventory_photoEmpty", "No photo")}</span>
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={pickFiles}
            className="inline-flex min-h-[44px] w-full max-w-xs items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-100 dark:hover:bg-slate-700"
          >
            {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
            {compressing
              ? L(tx, "inventory_photoCompressing", "Compressing...")
              : uploading
                ? L(tx, "inventory_photoUploading", "Uploading...")
                : L(tx, "inventory_photoTakeOrUpload", "Take or upload photo")}
          </button>
        </div>
      </div>
    </div>
  );
}
