"use client";

import { useMemo } from "react";
import { formatWorkDurationCompact } from "@/lib/clockDisplay";

export type ClockRingPaymentType = "hourly" | "salary" | "production";

export type ClockRingTimerProps = {
  currentMinutes: number;
  goalMinutes: number;
  isOnBreak: boolean;
  paymentType: ClockRingPaymentType;
  labels: Record<string, string>;
  /** Already formatted wall time, e.g. "18:06" */
  clockInHmDisplay: string;
  /** Visual size — production layout uses ~60% scale */
  compact?: boolean;
  className?: string;
};

const ORANGE = "#F97316";
const AMBER = "#F59E0B";
/** Neutral progress on break — slightly lighter than track */
const BREAK_FG = "#a1a1aa";

export function ClockRingTimer({
  currentMinutes,
  goalMinutes,
  isOnBreak,
  paymentType: _paymentType,
  labels,
  clockInHmDisplay,
  compact = false,
  className = "",
}: ClockRingTimerProps) {
  void _paymentType;
  const lx = labels;
  const r = 42;
  const circumference = useMemo(() => 2 * Math.PI * r, []);

  const goal = Math.max(1, Math.floor(goalMinutes || 8 * 60));
  const worked = Math.max(0, Math.floor(currentMinutes));

  const ratioToGoal = Math.min(worked / goal, 1);
  const overGoal = worked > goal;

  const ringState = useMemo(() => {
    if (isOnBreak) return { mode: "break" as const };
    if (overGoal) return { mode: "overtime" as const };
    if (worked >= goal && ratioToGoal >= 1) return { mode: "done" as const };
    return { mode: "progress" as const };
  }, [isOnBreak, overGoal, worked, goal, ratioToGoal]);

  const progressRatio = useMemo(() => {
    if (ringState.mode === "break") return Math.min(worked / goal, 1);
    if (ringState.mode === "overtime") return 1;
    return ratioToGoal;
  }, [ringState.mode, worked, goal, ratioToGoal]);

  const strokeColor = useMemo(() => {
    if (ringState.mode === "break") return BREAK_FG;
    if (ringState.mode === "overtime") return AMBER;
    return ORANGE;
  }, [ringState.mode]);

  const dashOffset = circumference * (1 - Math.min(progressRatio, 1));

  const durationText = formatWorkDurationCompact(worked, lx);

  const statusLine = useMemo(() => {
    if (ringState.mode === "break")
      return lx.clock_on_break_timer ?? lx.clock_on_break ?? "En pausa";
    if (ringState.mode === "overtime") return lx.clock_overtime ?? "Horas extra";
    if (ringState.mode === "done") return lx.clock_goal_reached ?? "Objetivo cumplido";
    return "";
  }, [ringState.mode, lx]);

  const entradaLabel = lx.clockInEntry ?? "Entrada";
  const sizeCls = compact ? "max-w-[168px] w-[min(60vw,10.5rem)]" : "max-w-[280px] w-[min(88vw,17.5rem)]";

  return (
    <div className={`mx-auto flex flex-col items-center ${sizeCls} ${className}`}>
      <div className="relative aspect-square w-full">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
          aria-hidden
          role="img"
          aria-label={durationText}
        >
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="8"
            className="stroke-zinc-300 transition-colors duration-300 dark:stroke-zinc-600"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.65s ease-out, stroke 0.35s ease" }}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <p className="text-[clamp(1.35rem,5vw,1.85rem)] font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">
            {durationText}
          </p>
          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {entradaLabel}: {clockInHmDisplay}
          </p>
          {statusLine ? (
            <p className="mt-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">{statusLine}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
