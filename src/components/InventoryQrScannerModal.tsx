"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { FolderOpen, Loader2, X } from "lucide-react";

const VIEWPORT_ID = "machinpro-inventory-qr-viewport";

type Phase =
  | "checking"
  | "need_permission"
  | "denied"
  | "starting"
  | "scanning"
  | "camera_fail";

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
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("checking");
  const [showCameraFallback, setShowCameraFallback] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<{ id: string; label: string }[]>([]);

  const cleanupScanner = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
    } catch {
      /* ignore */
    }
    try {
      s.clear();
    } catch {
      /* ignore */
    }
  };

  const isNotReadableError = (e: unknown) => {
    const err = e as { name?: string; message?: string };
    const msg = String(err?.message ?? e ?? "");
    return err?.name === "NotReadableError" || msg.includes("Could not start video source");
  };

  const startScannerWithCamera = async (cameraIdOrConstraints: string | MediaTrackConstraints) => {
    await cleanupScanner();
    setPhase("starting");
    decodedOnceRef.current = false;

    const scanner = new Html5Qrcode(VIEWPORT_ID, { verbose: false });
    scannerRef.current = scanner;

    await scanner.start(
      cameraIdOrConstraints,
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1,
      },
      (decodedText) => {
        if (decodedOnceRef.current) return;
        decodedOnceRef.current = true;
        void cleanupScanner().then(() => {
          onDecodedRef.current(decodedText);
          onCloseRef.current();
        });
      },
      () => {}
    );

    setPhase("scanning");
  };

  const attemptCameraSequence = async () => {
    try {
      await startScannerWithCamera({ facingMode: { ideal: "environment" } });
      return;
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name === "NotAllowedError") {
        setPhase("denied");
        return;
      }
      if (!isNotReadableError(e)) {
        /* fall through to fallback cameras */
      }
    }

    try {
      const list = await Html5Qrcode.getCameras();
      const preferBack = list.find((c) => /back|rear|environment|trasera|wide/i.test(c.label));
      const id = preferBack?.id ?? list[0]?.id;
      if (id) {
        await startScannerWithCamera(id);
        return;
      }
      await startScannerWithCamera({});
    } catch {
      setPhase("camera_fail");
    }
  };

  const primeCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        /* scanner attempt may still prompt */
      }
    }
  };

  useEffect(() => {
    if (!open) {
      void cleanupScanner();
      setPhase("checking");
      setShowCameraFallback(false);
      setCameraDevices([]);
      decodedOnceRef.current = false;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setPhase("checking");
      try {
        const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (cancelled) return;
        if (perm.state === "granted") {
          await attemptCameraSequence();
          return;
        }
        if (perm.state === "denied") {
          setPhase("denied");
          return;
        }
        setPhase("need_permission");

        perm.onchange = async () => {
          if (cancelled) return;
          if (perm.state === "granted") {
            await attemptCameraSequence();
          } else if (perm.state === "denied") {
            await cleanupScanner();
            setPhase("denied");
          }
        };
      } catch {
        if (!cancelled) setPhase("need_permission");
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      void cleanupScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !showCameraFallback) return;
    let cancelled = false;
    Html5Qrcode.getCameras()
      .then((list) => {
        if (!cancelled)
          setCameraDevices(list.map((c) => ({ id: c.id, label: c.label || c.id })));
      })
      .catch(() => {
        if (!cancelled) setCameraDevices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, showCameraFallback]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleAllowCamera = async () => {
    await primeCameraPermission();
    await attemptCameraSequence().catch(() => setPhase("camera_fail"));
  };

  const handlePickCameraFromList = async (deviceId: string) => {
    try {
      await startScannerWithCamera(deviceId);
    } catch {
      setPhase("camera_fail");
    }
  };

  const handleUploadQrImage = async (file: File | undefined) => {
    if (!file) return;
    const scanner = new Html5Qrcode(VIEWPORT_ID, { verbose: false });
    try {
      const text = await scanner.scanFile(file, false);
      scanner.clear();
      if (text) {
        onDecodedRef.current(text);
        onCloseRef.current();
      }
    } catch {
      scanner.clear();
    }
  };

  const beginLongPress = () => {
    if (phase !== "scanning") return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      setShowCameraFallback(true);
      void Html5Qrcode.getCameras().then((list) =>
        setCameraDevices(list.map((c) => ({ id: c.id, label: c.label || c.id })))
      );
    }, 2000);
  };

  const endLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  if (!open) return null;

  const overlayBlocking = phase === "checking" || phase === "need_permission" || phase === "denied" || phase === "camera_fail";

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

      <div className="relative mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          className="relative flex min-h-[min(60vh,420px)] flex-1 overflow-hidden rounded-xl bg-zinc-900 touch-none"
          onTouchStart={beginLongPress}
          onTouchEnd={endLongPress}
          onTouchCancel={endLongPress}
          onMouseDown={beginLongPress}
          onMouseUp={endLongPress}
          onMouseLeave={endLongPress}
        >
          <div
            id={VIEWPORT_ID}
            className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
          />

          {overlayBlocking ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/85 px-4 text-center">
              {phase === "checking" ? (
                <Loader2 className="h-9 w-9 animate-spin text-amber-400" aria-hidden />
              ) : null}

              {phase === "need_permission" ? (
                <>
                  <p className="max-w-sm text-sm text-zinc-100">{L("inventory_scanQrTitle", "Scan QR code")}</p>
                  <button
                    type="button"
                    onClick={() => void handleAllowCamera()}
                    className="min-h-[48px] rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-600"
                  >
                    {L("inventory_requestCameraPermission", "Allow camera")}
                  </button>
                </>
              ) : null}

              {phase === "denied" ? (
                <p className="max-w-sm text-sm text-red-200">
                  {L("inventory_cameraPermissionDenied", "Camera permission denied.")}
                </p>
              ) : null}

              {phase === "camera_fail" ? (
                <p className="max-w-sm text-sm text-zinc-100">
                  {L(
                    "inventory_cameraNotReadable",
                    "Could not open camera. Make sure no other app is using it."
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          {phase === "starting" ? (
            <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/50">
              <Loader2 className="h-10 w-10 animate-spin text-amber-400" aria-hidden />
            </div>
          ) : null}
        </div>

        {phase !== "checking" ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mx-auto mt-3 inline-flex min-h-[44px] max-w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 hover:bg-white/10"
          >
            <FolderOpen className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{L("inventory_scanUploadFallback", "Upload QR image")}</span>
          </button>
        ) : null}

        {showCameraFallback && cameraDevices.length > 0 ? (
          <div className="mt-4 rounded-xl border border-white/15 bg-zinc-900/90 p-3">
            <p className="mb-2 text-center text-xs text-zinc-400">Camera</p>
            <select
              defaultValue={cameraDevices[0]?.id ?? ""}
              onChange={(e) => void handlePickCameraFromList(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-2 text-sm text-white"
            >
              {cameraDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </div>
  );
}
