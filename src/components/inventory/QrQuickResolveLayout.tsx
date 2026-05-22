"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

export function QrQuickResolveLayout({
  children,
  loading,
  labels,
}: {
  children: React.ReactNode;
  loading?: boolean;
  labels: Record<string, string>;
}) {
  const L = (k: string, fb: string) => labels[k] ?? fb;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" aria-hidden />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {L("common_loading", "Loading...")}
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function QrQuickBackLink({ labels }: { labels: Record<string, string> }) {
  const L = (k: string, fb: string) => labels[k] ?? fb;
  return (
    <Link
      href="/"
      className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500"
    >
      {L("inventory_qrBackToInventory", "Back to inventory")}
    </Link>
  );
}
