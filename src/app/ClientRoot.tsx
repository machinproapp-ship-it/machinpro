"use client";

import { Suspense } from "react";
import { AuthProvider } from "@/lib/AuthContext";
import { SessionIdleChrome } from "@/components/SessionIdleChrome";
import { ToastProvider } from "@/components/Toast";
import { SplashScreenOverlay } from "@/components/SplashScreen";
import { CookieConsent } from "@/components/CookieConsent";
import { Ga4RouteAnalytics } from "@/components/Ga4RouteAnalytics";

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SessionIdleChrome />
        <SplashScreenOverlay />
        {children}
        <Suspense fallback={null}>
          <Ga4RouteAnalytics />
        </Suspense>
        <CookieConsent />
      </AuthProvider>
    </ToastProvider>
  );
}
