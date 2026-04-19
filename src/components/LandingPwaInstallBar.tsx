"use client";

import { useCallback, useEffect, useState } from "react";
import { TextWithBrandMarks } from "@/components/BrandWordmark";

type BeforeInstallPromptEvent = Event & {
  preventDefault: () => void;
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "machinpro_landing_pwa_install_v1";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isMobileOs(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isLikelyIosSafari(): boolean {
  if (!isMobileOs()) return false;
  const ua = navigator.userAgent;
  if (!/iPad|iPhone|iPod/.test(ua)) return false;
  if (ua.includes("CriOS") || ua.includes("FxiOS")) return false;
  return true;
}

type TxFn = (key: string, fallback: string) => string;

export function LandingPwaInstallBar({ tx, dark }: { tx: TxFn; dark: boolean }) {
  const [dismissed, setDismissed] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosSafari, setIosSafari] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setInstalled(isStandalone());
    setIosSafari(isLikelyIosSafari());
    const mq = window.matchMedia("(max-width: 767px)");
    const upd = () => setNarrow(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
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
    } catch {
      /* ignore */
    }
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

  const mobileOs = isMobileOs();
  const showChromium = narrow && mobileOs && !installed && !dismissed && deferred !== null;
  const showIos = narrow && mobileOs && !installed && !dismissed && iosSafari && deferred === null;

  if (!showChromium && !showIos) return null;

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-[95] border-t px-3 py-3 shadow-lg sm:px-4 ${
        dark
          ? "border-slate-700 bg-slate-900/95 text-slate-100 backdrop-blur-sm"
          : "border-slate-200 bg-white/95 text-slate-900 backdrop-blur-sm"
      }`}
      role="region"
      aria-label={tx("pwa_landing_install_title", "Install MachinPro on your phone")}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <img
          src="/icons/icon-192x192.png"
          alt=""
          width={40}
          height={40}
          className="hidden h-10 w-10 shrink-0 rounded-xl sm:block"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">
            <TextWithBrandMarks
              text={tx("pwa_landing_install_title", "Install MachinPro on your phone")}
              tone={dark ? "onDark" : "onLight"}
              className="contents"
            />
          </p>
          {showIos && iosHelp ? (
            <ol
              className={`mt-2 list-decimal space-y-0.5 pl-4 text-xs leading-relaxed ${
                dark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              <li>{tx("pwa_install_ios_step1", "Tap Share in Safari.")}</li>
              <li>{tx("pwa_install_ios_step2", 'Choose “Add to Home Screen”.')}</li>
              <li>{tx("pwa_install_ios_step3", "Tap Add.")}</li>
            </ol>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {showChromium ? (
            <button
              type="button"
              onClick={() => void onInstall()}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500"
            >
              {tx("pwa_landing_install_btn", "Install")}
            </button>
          ) : null}
          {showIos ? (
            <button
              type="button"
              onClick={() => setIosHelp((v) => !v)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500"
            >
              {tx("pwa_landing_install_btn", "Install")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold ${
              dark ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-800 hover:bg-slate-50"
            }`}
          >
            {tx("pwa_landing_install_not_now", "Not now")}
          </button>
        </div>
      </div>
    </div>
  );
}
