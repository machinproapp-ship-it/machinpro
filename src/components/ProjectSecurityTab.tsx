"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardCheck } from "lucide-react";
import type { UserRole } from "@/types/shared";
import { HazardModule } from "@/components/HazardModule";
import {
  CorrectiveActionsModule,
  type CorrectiveActionsPrefill,
} from "@/components/CorrectiveActionsModule";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";
import { ALL_TRANSLATIONS } from "@/lib/i18n";

type SubTab = "hazards" | "actions";

export interface ProjectSecurityTabProps {
  t: Record<string, string>;
  projectId: string;
  projectName: string;
  companyId: string | null;
  companyName: string;
  userRole: UserRole;
  userName: string;
  userProfileId: string | null;
  projects: { id: string; name: string }[];
  employees: { id: string; name: string; role?: string }[];
  focusHazardId: string | null;
  onFocusHazardConsumed: () => void;
  correctivePrefill: CorrectiveActionsPrefill | null;
  onConsumeCorrectivePrefill: () => void;
  openHazardSignal: number;
  openActionSignal: number;
  onSetCorrectivePrefill: (p: CorrectiveActionsPrefill | null) => void;
  onRequestFocusHazard: (id: string) => void;
  onSecurityInteraction?: () => void;
  canShowHazards: boolean;
  canShowActions: boolean;
  dateLocale: string;
  timeZone: string;
}

export function ProjectSecurityTab({
  t,
  projectId,
  projectName,
  companyId,
  companyName,
  userRole,
  userName,
  userProfileId,
  projects,
  employees,
  focusHazardId,
  onFocusHazardConsumed,
  correctivePrefill,
  onConsumeCorrectivePrefill,
  openHazardSignal,
  openActionSignal,
  onSetCorrectivePrefill,
  onRequestFocusHazard,
  onSecurityInteraction,
  canShowHazards,
  canShowActions,
  dateLocale,
  timeZone,
}: ProjectSecurityTabProps) {
  const E = ALL_TRANSLATIONS.en as Record<string, string>;
  const L = (k: string, fb: string) => (t[k] as string | undefined) || E[k] || fb;

  const firstSub: SubTab = canShowHazards ? "hazards" : "actions";
  const [sub, setSub] = useState<SubTab>(firstSub);
  const lastHazardSig = useRef(0);
  const lastActionSig = useRef(0);

  useEffect(() => {
    if (!canShowHazards && canShowActions) setSub("actions");
    else if (canShowHazards && !canShowActions) setSub("hazards");
  }, [canShowHazards, canShowActions]);

  useEffect(() => {
    const h = openHazardSignal ?? 0;
    if (h > lastHazardSig.current && canShowHazards) {
      lastHazardSig.current = h;
      setSub("hazards");
      onSecurityInteraction?.();
    }
  }, [openHazardSignal, canShowHazards, onSecurityInteraction]);

  useEffect(() => {
    const a = openActionSignal ?? 0;
    if (a > lastActionSig.current && canShowActions) {
      lastActionSig.current = a;
      setSub("actions");
      onSecurityInteraction?.();
    }
  }, [openActionSignal, canShowActions, onSecurityInteraction]);

  const openCorrectiveFromHazard = useCallback(
    (p: { hazardId: string; projectId: string | null; projectName: string | null }) => {
      onSetCorrectivePrefill({
        hazardId: p.hazardId,
        projectId: p.projectId ?? projectId,
        projectName: p.projectName ?? projectName,
      });
      if (canShowActions) setSub("actions");
    },
    [canShowActions, onSetCorrectivePrefill, projectId, projectName]
  );

  const navigateToHazard = useCallback(
    (id: string) => {
      onRequestFocusHazard(id);
      if (canShowHazards) setSub("hazards");
    },
    [canShowHazards, onRequestFocusHazard]
  );

  if (!canShowHazards && !canShowActions) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 py-6 text-center">
        {L("perm_no_access", "No access")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <HorizontalScrollFade className="border-b border-zinc-200 dark:border-slate-700 pb-2" variant="inherit">
        <div
          className="flex w-full min-w-0 max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0"
          role="tablist"
          aria-label={L("security_tab", "Security")}
        >
          {canShowHazards ? (
            <button
              type="button"
              role="tab"
              aria-selected={sub === "hazards"}
              onClick={() => {
                onSecurityInteraction?.();
                setSub("hazards");
              }}
              className={`inline-flex shrink-0 items-center gap-2 min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                sub === "hazards"
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-950 ring-2 ring-amber-400/70 dark:text-amber-100 dark:ring-amber-500/50"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-slate-800"
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {L("security_hazards", "Hazards")}
            </button>
          ) : null}
          {canShowActions ? (
            <button
              type="button"
              role="tab"
              aria-selected={sub === "actions"}
              onClick={() => {
                onSecurityInteraction?.();
                setSub("actions");
              }}
              className={`inline-flex shrink-0 items-center gap-2 min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                sub === "actions"
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-950 ring-2 ring-amber-400/70 dark:text-amber-100 dark:ring-amber-500/50"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-slate-800"
              }`}
            >
              <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden />
              {L("security_corrective", "Corrective actions")}
            </button>
          ) : null}
        </div>
      </HorizontalScrollFade>

      <div role="tabpanel" className="space-y-4">
        {/* Mantener ambos montados para que los refs de “open create signal” no disparen al cambiar de sub-pestaña. */}
        {canShowHazards ? (
          <div className={sub !== "hazards" ? "hidden" : undefined} aria-hidden={sub !== "hazards"}>
            <HazardModule
              t={t}
              companyId={companyId}
              companyName={companyName}
              userRole={userRole}
              userName={userName}
              userProfileId={userProfileId}
              projects={projects}
              employees={employees}
              focusHazardId={focusHazardId}
              onFocusHazardConsumed={onFocusHazardConsumed}
              onOpenCorrectiveFromHazard={openCorrectiveFromHazard}
              openCreateSignal={openHazardSignal}
              lockedProjectId={projectId}
              dateLocale={dateLocale}
              timeZone={timeZone}
            />
          </div>
        ) : null}
        {canShowActions ? (
          <div className={sub !== "actions" ? "hidden" : undefined} aria-hidden={sub !== "actions"}>
            <CorrectiveActionsModule
              t={t}
              companyId={companyId}
              companyName={companyName}
              userRole={userRole}
              userName={userName}
              userProfileId={userProfileId}
              projects={projects}
              employees={employees}
              prefill={correctivePrefill}
              onConsumePrefill={onConsumeCorrectivePrefill}
              onNavigateToHazard={navigateToHazard}
              openCreateSignal={openActionSignal}
              lockedProjectId={projectId}
              dateLocale={dateLocale}
              timeZone={timeZone}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
