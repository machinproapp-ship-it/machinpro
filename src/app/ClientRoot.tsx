"use client";

import { AuthProvider } from "@/lib/AuthContext";
import { SessionIdleChrome } from "@/components/SessionIdleChrome";
import { ToastProvider } from "@/components/Toast";
import { SplashScreenOverlay } from "@/components/SplashScreen";
import { CookieConsent } from "@/components/CookieConsent";

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SessionIdleChrome />
        <SplashScreenOverlay />
        {children}
        <CookieConsent />
      </AuthProvider>
    </ToastProvider>
  );
}
