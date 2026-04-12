"use client";

import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X } from "lucide-react";

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
  const L = (k: string, fb: string) => labels[k] ?? fb;
  const startedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    const rid = "machinpro-inventory-qr-reader";
    const scanner = new Html5QrcodeScanner(
      rid,
      { fps: 8, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
      false
    );
    scanner.render(
      (decoded) => {
        onDecoded(decoded);
        void scanner.clear().catch(() => {});
        startedRef.current = false;
        onClose();
      },
      () => {}
    );
    return () => {
      void scanner.clear().catch(() => {});
      startedRef.current = false;
    };
  }, [open, onDecoded, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10070] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {L("inventory_qr_scan", "Scan QR")}
          </h3>
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
            onClick={onClose}
            aria-label={L("common_close", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div id="machinpro-inventory-qr-reader" className="min-h-[280px] w-full overflow-hidden rounded-xl bg-black/5 dark:bg-black/20" />
      </div>
    </div>
  );
}
