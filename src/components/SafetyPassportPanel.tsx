"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Download, Loader2, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ALL_TRANSLATIONS } from "@/lib/i18n";
import type { ComplianceField, ComplianceRecord } from "@/app/page";
import {
  type TrainingAssignmentRow,
  type TrainingCourseRow,
  trainingDisplayStatus,
} from "@/types/training";
import type { HazardSeverity, HazardStatus } from "@/types/hazard";

function L(t: Record<string, string>, key: string, fb: string) {
  return (
    (t[key] as string | undefined) ||
    (ALL_TRANSLATIONS.en as Record<string, string>)[key] ||
    fb
  );
}

function categoryLabel(t: Record<string, string>, cat: string | null): string {
  if (!cat) return L(t, "training_cat_other", "Other");
  const k = `training_cat_${cat}`;
  return (t[k] as string | undefined) || cat;
}

type HazardMini = {
  id: string;
  title: string;
  status: HazardStatus;
  severity: HazardSeverity;
  assigned_to: string | null;
  reported_by: string | null;
};

function complianceTargetId(
  profileId: string,
  userProfileToEmployeeId: Record<string, string>
): string {
  return userProfileToEmployeeId[profileId] ?? profileId;
}

export interface SafetyPassportPanelProps {
  t: Record<string, string>;
  companyId: string | null;
  profileId: string;
  profileName: string;
  dateLocale: string;
  complianceFields: ComplianceField[];
  complianceRecords: ComplianceRecord[];
  userProfileToEmployeeId: Record<string, string>;
}

export function SafetyPassportPanel({
  t,
  companyId,
  profileId,
  profileName,
  dateLocale,
  complianceFields,
  complianceRecords,
  userProfileToEmployeeId,
}: SafetyPassportPanelProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<TrainingCourseRow[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignmentRow[]>([]);
  const [hazards, setHazards] = useState<HazardMini[]>([]);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !companyId) {
      setCourses([]);
      setAssignments([]);
      setHazards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [cRes, aRes, hRes] = await Promise.all([
      supabase.from("training_courses").select("*").eq("company_id", companyId),
      supabase.from("training_assignments").select("*").eq("company_id", companyId).eq("user_id", profileId),
      supabase
        .from("hazards")
        .select("id,title,status,severity,assigned_to,reported_by")
        .eq("company_id", companyId)
        .or(`assigned_to.eq.${profileId},reported_by.eq.${profileId}`),
    ]);
    if (!cRes.error) setCourses((cRes.data as TrainingCourseRow[]) ?? []);
    if (!aRes.error) setAssignments((aRes.data as TrainingAssignmentRow[]) ?? []);
    if (!hRes.error) setHazards((hRes.data as HazardMini[]) ?? []);
    setLoading(false);
  }, [companyId, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const courseById = useMemo(() => {
    const m = new Map<string, TrainingCourseRow>();
    for (const c of courses) m.set(c.id, c);
    return m;
  }, [courses]);

  const employeeComplianceFields = useMemo(
    () => complianceFields.filter((f) => f.target.includes("employee")),
    [complianceFields]
  );

  const tid = complianceTargetId(profileId, userProfileToEmployeeId);

  const complianceRows = useMemo(() => {
    return employeeComplianceFields.map((field) => {
      const rec = complianceRecords.find(
        (r) => r.fieldId === field.id && r.targetType === "employee" && r.targetId === tid
      );
      const status = rec?.status ?? "missing";
      return { field, rec, status };
    });
  }, [employeeComplianceFields, complianceRecords, tid]);

  const assignmentViews = useMemo(() => {
    return assignments.map((a) => {
      const c = courseById.get(a.course_id);
      const disp = trainingDisplayStatus(a, c?.expires_after_days);
      return { a, c, disp };
    });
  }, [assignments, courseById]);

  const completedTrainings = assignmentViews.filter((x) => x.disp === "completed");
  const pendingTrainings = assignmentViews.filter((x) => x.disp === "pending");
  const expiredTrainings = assignmentViews.filter((x) => x.disp === "expired");

  const activeHazards = hazards.filter((h) => h.status === "open" || h.status === "in_progress");
  const criticalHazard = activeHazards.some((h) => h.severity === "critical");

  const complianceRed = complianceRows.some((r) => r.status === "expired" || r.status === "missing");
  const complianceOrange = complianceRows.some((r) => r.status === "expiring");

  const passportLevel = useMemo(() => {
    if (expiredTrainings.length > 0 || criticalHazard || complianceRed) return "red" as const;
    if (
      pendingTrainings.length > 0 ||
      activeHazards.length > 0 ||
      complianceOrange
    )
      return "orange" as const;
    return "green" as const;
  }, [
    expiredTrainings.length,
    criticalHazard,
    complianceRed,
    pendingTrainings.length,
    activeHazards.length,
    complianceOrange,
  ]);

  const badge = useMemo(() => {
    if (passportLevel === "green")
      return {
        cls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-100 ring-emerald-400/50",
        label: L(t, "safety_passport_status_green", "Up to date"),
      };
    if (passportLevel === "orange")
      return {
        cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100 ring-amber-400/50",
        label: L(t, "safety_passport_status_orange", "Action recommended"),
      };
    return {
      cls: "bg-red-100 dark:bg-red-900/40 text-red-950 dark:text-red-100 ring-red-400/50",
      label: L(t, "safety_passport_status_red", "Attention required"),
    };
  }, [passportLevel, t]);

  const exportPdf = async () => {
    const el = exportRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      const slug = profileName.replace(/[^a-zA-Z0-9À-ÿ_-]+/g, "_").slice(0, 80);
      const d = new Date();
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      pdf.save(`Pasaporte_Seguridad_${slug}_${ymd}.pdf`);
    } catch (e) {
      console.error(e);
    }
    setExporting(false);
  };

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
          {L(t, "safety_passport", "Safety passport")}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-2 ${badge.cls}`}
          >
            {badge.label}
          </span>
          <button
            type="button"
            disabled={exporting || loading}
            onClick={() => void exportPdf()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            {L(t, "safety_passport_export", "Export passport")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {L(t, "loading", "Loading…")}
        </div>
      ) : null}

      <div
        ref={exportRef}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-white dark:text-zinc-900"
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{L(t, "employees_display_anonymous", "Employee")}</p>
          <p className="text-lg font-semibold">{profileName}</p>
          <p className="text-sm text-zinc-600">
            {L(t, "safety_passport_status_label", "Status")}: {badge.label}
          </p>
        </div>

        {employeeComplianceFields.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold mb-2">{L(t, "compliance", "Compliance")}</h4>
            <ul className="space-y-1 text-sm">
              {complianceRows.map(({ field, status }) => (
                <li key={field.id} className="flex justify-between gap-2 border-b border-zinc-100 pb-1">
                  <span>{field.name}</span>
                  <span className="shrink-0 font-medium capitalize">{status}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <h4 className="text-sm font-semibold mb-2">{L(t, "training_completed", "Completed")}</h4>
          {completedTrainings.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {completedTrainings.map(({ a, c }) => (
                <li key={a.id}>
                  {c?.title ?? "—"}
                  {a.completed_at
                    ? ` · ${new Date(a.completed_at).toLocaleDateString(dateLocale)}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">{L(t, "training_pending", "Pending")}</h4>
          {pendingTrainings.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {pendingTrainings.map(({ a, c }) => (
                <li key={a.id}>
                  {c?.title ?? "—"}
                  {c?.category ? ` · ${categoryLabel(t, c.category)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        {expiredTrainings.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-red-700">{L(t, "training_expired", "Expired")}</h4>
            <ul className="space-y-1 text-sm">
              {expiredTrainings.map(({ a, c }) => (
                <li key={a.id}>{c?.title ?? "—"}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <h4 className="text-sm font-semibold mb-2">{L(t, "security_tab_hazards", "Hazards")}</h4>
          {hazards.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">—</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {hazards.map((h) => (
                <li key={h.id} className="border-b border-zinc-100 pb-2">
                  <span className="font-medium">{h.title}</span>
                  <span className="text-zinc-600">
                    {" "}
                    · {h.status} · {h.severity}
                  </span>
                  {h.assigned_to === profileId ? (
                    <span className="block text-xs text-zinc-500">
                      {L(t, "safety_passport_hazard_assigned", "Assigned to employee")}
                    </span>
                  ) : null}
                  {h.reported_by === profileId ? (
                    <span className="block text-xs text-zinc-500">
                      {L(t, "safety_passport_hazard_reported", "Reported by employee")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
