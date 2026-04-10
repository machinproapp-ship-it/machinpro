"use client";

import { useAppLocale } from "@/hooks/useAppLocale";
import { useAuth } from "@/lib/AuthContext";

export function SessionIdleChrome() {
  const { sessionIdleWarning, continueSession, session } = useAuth();
  const { t } = useAppLocale();
  const tl = t as Record<string, string>;

  if (!session || !sessionIdleWarning) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      <div className="flex w-full max-w-2xl flex-col gap-2 rounded-b-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm shadow-lg dark:border-amber-700/50 dark:bg-amber-950/90 dark:text-amber-50 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-amber-950 dark:text-amber-100">
            {tl.session_expiring_soon ?? "Your session is about to expire"}
          </p>
          <p className="text-amber-900/90 dark:text-amber-200/90">
            {tl.session_expiring_desc ?? "Due to inactivity, we will sign you out in 5 minutes"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => continueSession()}
          className="min-h-[44px] shrink-0 rounded-lg border border-amber-600 bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-500 dark:border-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500"
        >
          {tl.session_continue ?? "Stay signed in"}
        </button>
      </div>
    </div>
  );
}
