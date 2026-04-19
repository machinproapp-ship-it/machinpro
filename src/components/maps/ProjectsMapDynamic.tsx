"use client";

import dynamic from "next/dynamic";

export const ProjectsMapDynamic = dynamic(() => import("./ProjectsMapInner").then((m) => m.ProjectsMapInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-slate-700 dark:bg-slate-800 md:h-[600px]">
      <span className="text-sm text-zinc-500">…</span>
    </div>
  ),
});
