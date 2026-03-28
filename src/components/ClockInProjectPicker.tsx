"use client";

import { useEffect, useState } from "react";

export type ClockInAssignedProject = { id: string; name: string; projectCode?: string };

type Props = {
  lx: Record<string, string>;
  assignedProjects: ClockInAssignedProject[];
  clockInProjectCode: string;
  setClockInProjectCode: (v: string) => void;
  /** Selecting a project triggers immediate clock-in (GPS flow handled by parent). */
  onSelectProjectClockIn: (p: ClockInAssignedProject) => void;
  /** Lets parent show the manual "Clock in" button only when needed. */
  onManualClockInNeededChange?: (needed: boolean) => void;
};

export function ClockInProjectPicker({
  lx,
  assignedProjects,
  clockInProjectCode,
  setClockInProjectCode,
  onSelectProjectClockIn,
  onManualClockInNeededChange,
}: Props) {
  const [freeCodeMode, setFreeCodeMode] = useState(false);
  const hasAssigned = assignedProjects.length > 0;

  useEffect(() => {
    const manual = !hasAssigned || freeCodeMode;
    onManualClockInNeededChange?.(manual);
  }, [hasAssigned, freeCodeMode, onManualClockInNeededChange]);

  const selectPrompt =
    (lx as Record<string, string>).selectProjectToClock ?? "Choose a project";

  if (!hasAssigned) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={clockInProjectCode}
          onChange={(e) => setClockInProjectCode(e.target.value.toUpperCase())}
          placeholder={(lx as Record<string, string>).projectCode ?? lx.projectCodePlaceholder ?? ""}
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-mono tracking-wider uppercase text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
          autoCapitalize="characters"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {(lx as Record<string, string>).projectCodeHint ?? ""}
        </p>
      </div>
    );
  }

  if (freeCodeMode) {
    return (
      <div className="space-y-3">
        <input
          type="text"
          value={clockInProjectCode}
          onChange={(e) => setClockInProjectCode(e.target.value.toUpperCase())}
          placeholder={(lx as Record<string, string>).projectCode ?? lx.projectCodePlaceholder ?? ""}
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-mono tracking-wider uppercase text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
          autoCapitalize="characters"
        />
        <button
          type="button"
          onClick={() => {
            setFreeCodeMode(false);
            setClockInProjectCode("");
          }}
          className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-slate-800"
        >
          {(lx as Record<string, string>).backToMyProjects ?? ""}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {selectPrompt}
      </label>
      <select
        defaultValue=""
        key={assignedProjects.map((p) => p.id).join(",")}
        onChange={(e) => {
          const id = e.target.value;
          const p = assignedProjects.find((x) => x.id === id);
          if (p) onSelectProjectClockIn(p);
          e.target.value = "";
        }}
        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <option value="">{selectPrompt}</option>
        {assignedProjects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.projectCode ? ` · ${p.projectCode}` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setFreeCodeMode(true)}
        className="w-full min-h-[44px] rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/40"
      >
        {(lx as Record<string, string>).useAnotherCode ?? ""}
      </button>
    </div>
  );
}
