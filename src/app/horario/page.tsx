"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HorarioPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?view=worker");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
      <p className="text-sm">Redirigiendo a Horario…</p>
    </div>
  );
}
