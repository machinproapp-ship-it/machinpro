"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

type Props = {
  labels: Record<string, string>;
  onOnlineChange?: (online: boolean) => void;
};

export function OfflineIndicator({ labels, onOnlineChange }: Props) {
  const L = (k: string, fb: string) => labels[k] ?? fb;
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const sync = () => {
      const o = navigator.onLine;
      setOnline(o);
      onOnlineChange?.(o);
    };
    sync();
    const onO = () => {
      setOnline(true);
      onOnlineChange?.(true);
      setShowRestored(true);
    };
    const off = () => {
      setOnline(false);
      onOnlineChange?.(false);
    };
    window.addEventListener("online", onO);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", onO);
      window.removeEventListener("offline", off);
    };
  }, [onOnlineChange]);

  useEffect(() => {
    if (!showRestored) return;
    const t = window.setTimeout(() => setShowRestored(false), 3000);
    return () => window.clearTimeout(t);
  }, [showRestored]);

  if (showRestored && online) {
    return (
      <div
        role="status"
        className="sticky top-0 z-[200] flex items-center justify-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-100"
      >
        {L("online_message", "Conexión restaurada")}
      </div>
    );
  }

  if (online) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-[200] flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-100"
    >
      <WifiOff className="h-5 w-5 shrink-0" aria-hidden />
      <span>
        {L("offline_message", "Sin conexión — los cambios se sincronizarán al volver")}
      </span>
    </div>
  );
}
