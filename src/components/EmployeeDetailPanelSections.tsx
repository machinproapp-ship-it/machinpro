"use client";

/**
 * AH-34-FIX3: Minimal employee-detail helpers + error boundaries only.
 * Heavy sections (clocks, timesheets, vacations, SWPs) removed until stable.
 * Every exported helper coerces values to React-safe text (no #300).
 */

import React, { Component, type ErrorInfo, type ReactNode } from "react";

/** Isolates render failures so one subsection does not crash the whole drawer. */
export class DetailSectionErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { err: Error | null }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[EmployeeDetailSection]", error.message, info.componentStack?.slice(0, 500));
  }

  render() {
    if (this.state.err) return <>{this.props.fallback}</>;
    return this.props.children;
  }
}

/** React #300 guard: never return objects/arrays as JSX children. */
export function safeText(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toLocaleDateString();
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function safeDateString(v: unknown, fallback = ""): string {
  if (v == null || v === "") return fallback;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = typeof v === "string" ? v : String(v);
  return s.slice(0, 10) || fallback;
}
