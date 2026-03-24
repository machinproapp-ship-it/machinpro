"use client";

import { AuthProvider } from "@/lib/AuthContext";
import { ToastProvider } from "@/components/Toast";
import { SplashScreenOverlay } from "@/components/SplashScreen";
import { CookieConsent } from "@/components/CookieConsent";

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SplashScreenOverlay />
        {children}
        <CookieConsent />
      </AuthProvider>
    </ToastProvider>
  );
}
