"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  preventDefault: () => void;
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "machinpro_pwa_dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isLikelyIosSafari(): boolean {
  if (!isIosDevice()) return false;
  const ua = navigator.userAgent;
  if (ua.includes("CriOS") || ua.includes("FxiOS")) return false;
  return true;
}

type Props = {
  labels: Record<string, string>;
  isDark: boolean;
};

export function InstallPWABanner({ labels, isDark }: Props) {
  const t = useCallback((key: string, fallback: string) => labels[key] ?? fallback, [labels]);

  const [dismissed, setDismissed] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosSafari, setIosSafari] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setInstalled(isStandalone());
    setIosSafari(isLikelyIosSafari());
  }, []);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
  }, [deferred]);

  const showChromium = !installed && !dismissed && deferred !== null;
  const showIos = !installed && !dismissed && iosSafari && deferred === null;
  const visible = showChromium || showIos;

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-[100] border-t px-3 py-3 shadow-lg sm:px-4 ${
        isDark
          ? "border-zinc-700 bg-zinc-900/95 text-zinc-100 backdrop-blur-sm"
          : "border-zinc-200 bg-white/95 text-zinc-900 backdrop-blur-sm"
      }`}
      role="region"
      aria-label={t("pwa_install_title", "MachinPro")}
    >
      <div className="mx-auto flex max-w-4xl items-start gap-3">
        <img
          src="/icons/icon-192x192.png"
          alt=""
          width={40}
          height={40}
          className="mt-0.5 h-10 w-10 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{t("pwa_install_title", "MachinPro")}</p>
          <p className={`mt-0.5 text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            {t("pwa_install_desc", "Instala MachinPro en tu dispositivo")}
          </p>
          {showIos && (
            <div className={`mt-2 space-y-1 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              <p className="font-medium text-inherit">{t("pwa_install_ios_title", "Añadir a la pantalla de inicio")}</p>
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>{t("pwa_install_ios_step1", "Pulsa Compartir en Safari.")}</li>
                <li>{t("pwa_install_ios_step2", "Elige «Añadir a pantalla de inicio».")}</li>
                <li>{t("pwa_install_ios_step3", "Toca «Añadir».")}</li>
              </ol>
            </div>
          )}
          {showChromium && (
            <button
              type="button"
              onClick={() => void onInstall()}
              className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
            >
              {t("pwa_install_btn", "Instalar")}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className={`shrink-0 rounded-lg p-2 text-lg leading-none min-h-[44px] min-w-[44px] flex items-center justify-center ${
            isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"
          }`}
          aria-label={t("pwa_install_close", "Cerrar")}
        >
          ×
        </button>
      </div>
    </div>
  );
}
