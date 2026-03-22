"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SPLASH_KEY = "machinpro_splash_seen";

export function SplashScreenOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY)) return;
    } catch {
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SPLASH_KEY, "1");
      } catch {
        /* ignore */
      }
      setVisible(false);
    }, 1100);
    return () => window.clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#1a4f5e] transition-opacity duration-500"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="mb-6 animate-pulse">
        <Image
          src="/logo-source.png"
          alt=""
          width={120}
          height={120}
          className="h-24 w-24 object-contain drop-shadow-lg"
          priority
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <div
        className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin"
        aria-hidden
      />
    </div>
  );
}
