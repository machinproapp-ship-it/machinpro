"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { FolderOpen, X } from "lucide-react";

const CONTAINER_ID = "qr-scanner-container";

const CAMERA_CONSTRAINTS: MediaTrackConstraints[] = [
  { facingMode: "environment" },
  { facingMode: "user" },
  {},
];

type ScannerError = "permission_denied" | "no_camera" | "unknown" | "container_missing" | null;

function stopMediaTracksInContainer() {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;
  container.querySelectorAll("video").forEach((video) => {
    const stream = video.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    video.srcObject = null;
  });
}

async function releaseScanner(scanner: Html5Qrcode | null) {
  stopMediaTracksInContainer();
  if (!scanner) return;
  try {
    await scanner.stop();
  } catch {
    /* ignore */
  }
  try {
    scanner.clear();
  } catch {
    /* ignore */
  }
}

function classifyScannerError(err: unknown): ScannerError {
  const e = err as { name?: string; message?: string };
  const name = String(e?.name ?? "");
  const msg = String(e?.message ?? err ?? "").toLowerCase();
  if (name === "NotAllowedError" || msg.includes("permission") || msg.includes("notallowed")) {
    return "permission_denied";
  }
  if (name === "NotFoundError" || msg.includes("notfound") || msg.includes("no camera")) {
    return "no_camera";
  }
  return "unknown";
}

function ErrorBlock({
  title,
  help,
}: {
  title: string;
  help: string;
}) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-center">
      <p className="text-sm font-medium text-red-100">{title}</p>
      <p className="mt-1 text-xs text-red-200/90">{help}</p>
    </div>
  );
}

export function InventoryQrScannerModal({
  open,
  labels,
  onClose,
  onDecoded,
}: {
  open: boolean;
  labels: Record<string, string>;
  onClose: () => void;
  onDecoded: (text: string) => void;
}) {
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const L = (k: string, fb: string) => labelsRef.current[k] ?? fb;

  const onDecodedRef = useRef(onDecoded);
  const onCloseRef = useRef(onClose);
  onDecodedRef.current = onDecoded;
  onCloseRef.current = onClose;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const decodedOnceRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<ScannerError>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!open) {
      void releaseScanner(scannerRef.current);
      scannerRef.current = null;
      setStarting(true);
      setError(null);
      decodedOnceRef.current = false;
      return;
    }

    let cancelled = false;

    const start = async () => {
      setStarting(true);
      setError(null);
      decodedOnceRef.current = false;

      try {
        const container = document.getElementById(CONTAINER_ID);
        if (!container) {
          if (!cancelled) {
            setError("container_missing");
            setStarting(false);
          }
          return;
        }

        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        await new Promise<void>((r) => requestAnimationFrame(() => r()));

        if (cancelled) return;

        const scanConfig = {
          fps: 10,
          qrbox: (vw: number, vh: number) => {
            const size = Math.floor(Math.min(vw, vh) * 0.75);
            return { width: size, height: size };
          },
        };

        let lastErr: unknown;
        for (const constraint of CAMERA_CONSTRAINTS) {
          if (cancelled) return;

          const scanner = new Html5Qrcode(CONTAINER_ID, { verbose: false });
          try {
            await scanner.start(
              constraint,
              scanConfig,
              (decodedText) => {
                if (decodedOnceRef.current) return;
                decodedOnceRef.current = true;
                const s = scannerRef.current;
                scannerRef.current = null;
                void releaseScanner(s);
                onDecodedRef.current(decodedText);
                onCloseRef.current();
              },
              () => {
                /* ignore per-frame decode misses */
              }
            );

            if (cancelled) {
              await releaseScanner(scanner);
              return;
            }

            scannerRef.current = scanner;
            setStarting(false);
            return;
          } catch (err: unknown) {
            lastErr = err;
            await releaseScanner(scanner);

            const kind = classifyScannerError(err);
            if (kind === "permission_denied") {
              throw err;
            }
          }
        }

        throw lastErr ?? new Error("Camera could not start");
      } catch (err: unknown) {
        console.error("QR scanner error:", err);
        if (!cancelled) {
          setError(classifyScannerError(err));
          setStarting(false);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      void releaseScanner(scannerRef.current);
      scannerRef.current = null;
    };
  }, [open, retryNonce]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleRetry = () => {
    void releaseScanner(scannerRef.current);
    scannerRef.current = null;
    setError(null);
    setStarting(true);
    setRetryNonce((n) => n + 1);
  };

  const handleUploadQrImage = async (file: File | undefined) => {
    if (!file) return;
    const scanner = new Html5Qrcode(CONTAINER_ID, { verbose: false });
    try {
      const text = await scanner.scanFile(file, false);
      await scanner.clear();
      if (text) {
        onDecodedRef.current(text);
        onCloseRef.current();
      }
    } catch {
      await scanner.clear();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10070] flex flex-col bg-black">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void handleUploadQrImage(f);
        }}
      />

      <div className="relative flex shrink-0 items-center justify-end px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          onClick={() => onClose()}
          aria-label={L("common_close", "Close")}
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          id={CONTAINER_ID}
          className="relative w-full overflow-hidden rounded-lg bg-black"
          style={{ minHeight: "320px", aspectRatio: "1 / 1" }}
        />

        {starting && !error ? (
          <p className="text-center text-sm py-2 text-slate-300">
            {L("inventory_qrScannerStarting", "Starting camera...")}
          </p>
        ) : null}

        {error === "permission_denied" ? (
          <ErrorBlock
            title={L("inventory_qrScannerPermissionDeniedTitle", "Camera permission denied")}
            help={L(
              "inventory_qrScannerPermissionDeniedHelp",
              "Permite el acceso a la cámara en tu navegador"
            )}
          />
        ) : null}

        {error === "no_camera" ? (
          <ErrorBlock
            title={L("inventory_qrScannerNoCameraTitle", "No camera detected")}
            help={L(
              "inventory_qrScannerNoCameraHelp",
              "No se encontró cámara en este dispositivo"
            )}
          />
        ) : null}

        {(error === "unknown" || error === "container_missing") && (
          <ErrorBlock
            title={L("inventory_qrScannerUnknownErrorTitle", "Camera could not start")}
            help={L(
              "inventory_qrScannerUnknownErrorHelp",
              "No se pudo iniciar la cámara. Intenta de nuevo"
            )}
          />
        )}

        {error ? (
          <button
            type="button"
            onClick={handleRetry}
            className="mx-auto inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/25"
          >
            {L("inventory_qrScannerRetry", "Reintentar")}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mx-auto inline-flex min-h-[44px] max-w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 hover:bg-white/10"
        >
          <FolderOpen className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <span className="truncate">{L("inventory_scanUploadFallback", "Upload QR image")}</span>
        </button>
      </div>
    </div>
  );
}
