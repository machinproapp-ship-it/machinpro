"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudRain,
  FileDown,
  Plus,
  Snowflake,
  Sun,
  Trash2,
  Wind,
  PenLine,
  Check,
} from "lucide-react";
import type {
  DailyFieldReport,
  DailyReportHazard,
  DailyReportPpeKey,
  DailyReportTask,
  DailyReportWeather,
} from "@/types/dailyFieldReport";
import { DAILY_REPORT_PPE_KEYS } from "@/types/dailyFieldReport";
import { generateDailyFieldReportPdf } from "@/lib/generateDailyFieldReportPdf";
import { formatReportDate, formatReportDateTime } from "@/lib/dailyReportFormat";
import {
  fetchDailyReportsForCompany,
  insertSignature,
  patchTaskCompleted,
  saveDailyReportFull,
} from "@/lib/dailyReportsDb";
import { supabase } from "@/lib/supabase";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";

const WEATHER_OPTIONS: { value: DailyReportWeather; Icon: typeof Sun }[] = [
  { value: "sunny", Icon: Sun },
  { value: "cloudy", Icon: Cloud },
  { value: "rain", Icon: CloudRain },
  { value: "wind", Icon: Wind },
  { value: "snow", Icon: Snowflake },
];

function weatherLabel(w: DailyReportWeather, tl: Record<string, string>): string {
  const m: Record<DailyReportWeather, string> = {
    sunny: tl.weatherSunny ?? "Sunny",
    cloudy: tl.weatherCloudy ?? "Cloudy",
    rain: tl.weatherRain ?? tl.weatherRainy ?? "Rain",
    wind: tl.weatherWind ?? tl.weatherWindy ?? "Wind",
    snow: tl.weatherSnow ?? tl.weatherSnowy ?? "Snow",
  };
  return m[w] ?? w;
}

function ppeLabel(key: DailyReportPpeKey, tl: Record<string, string>): string {
  const m: Record<DailyReportPpeKey, string> = {
    helmet: tl.ppeHelmet ?? "Helmet",
    vest: tl.ppeVest ?? "Vest",
    boots: tl.ppeBoots ?? "Boots",
    gloves: tl.ppeGloves ?? "Gloves",
    goggles: tl.ppeGoggles ?? "Goggles",
    harness: tl.ppeHarness ?? "Harness",
  };
  return m[key] ?? key;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function createEmptyReport(params: {
  projectId: string;
  projectName: string;
  companyId: string;
  createdBy: string;
  createdByName: string;
}): DailyFieldReport {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    companyId: params.companyId,
    projectId: params.projectId,
    projectName: params.projectName,
    createdBy: params.createdBy,
    createdByName: params.createdByName,
    date: todayYmd(),
    weather: "sunny",
    siteConditions: "",
    notes: "",
    status: "draft",
    ppeSelected: [],
    ppeOther: "",
    hazards: [],
    tasks: [],
    photos: [],
    signatures: [],
    attendance: [],
    createdAt: now,
  };
}

export type DailyFieldReportViewProps = {
  report: DailyFieldReport | null;
  /** Vista completa (supervisor/admin) o solo tareas/firma (empleado). */
  variant: "full" | "employee";
  projectId: string;
  projectName: string;
  companyName: string;
  companyId: string;
  companyLogoUrl?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  projectAssignees: { profileId: string; name: string }[];
  currentUserProfileId: string;
  currentUserName: string;
  language: string;
  labels: Record<string, string>;
  countryCode?: string;
  /** IANA; mismo criterio que perfil de usuario */
  timeZone?: string;
  cloudinaryCloudName: string;
  cloudinaryUploadPreset: string;
  onBack: () => void;
  onRefreshList?: () => void;
  /** Tras el primer guardado de un parte nuevo, sincroniza la clave abierta con el id persistido. */
  onReportCreated?: (id: string) => void;
  /** Cuando pasa a publicado / enviado (primera vez). */
  onReportPublished?: (report: DailyFieldReport) => void;
  /** Supervisor puede cerrar el parte como aprobado. */
  canApproveReport?: boolean;
};

export function DailyFieldReportView({
  report,
  variant,
  projectId,
  projectName,
  companyName,
  companyId,
  companyLogoUrl,
  companyAddress,
  companyPhone,
  companyEmail,
  companyWebsite,
  projectAssignees,
  currentUserProfileId,
  currentUserName,
  language,
  labels: rawLabels,
  countryCode = "CA",
  timeZone,
  cloudinaryCloudName,
  cloudinaryUploadPreset,
  onBack,
  onRefreshList,
  onReportCreated,
  onReportPublished,
  canApproveReport = false,
}: DailyFieldReportViewProps) {
  void useMachinProDisplayPrefs();
  const tl = rawLabels as Record<string, string>;
  const isEmployeeView = variant === "employee";
  const [draft, setDraft] = useState<DailyFieldReport>(() =>
    report
      ? { ...report }
      : createEmptyReport({
          projectId,
          projectName,
          companyId,
          createdBy: currentUserProfileId,
          createdByName: currentUserName,
        })
  );

  const [headerOpen, setHeaderOpen] = useState(true);
  const [briefingOpen, setBriefingOpen] = useState(true);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [attOpen, setAttOpen] = useState(true);
  const [photosOpen, setPhotosOpen] = useState(true);
  const [sigOpen, setSigOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [clockedIds, setClockedIds] = useState<Set<string>>(new Set());
  const [dayWorkedMinutes, setDayWorkedMinutes] = useState<number | null>(null);
  const [signModal, setSignModal] = useState<"none" | "pick" | "draw" | "tap_named">("none");
  const [tapNamedInput, setTapNamedInput] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const supervisorFormLocked =
    !isEmployeeView && (draft.status === "published" || draft.status === "approved");
  const readOnly = supervisorFormLocked || (isEmployeeView && false);
  const isSent = draft.status === "published";
  const isApproved = draft.status === "approved";

  const myTasks = useMemo(() => {
    if (!isEmployeeView) return [];
    return draft.tasks.filter((t) => t.employeeId === currentUserProfileId);
  }, [draft.tasks, currentUserProfileId, isEmployeeView]);

  const alreadySigned = useMemo(
    () => draft.signatures.some((s) => s.employeeId === currentUserProfileId),
    [draft.signatures, currentUserProfileId]
  );

  useEffect(() => {
    if (report) setDraft({ ...report });
  }, [report?.id, report?.updatedAt]);

  useEffect(() => {
    if (!supabase || !companyId || !projectId || !draft.date) return;
    const start = new Date(`${draft.date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    void (async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("user_id")
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .gte("clock_in_at", start.toISOString())
        .lt("clock_in_at", end.toISOString());
      const s = new Set<string>();
      for (const row of data ?? []) {
        const r = row as { user_id?: string };
        if (r.user_id) s.add(r.user_id);
      }
      setClockedIds(s);
    })();
  }, [companyId, projectId, draft.date]);

  useEffect(() => {
    if (!supabase || !companyId || !projectId || !draft.date) {
      setDayWorkedMinutes(null);
      return;
    }
    const start = new Date(`${draft.date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    void (async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("clock_in_at, clock_out_at")
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .gte("clock_in_at", start.toISOString())
        .lt("clock_in_at", end.toISOString());
      let minutes = 0;
      for (const row of data ?? []) {
        const r = row as { clock_in_at?: string; clock_out_at?: string | null };
        const cin = r.clock_in_at ? new Date(r.clock_in_at).getTime() : NaN;
        if (!Number.isFinite(cin)) continue;
        const cout = r.clock_out_at
          ? new Date(r.clock_out_at).getTime()
          : Date.now();
        if (cout > cin) minutes += Math.round((cout - cin) / 60_000);
      }
      setDayWorkedMinutes(minutes);
    })();
  }, [companyId, projectId, draft.date, supabase]);

  const daySummaryPresent = useMemo(
    () => draft.attendance.filter((a) => a.status === "present").length,
    [draft.attendance]
  );
  const daySummaryTasksDone = useMemo(
    () => draft.tasks.filter((t) => t.completed).length,
    [draft.tasks]
  );
  const daySummaryHoursLabel = useMemo(() => {
    if (dayWorkedMinutes == null) return "—";
    const h = Math.floor(dayWorkedMinutes / 60);
    const m = dayWorkedMinutes % 60;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m > 0 ? `${m}m` : ""}`.trim();
  }, [dayWorkedMinutes]);

  useEffect(() => {
    if (isEmployeeView || draft.status !== "draft" || draft.attendance.length > 0) return;
    setDraft((d) => ({
      ...d,
      attendance: projectAssignees.map((a) => ({
        id: crypto.randomUUID(),
        employeeId: a.profileId,
        status: clockedIds.has(a.profileId) ? "present" : ("absent" as const),
        fromTimeclock: clockedIds.has(a.profileId),
        employeeName: a.name,
      })),
    }));
  }, [projectAssignees, clockedIds, isEmployeeView, draft.status, draft.attendance.length]);

  const updateDraft = useCallback((patch: Partial<DailyFieldReport>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const togglePpe = useCallback((key: DailyReportPpeKey) => {
    setDraft((d) => {
      const has = d.ppeSelected.includes(key);
      return {
        ...d,
        ppeSelected: has ? d.ppeSelected.filter((x) => x !== key) : [...d.ppeSelected, key],
      };
    });
  }, []);

  const addHazard = useCallback(() => {
    const h: DailyReportHazard = {
      id: crypto.randomUUID(),
      description: "",
      ppeRequired: [],
    };
    setDraft((d) => ({ ...d, hazards: [...d.hazards, h] }));
  }, []);

  const updateHazard = useCallback((id: string, patch: Partial<DailyReportHazard>) => {
    setDraft((d) => ({
      ...d,
      hazards: d.hazards.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  }, []);

  const removeHazard = useCallback((id: string) => {
    setDraft((d) => ({ ...d, hazards: d.hazards.filter((x) => x.id !== id) }));
  }, []);

  const toggleHazardPpe = useCallback((hid: string, key: DailyReportPpeKey) => {
    setDraft((d) => ({
      ...d,
      hazards: d.hazards.map((h) => {
        if (h.id !== hid) return h;
        const has = h.ppeRequired.includes(key);
        return {
          ...h,
          ppeRequired: has ? h.ppeRequired.filter((x) => x !== key) : [...h.ppeRequired, key],
        };
      }),
    }));
  }, []);

  const addTask = useCallback(() => {
    const t: DailyReportTask = {
      id: crypto.randomUUID(),
      employeeId: projectAssignees[0]?.profileId ?? null,
      description: "",
      completed: false,
    };
    setDraft((d) => ({ ...d, tasks: [...d.tasks, t] }));
  }, [projectAssignees]);

  const updateTask = useCallback((id: string, patch: Partial<DailyReportTask>) => {
    setDraft((d) => ({
      ...d,
      tasks: d.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  }, []);

  const removeTask = useCallback((id: string) => {
    setDraft((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== id) }));
  }, []);

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (readOnly || draft.photos.length >= 10) return;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", cloudinaryUploadPreset);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
        method: "POST",
        body: fd,
      });
      const j = (await res.json()) as { secure_url?: string; public_id?: string; error?: { message?: string } };
      if (!j.secure_url) {
        setErrMsg(j.error?.message ?? tl.dailyReportPhotoError ?? "Upload failed");
        return;
      }
      setDraft((d) => ({
        ...d,
        photos: [
          ...d.photos,
          {
            id: crypto.randomUUID(),
            url: j.secure_url!,
            cloudinaryId: j.public_id ?? null,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [cloudinaryCloudName, cloudinaryUploadPreset, draft.photos.length, readOnly, tl.dailyReportPhotoError]
  );

  const persist = useCallback(
    async (next: DailyFieldReport) => {
      if (!supabase) {
        setErrMsg(tl.dailyReportOffline ?? "Offline");
        return;
      }
      const prevStatus = draft.status;
      setBusy(true);
      setErrMsg(null);
      const { error } = await saveDailyReportFull(supabase, next);
      setBusy(false);
      if (error) {
        setErrMsg(error.message);
        return;
      }
      if (next.status === "published" && prevStatus !== "published") {
        onReportPublished?.(next);
      }
      if (report?.id) {
        const fresh = await fetchDailyReportsForCompany(supabase, companyId);
        const found = fresh.find((r) => r.id === next.id);
        if (found) setDraft(found);
      } else if (next.id) {
        onReportCreated?.(next.id);
      }
      onRefreshList?.();
    },
    [companyId, draft.status, onRefreshList, onReportCreated, onReportPublished, report?.id, tl.dailyReportOffline]
  );

  const handleSaveDraft = useCallback(() => {
    if (readOnly) return;
    void persist({ ...draft, status: "draft" });
  }, [draft, persist, readOnly]);

  const handlePublish = useCallback(() => {
    if (readOnly) return;
    void persist({ ...draft, status: "published" });
  }, [draft, persist, readOnly]);

  const handleApprove = useCallback(() => {
    if (!canApproveReport || draft.status !== "published") return;
    void persist({ ...draft, status: "approved" });
  }, [canApproveReport, draft, persist]);

  const handlePdf = useCallback(() => {
    if (draft.status !== "published" && draft.status !== "approved") return;
    generateDailyFieldReportPdf({
      report: draft,
      companyName,
      companyLogoUrl,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      language,
      labels: tl,
      countryCode,
      timeZone,
    });
  }, [
    draft,
    companyName,
    companyLogoUrl,
    companyAddress,
    companyPhone,
    companyEmail,
    companyWebsite,
    language,
    tl,
    countryCode,
    timeZone,
  ]);

  const toggleMyTask = useCallback(
    async (taskId: string, completed: boolean) => {
      if (!supabase || draft.status !== "published") return;
      setBusy(true);
      const { error } = await patchTaskCompleted(supabase, taskId, completed);
      setBusy(false);
      if (error) {
        setErrMsg(error.message);
        return;
      }
      setDraft((d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
      }));
      onRefreshList?.();
    },
    [draft.status, onRefreshList]
  );

  const submitSignature = useCallback(
    async (method: "tap" | "drawing" | "tap_named", signatureData?: string | null) => {
      if (!supabase || draft.status !== "published") return;
      setBusy(true);
      setErrMsg(null);
      const id = crypto.randomUUID();
      const { error } = await insertSignature(supabase, {
        id,
        reportId: draft.id,
        employeeId: currentUserProfileId,
        method,
        signatureData: signatureData ?? null,
      });
      setBusy(false);
      if (error) {
        setErrMsg(error.message);
        return;
      }
      const row = {
        id,
        employeeId: currentUserProfileId,
        signedAt: new Date().toISOString(),
        method,
        signatureData: signatureData ?? null,
        employeeName: currentUserName,
      };
      setDraft((d) => ({ ...d, signatures: [...d.signatures, row] }));
      setSignModal("none");
      onRefreshList?.();
    },
    [currentUserName, currentUserProfileId, draft.id, draft.status, onRefreshList]
  );

  const startDraw = useCallback(() => {
    setSignModal("draw");
    requestAnimationFrame(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
    });
  }, []);

  const getCanvasData = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return null;
    try {
      return c.toDataURL("image/png");
    } catch {
      return null;
    }
  }, []);

  const statusBadge =
    draft.status === "draft"
      ? {
          text: tl.daily_report_status_draft ?? tl.reportStatusDraft ?? tl.formStatusDraft ?? "Draft",
          cls: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
        }
      : draft.status === "approved"
        ? {
            text: tl.daily_report_status_approved ?? tl.reportStatusApproved ?? "Approved",
            cls: "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200",
          }
        : {
            text: tl.daily_report_status_sent ?? tl.reportStatusPublished ?? "Sent",
            cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
          };

  const canShowSignModals =
    signModal !== "none" &&
    (isEmployeeView || (readOnly && canApproveReport && isSent && !isApproved && !alreadySigned));

  const signModals = canShowSignModals ? (
    <>
      {signModal === "pick" && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <h3 className="mb-3 font-semibold text-zinc-900 dark:text-white">{tl.signatureMethod ?? "Method"}</h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="min-h-[44px] rounded-xl border border-zinc-300 px-4 py-3 text-left text-sm dark:border-zinc-600"
                onClick={() => void submitSignature("tap")}
              >
                {tl.signTap ?? "Tap confirm"}
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-xl border border-zinc-300 px-4 py-3 text-left text-sm dark:border-zinc-600"
                onClick={startDraw}
              >
                {tl.signDraw ?? "Draw"}
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-xl border border-zinc-300 px-4 py-3 text-left text-sm dark:border-zinc-600"
                onClick={() => setSignModal("tap_named")}
              >
                {tl.signTapNamed ?? "Tap + name"}
              </button>
              <button
                type="button"
                className="mt-2 min-h-[44px] text-sm text-zinc-500"
                onClick={() => setSignModal("none")}
              >
                {tl.cancel ?? "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {signModal === "tap_named" && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <label className="block text-sm">
              <span className="text-zinc-500">{tl.preparedBy ?? "Name"}</span>
              <input
                value={tapNamedInput}
                onChange={(e) => setTapNamedInput(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-zinc-300 px-3 dark:border-zinc-600 dark:bg-slate-800"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="flex-1 min-h-[44px] rounded-xl bg-amber-600 py-3 text-sm font-medium text-white"
                onClick={() =>
                  void submitSignature("tap_named", JSON.stringify({ name: tapNamedInput || currentUserName }))
                }
              >
                {tl.common_confirm ?? "Confirm"}
              </button>
              <button type="button" className="min-h-[44px] px-4 text-sm" onClick={() => setSignModal("pick")}>
                {tl.back ?? "Back"}
              </button>
            </div>
          </div>
        </div>
      )}

      {signModal === "draw" && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <canvas
              ref={canvasRef}
              width={320}
              height={180}
              className="w-full touch-none rounded-lg border border-zinc-300 bg-white"
              onPointerDown={(e) => {
                drawing.current = true;
                const c = canvasRef.current;
                if (!c) return;
                const ctx = c.getContext("2d");
                if (!ctx) return;
                const r = c.getBoundingClientRect();
                ctx.beginPath();
                ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
              }}
              onPointerMove={(e) => {
                if (!drawing.current) return;
                const c = canvasRef.current;
                if (!c) return;
                const ctx = c.getContext("2d");
                if (!ctx) return;
                const r = c.getBoundingClientRect();
                ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
                ctx.stroke();
              }}
              onPointerUp={() => {
                drawing.current = false;
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-[44px] flex-1 rounded-xl bg-zinc-200 px-4 py-2 text-sm dark:bg-zinc-700"
                onClick={startDraw}
              >
                {tl.dailyReportClearCanvas ?? "Clear"}
              </button>
              <button
                type="button"
                className="min-h-[44px] flex-1 rounded-xl bg-amber-600 px-4 py-2 text-sm text-white"
                onClick={() => {
                  const data = getCanvasData();
                  if (data) void submitSignature("drawing", data);
                }}
              >
                <Check className="mr-1 inline h-4 w-4" />
                {tl.common_confirm ?? "OK"}
              </button>
              <button type="button" className="min-h-[44px] px-4 text-sm" onClick={() => setSignModal("pick")}>
                {tl.back ?? "Back"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  ) : null;

  if (isEmployeeView) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 flex min-h-[44px] items-center gap-1 text-sm text-amber-600 dark:text-amber-400"
          >
            ← {tl.back ?? tl.nav_back ?? "Back"}
          </button>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {tl.dailyReport ?? tl.dailyFieldReport ?? "Daily report"}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {projectName} · {formatReportDate(draft.date, language, countryCode, timeZone)}
          </p>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-28">
          {errMsg && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {errMsg}
            </p>
          )}
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-slate-900">
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-white">
              {tl.daily_report_summary ?? "Day summary"}
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-zinc-50 px-2 py-3 dark:bg-slate-800/80">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {tl.daily_report_metric_hours ?? tl.dailyReportHours ?? "Hours"}
                </p>
                <p className="mt-1 font-semibold text-zinc-900 dark:text-white">{daySummaryHoursLabel}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-2 py-3 dark:bg-slate-800/80">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {tl.daily_report_metric_present ?? tl.attendance ?? "Present"}
                </p>
                <p className="mt-1 font-semibold text-zinc-900 dark:text-white">{daySummaryPresent}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-2 py-3 dark:bg-slate-800/80">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {tl.daily_report_metric_tasks ?? tl.dailyTasks ?? "Tasks"}
                </p>
                <p className="mt-1 font-semibold text-zinc-900 dark:text-white">{daySummaryTasksDone}</p>
              </div>
            </div>
          </section>
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-slate-900">
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-white">{tl.dailyTasks ?? "Tasks"}</h2>
            {myTasks.length === 0 ? (
              <p className="text-sm text-zinc-500">{tl.dailyReportNoTasksForYou ?? "—"}</p>
            ) : (
              <ul className="space-y-2">
                {myTasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 p-3 dark:border-zinc-700"
                  >
                    <span className="text-sm text-zinc-800 dark:text-zinc-200">{t.description || "—"}</span>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={t.completed}
                        disabled={busy || draft.status !== "published"}
                        onChange={(e) => void toggleMyTask(t.id, e.target.checked)}
                        className="h-5 w-5"
                      />
                      {tl.dailyReportMarkDone ?? "Done"}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-slate-900">
            {alreadySigned ? (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {tl.signed ?? "Signed"} ·{" "}
                {formatReportDateTime(
                  draft.signatures.find((s) => s.employeeId === currentUserProfileId)?.signedAt ?? "",
                  language,
                  countryCode,
                  timeZone
                )}
              </p>
            ) : (
              <button
                type="button"
                disabled={busy || draft.status !== "published"}
                onClick={() => setSignModal("pick")}
                className="min-h-[44px] rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {tl.daily_report_sign ?? tl.signReport ?? "Sign report"}
              </button>
            )}
          </section>
        </div>
        {signModals}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex min-h-[44px] items-center gap-1 text-sm text-amber-600 dark:text-amber-400"
        >
          ← {tl.back ?? tl.nav_back ?? "Back"}
        </button>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {tl.dailyReport ?? tl.dailyFieldReport ?? "Daily report"} — {projectName}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{companyName}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge.cls}`}>{statusBadge.text}</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{tl.checklistDate ?? tl.date ?? "Date"}</span>
            <input
              type="date"
              value={draft.date}
              readOnly={readOnly}
              onChange={(e) => !readOnly && updateDraft({ date: e.target.value })}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-zinc-600 dark:bg-slate-800"
            />
          </label>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-slate-800/50">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{tl.preparedBy ?? "Prepared by"}</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">{draft.createdByName || currentUserName}</p>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-700 dark:bg-slate-800/50">
          <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {tl.daily_report_summary ?? "Day summary"}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {tl.daily_report_metric_hours ?? tl.dailyReportHours ?? "Hours"}
              </p>
              <p className="font-semibold text-zinc-900 dark:text-white">{daySummaryHoursLabel}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {tl.daily_report_metric_present ?? tl.attendance ?? "Present"}
              </p>
              <p className="font-semibold text-zinc-900 dark:text-white">{daySummaryPresent}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {tl.daily_report_metric_tasks ?? tl.dailyTasks ?? "Tasks"}
              </p>
              <p className="font-semibold text-zinc-900 dark:text-white">{daySummaryTasksDone}</p>
            </div>
          </div>
        </div>
      </header>

      {errMsg && (
        <div className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {errMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-36">
        {/* Cabecera */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setHeaderOpen((o) => !o)}
            className="flex w-full min-h-[44px] items-center justify-between px-4 py-3 text-left font-medium text-zinc-900 dark:text-white"
          >
            {tl.dailyReportSectionHeader ?? tl.siteConditions ?? "Header"}
            {headerOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          {headerOpen && (
            <div className="space-y-4 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
              <div>
                <p className="mb-2 text-xs text-zinc-500">{tl.weatherSection ?? "Weather"}</p>
                <div className="flex flex-wrap gap-2">
                  {WEATHER_OPTIONS.map(({ value, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      disabled={readOnly}
                      onClick={() => updateDraft({ weather: value })}
                      className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-xl border-2 px-3 py-2 sm:min-w-[96px] ${
                        draft.weather === value
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40"
                          : "border-zinc-200 dark:border-zinc-600"
                      }`}
                    >
                      <Icon className="h-6 w-6" aria-hidden />
                      <span className="mt-1 text-center text-xs">{weatherLabel(value, tl)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{tl.siteConditions ?? "Site"}</span>
                <textarea
                  value={draft.siteConditions}
                  readOnly={readOnly}
                  onChange={(e) => updateDraft({ siteConditions: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-800"
                />
              </label>
            </div>
          )}
        </section>

        {/* Briefing */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setBriefingOpen((o) => !o)}
            className="flex w-full min-h-[44px] items-center justify-between px-4 py-3 text-left font-medium text-zinc-900 dark:text-white"
          >
            {tl.securityBriefing ?? "Safety"}
            {briefingOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          {briefingOpen && (
            <div className="space-y-4 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {tl.dailyReportPpeGlobal ?? "PPE (site)"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {DAILY_REPORT_PPE_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 dark:border-zinc-600"
                    >
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={draft.ppeSelected.includes(key)}
                        onChange={() => togglePpe(key)}
                        className="h-5 w-5"
                      />
                      <span className="text-sm">{ppeLabel(key, tl)}</span>
                    </label>
                  ))}
                </div>
                <label className="mt-3 block text-sm">
                  <span className="text-xs text-zinc-500">{tl.ppeOther ?? "Other PPE"}</span>
                  <input
                    value={draft.ppeOther}
                    readOnly={readOnly}
                    onChange={(e) => updateDraft({ ppeOther: e.target.value })}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-zinc-300 px-3 dark:border-zinc-600 dark:bg-slate-800"
                  />
                </label>
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{tl.dailyReportHazardsList ?? "Hazards"}</p>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={addHazard}
                      className="flex min-h-[44px] items-center gap-1 rounded-lg border border-amber-500 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                    >
                      <Plus className="h-4 w-4" /> {tl.add ?? "Add"}
                    </button>
                  )}
                </div>
                <ul className="space-y-3">
                  {draft.hazards.map((h) => (
                    <li key={h.id} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-700">
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={h.description}
                          readOnly={readOnly}
                          onChange={(e) => updateHazard(h.id, { description: e.target.value })}
                          placeholder={tl.description ?? ""}
                          className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 px-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
                        />
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => removeHazard(h.id)}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-red-500"
                            aria-label={tl.common_delete ?? "Delete"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {DAILY_REPORT_PPE_KEYS.map((key) => (
                          <label key={key} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              disabled={readOnly}
                              checked={h.ppeRequired.includes(key)}
                              onChange={() => toggleHazardPpe(h.id, key)}
                              className="h-4 w-4"
                            />
                            {ppeLabel(key, tl)}
                          </label>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* Tareas */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setTasksOpen((o) => !o)}
            className="flex w-full min-h-[44px] items-center justify-between px-4 py-3 text-left font-medium text-zinc-900 dark:text-white"
          >
            {tl.dailyTasks ?? "Tasks"}
            {tasksOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          {tasksOpen && (
            <div className="border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
              {!readOnly && (
                <button
                  type="button"
                  onClick={addTask}
                  className="mb-3 flex min-h-[44px] items-center gap-1 rounded-lg border border-amber-500 px-3 py-2 text-sm"
                >
                  <Plus className="h-4 w-4" /> {tl.add ?? "Add"}
                </button>
              )}
              <ul className="space-y-2">
                {draft.tasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-col gap-2 rounded-lg border border-zinc-100 p-3 sm:flex-row sm:items-center dark:border-zinc-700"
                  >
                    <input
                      value={t.description}
                      readOnly={readOnly}
                      onChange={(e) => updateTask(t.id, { description: e.target.value })}
                      className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 px-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
                      placeholder={tl.description ?? ""}
                    />
                    <select
                      value={t.employeeId ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateTask(t.id, { employeeId: e.target.value || null })}
                      className="min-h-[44px] rounded-lg border border-zinc-300 px-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
                    >
                      <option value="">{tl.selectEmployee ?? "—"}</option>
                      {projectAssignees.map((a) => (
                        <option key={a.profileId} value={a.profileId}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeTask(t.id)}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {readOnly && (
                      <label className="flex min-h-[44px] items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <input type="checkbox" checked={t.completed} readOnly disabled className="h-5 w-5" />
                        {tl.dailyReportDone ?? "Done"}
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Asistencia */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setAttOpen((o) => !o)}
            className="flex w-full min-h-[44px] items-center justify-between px-4 py-3 text-left font-medium text-zinc-900 dark:text-white"
          >
            {tl.attendance ?? "Attendance"}
            {attOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          {attOpen && (
            <div className="border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
              <ul className="space-y-2">
                {draft.attendance.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-slate-800/60"
                  >
                    <span className="text-sm font-medium">
                      {a.employeeName ?? projectAssignees.find((x) => x.profileId === a.employeeId)?.name ?? "—"}
                      {a.fromTimeclock ? (
                        <span className="ml-2 text-xs text-emerald-600">{tl.dailyReportFromTimeclock ?? ""}</span>
                      ) : null}
                    </span>
                    <select
                      value={a.status}
                      disabled={readOnly}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          attendance: d.attendance.map((x) =>
                            x.id === a.id
                              ? {
                                  ...x,
                                  status: e.target.value as "present" | "absent" | "late",
                                }
                              : x
                          ),
                        }))
                      }
                      className="min-h-[44px] rounded-lg border border-zinc-300 px-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
                    >
                      <option value="present">
                        {(tl as Record<string, string>).present ?? tl.attendancePresent ?? "Present"}
                      </option>
                      <option value="absent">
                        {(tl as Record<string, string>).absent ?? tl.attendanceAbsent ?? "Absent"}
                      </option>
                      <option value="late">{tl.attendanceLate ?? "Late"}</option>
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Notas */}
        <section className="mb-6 space-y-2">
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {tl.generalNotes ?? "Notes"}
          </label>
          <textarea
            value={draft.notes}
            readOnly={readOnly}
            onChange={(e) => updateDraft({ notes: e.target.value })}
            rows={4}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-900"
          />
        </section>

        {/* Fotos */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setPhotosOpen((o) => !o)}
            className="flex w-full min-h-[44px] items-center justify-between px-4 py-3 text-left font-medium text-zinc-900 dark:text-white"
          >
            {tl.dailyReportPhotos ?? "Photos"}
            {photosOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          {photosOpen && (
            <div className="border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
              {!readOnly && draft.photos.length < 10 && (
                <label className="mb-3 flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 px-4 dark:border-zinc-600">
                  <span className="text-sm">{tl.dailyReportAddPhoto ?? "Add photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadPhoto(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {draft.photos.map((p) => (
                  <div key={p.id} className="relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="h-28 w-full object-cover" loading="lazy" />
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({ ...d, photos: d.photos.filter((x) => x.id !== p.id) }))
                        }
                        className="absolute right-1 top-1 rounded bg-red-600 px-2 py-1 text-xs text-white"
                      >
                        {tl.common_delete ?? "×"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Firmas lectura + firma supervisor (móvil) */}
        {(draft.status === "published" || draft.status === "approved") && (
          <section className="mb-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setSigOpen((o) => !o)}
              className="flex w-full min-h-[44px] items-center justify-between px-4 py-3 text-left font-medium text-zinc-900 dark:text-white"
            >
              {tl.dailyReportSignaturesList ?? "Signatures"}
              {sigOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {sigOpen && (
              <div className="space-y-3 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                {readOnly &&
                  canApproveReport &&
                  draft.status === "published" &&
                  !alreadySigned && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setSignModal("pick")}
                      className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                    >
                      <PenLine className="h-4 w-4 shrink-0" />
                      {tl.daily_report_sign ?? tl.signReport ?? "Sign report"}
                    </button>
                  )}
                <ul>
                  {draft.signatures.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap justify-between gap-2 border-b border-zinc-50 py-2 text-sm dark:border-zinc-800"
                    >
                      <span>
                        {s.employeeName ?? "—"}{" "}
                        {s.method === "tap_named" && s.signatureData
                          ? ` (${(() => {
                              try {
                                const j = JSON.parse(s.signatureData!) as { name?: string };
                                return j.name ?? "";
                              } catch {
                                return "";
                              }
                            })()})`
                          : ""}
                      </span>
                      <span className="text-zinc-500">
                        {formatReportDateTime(s.signedAt, language, countryCode, timeZone)}
                      </span>
                    </li>
                  ))}
                  {draft.signatures.length === 0 && (
                    <li className="text-sm text-zinc-500">{tl.dailyReportNoSignaturesYet ?? "—"}</li>
                  )}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>

      {!readOnly && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-slate-900/95 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveDraft}
              className="min-h-[44px] flex-1 rounded-xl border-2 border-zinc-300 px-4 py-3 text-sm font-medium dark:border-zinc-600"
            >
              {tl.saveDraft ?? "Save draft"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handlePublish}
              className="min-h-[44px] flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500"
            >
              {tl.publishReport ?? "Publish"}
            </button>
          </div>
        </div>
      )}

      {readOnly && (draft.status === "published" || draft.status === "approved") && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-slate-900/95 sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:justify-end">
            {canApproveReport && draft.status === "published" && (
              <button
                type="button"
                disabled={busy}
                onClick={handleApprove}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {tl.daily_report_approve ?? "Approve report"}
              </button>
            )}
            <button
              type="button"
              onClick={handlePdf}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-medium text-white"
            >
              <FileDown className="h-4 w-4" />
              {tl.exportPdf ?? tl.printReport ?? "PDF"}
            </button>
          </div>
        </div>
      )}
      {signModals}
    </div>
  );
}
