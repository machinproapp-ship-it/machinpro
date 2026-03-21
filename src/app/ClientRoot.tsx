"use client";

import { AuthProvider } from "@/lib/AuthContext";

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
