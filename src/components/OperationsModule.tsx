"use client";

import { useState } from "react";
import { Building2, Users, ChevronDown, ChevronRight } from "lucide-react";
import { ALL_TRANSLATIONS } from "@/lib/i18n";

export interface OpsEmployee {
  id: string;
  name: string;
  role: string;
  certificates: { id: string; name: string; expiryDate?: string }[];
}

export interface OpsProject {
  id: string;
  name: string;
  location?: string;
  assignedEmployeeIds?: string[];
}

export interface ClockEntry {
  id: string;
  employeeId: string;
  projectId?: string;
  projectCode?: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  locationLat?: number;
  locationLng?: number;
  locationAlert?: boolean;
  locationAlertMeters?: number;
  hadPendingCerts?: boolean;
}

export interface OperationsModuleProps {
  projects?: OpsProject[] | null;
  employees?: OpsEmployee[] | null;
  clockEntries?: ClockEntry[] | null;
  labels: Record<string, string>;
}

function SectionCard({
  title,
  desc,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />}
        {icon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
        </div>
      </button>
      {open && <div className="border-t border-zinc-200 dark:border-slate-700 px-4 py-3">{children}</div>}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400 italic py-4 text-center">{text}</p>
  );
}

export function OperationsModule({ projects = [], employees = [], clockEntries = [], labels: t }: OperationsModuleProps) {
  return (
    <section className="min-w-0 space-y-4 overflow-x-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
        {t.nav_operations || ALL_TRANSLATIONS.en.nav_operations}
      </h2>

      {clockEntries != null && clockEntries.length > 0 && (
        <SectionCard
          title={t.opsForceStatus || ALL_TRANSLATIONS.en.opsForceStatus}
          desc={t.opsForceStatusDesc || ALL_TRANSLATIONS.en.opsForceStatusDesc}
          icon={<Users className="h-4 w-4 text-emerald-500" />}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {(clockEntries ?? []).map((entry) => {
              const emp = (employees ?? []).find((e) => e.id === entry.employeeId);
              const proj = (projects ?? []).find((p) => p.id === entry.projectId);
              return (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-slate-700 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1 basis-[min(100%,16rem)] sm:basis-auto">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {emp?.name ?? entry.employeeId}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {proj?.name ?? entry.projectCode ?? "—"} · {entry.date} {entry.clockIn}
                    </p>
                  </div>
                  {entry.locationAlert && (
                    <span className="inline-flex min-h-[44px] max-w-full shrink-0 items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {t.ops_gps_out_of_range_badge ?? ALL_TRANSLATIONS.en.ops_gps_out_of_range_badge}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title={t.opsAllProjects || ALL_TRANSLATIONS.en.opsAllProjects}
        desc={t.opsApprovalsDesc || ALL_TRANSLATIONS.en.opsApprovalsDesc}
        icon={<Building2 className="h-4 w-4 text-amber-500" />}
        defaultOpen={false}
      >
        {(projects ?? []).length === 0 ? (
          <EmptyRow text={t.opsNoClockIns || ALL_TRANSLATIONS.en.opsNoClockIns} />
        ) : (
          <div className="space-y-3">
            {(projects ?? []).map((proj) => {
              const assigned = (employees ?? []).filter((e) =>
                (proj.assignedEmployeeIds ?? []).includes(e.id)
              );
              const withAlerts = assigned.filter((e) =>
                (e.certificates ?? []).some((c) => {
                  if (!c.expiryDate) return false;
                  const days = Math.ceil(
                    (new Date(c.expiryDate).getTime() - new Date().getTime()) / 86_400_000
                  );
                  return days <= 30;
                })
              );
              return (
                <div
                  key={proj.id}
                  className="flex items-start justify-between rounded-xl border border-zinc-200 dark:border-slate-700 px-4 py-3 gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {proj.name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1 flex-wrap">
                      <Users className="h-3 w-3 shrink-0" />
                      {assigned.length === 1
                        ? (t.project_team_one ?? "1 person")
                        : (t.project_team_many ?? "{{n}} people").replace(/\{\{n\}\}/g, String(assigned.length))}
                      {withAlerts.length > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {(t.ops_cert_expiring_count ?? "· {{n}} with expiring certificates").replace(
                            /\{\{n\}\}/g,
                            String(withAlerts.length)
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 text-right">
                    {proj.location ?? "—"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </section>
  );
}
