"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6">
      <h1 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
        Algo ha fallado
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 max-w-md text-center">
        {error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
      >
        Reintentar
      </button>
    </div>
  );
}
