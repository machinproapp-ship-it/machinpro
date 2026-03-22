"use client";

import { AuthProvider } from "@/lib/AuthContext";
import { ToastProvider } from "@/components/Toast";
import { SplashScreenOverlay } from "@/components/SplashScreen";

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SplashScreenOverlay />
        {children}
      </AuthProvider>
    </ToastProvider>
  );
}
