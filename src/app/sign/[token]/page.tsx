"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import type { FormInstance, FormTemplate, AttendeeRecord } from "@/types/forms";
import { INITIAL_FORM_TEMPLATES } from "@/lib/formTemplates";
import {
  getSignPageLocale,
  getSignPageTranslations,
  type SignPageLocale,
} from "@/lib/signPageTranslations";

function SignatureCanvas({
  onChange,
  onClear,
  label,
  clearLabel = "Limpiar",
}: {
  onChange: (base64: string) => void;
  onClear: () => void;
  label: string;
  clearLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  const getPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const can = canvasRef.current;
      if (!can) return { x: 0, y: 0 };
      const rect = can.getBoundingClientRect();
      const scaleX = can.width / rect.width;
      const scaleY = can.height / rect.height;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    },
    []
  );

  const start = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    setDrawing(false);
    const can = canvasRef.current;
    if (!can) return;
    onChange(can.toDataURL("image/png"));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        {label}
      </label>
      <canvas
        ref={canvasRef}
        width={400}
        height={120}
        className="border border-zinc-300 dark:border-zinc-600 rounded-lg w-full touch-none bg-white dark:bg-slate-800"
        style={{ maxWidth: "100%", height: "auto" }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <button type="button" onClick={onClear} className="mt-2 text-sm text-zinc-500 hover:text-zinc-700">
        {clearLabel}
      </button>
    </div>
  );
}

export default function SignPage() {
  const params = useParams();
  const router = useRouter();
  const token = (params?.token as string) ?? "";
  const [instances, setInstances] = useState<FormInstance[]>([]);
  const [instance, setInstance] = useState<FormInstance | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [orientationGiven, setOrientationGiven] = useState<"yes" | "na">("na");
  const [signature, setSignature] = useState("");
  const [signed, setSigned] = useState(false);
  const [signStatus, setSignStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [signError, setSignError] = useState("");
  const [locale, setLocale] = useState<SignPageLocale>("es");

  const t = getSignPageTranslations(locale);

  useEffect(() => {
    setLocale(getSignPageLocale());
  }, []);

  useEffect(() => {
    if (!token) {
      setExpired(true);
      setLoading(false);
      return;
    }
    try {
      const raw = localStorage.getItem("machinpro_form_instances");
      const parsed = raw ? JSON.parse(raw) : [];
      const instancesList = Array.isArray(parsed) ? (parsed as FormInstance[]) : [];
      setInstances(instancesList);

      const found = instancesList.find((i) => i.signToken === token);
      if (!found) {
        setExpired(true);
        setLoading(false);
        return;
      }
      if (new Date(found.tokenExpiresAt) < new Date()) {
        setExpired(true);
        setLoading(false);
        return;
      }

      const tplRaw = localStorage.getItem("machinpro_formTemplates");
      const saved = tplRaw ? (JSON.parse(tplRaw) as FormTemplate[]) : [];
      const customTemplates = Array.isArray(saved) ? saved.filter((t) => !t.isBase) : [];
      const templates = [...INITIAL_FORM_TEMPLATES, ...customTemplates];
      const tpl = templates.find((t) => t.id === found.templateId) ?? null;

      setInstance(found);
      setTemplate(tpl);
    } catch {
      setExpired(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const clearSignature = useCallback(() => {
    setSignature("");
  }, []);

  const handleSign = () => {
    if (!instance || !signature.trim()) return;
    const matchedAttendee = instance.attendees.find(
      (a) => a.name.toLowerCase() === name.trim().toLowerCase()
    );
    const isInternal = !!matchedAttendee?.employeeId;
    const companyRequired = !isInternal;
    setSignError("");
    if (companyRequired && !company.trim()) {
      setSignError(t.companyRequiredError);
      return;
    }
    setSignStatus("loading");
    try {
      const attId = instance.attendees.find(
        (a) =>
          a.name.toLowerCase() === name.trim().toLowerCase() &&
          (company ? a.company === company : true)
      )?.id;
      let newAttendees: AttendeeRecord[];
      if (attId) {
        newAttendees = instance.attendees.map((a) =>
          a.id === attId
            ? {
                ...a,
                signedAt: new Date().toISOString(),
                signature,
                orientationGiven: orientationGiven === "yes",
              }
            : a
        );
      } else {
        const newAtt: AttendeeRecord = {
          id: `att-ext-${Date.now()}`,
          name: name.trim(),
          company: company.trim() || undefined,
          isExternal: true,
          signedAt: new Date().toISOString(),
          signature,
          orientationGiven: orientationGiven === "yes",
        };
        newAttendees = [...instance.attendees, newAtt];
      }
      const updated: FormInstance = { ...instance, attendees: newAttendees };
      const nextList = instances.map((i) =>
        i.id === instance.id ? updated : i
      );
      setInstances(nextList);
      try {
        localStorage.setItem(
          "machinpro_form_instances",
          JSON.stringify(nextList)
        );
      } catch {}
      setSigned(true);
      setSignStatus("success");
    } catch {
      setSignStatus("error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-slate-900">
        <p className="text-zinc-500 animate-pulse">{t.loading}</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 max-w-md text-center">
          <p className="text-red-600 dark:text-red-400 font-medium">
            {t.linkExpired}
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-4 rounded-xl bg-zinc-200 dark:bg-zinc-700 px-4 py-2 text-sm font-medium"
          >
            {t.back}
          </button>
        </div>
      </div>
    );
  }

  if (!instance || !template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-slate-900">
        <p className="text-zinc-500">{t.loading}</p>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 max-w-md text-center">
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-lg">
            {t.signatureConfirmed}
          </p>
        </div>
      </div>
    );
  }

  const projectName = instance.projectId;
  const supervisorName = (() => {
    const v = instance.fieldValues["f3"];
    return v ? String(v) : null;
  })();
  const matchedAttendee = instance.attendees.find(
    (a) => a.name.toLowerCase() === name.trim().toLowerCase()
  );
  const isInternal = !!matchedAttendee?.employeeId;
  const companyRequired = !isInternal;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-slate-900 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center py-6 border-b border-zinc-200 dark:border-slate-700">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            Machinpro
          </h1>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mt-1">
            {template.name}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {t.project}: {projectName} · {t.date}: {instance.date}
          </p>
          {supervisorName && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t.supervisor}: {supervisorName}
            </p>
          )}
        </header>

        <div className="rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
          {template.sections.slice(0, 2).map((section) => (
            <div key={section.id}>
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                {section.title}
              </h3>
              <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                {section.fields.map((field) => {
                  if (field.type === "signature" || field.type === "attendance") return null;
                  const val = instance.fieldValues[field.id];
                  if (val == null) return null;
                  const text = Array.isArray(val) ? val.join(", ") : String(val);
                  return (
                    <p key={field.id}>
                      <span className="font-medium">{field.label}:</span> {text}
                    </p>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
            {t.signAndAttendance}
          </h3>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t.fullName} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
              placeholder={t.fullName}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {companyRequired ? t.companyRequired : t.companyOptional}
              {companyRequired && (
                <span className="text-red-500 ml-0.5">*</span>
              )}
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required={companyRequired}
              placeholder={
                companyRequired ? t.companyRequired : t.companyOptional
              }
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t.orientationLabel}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="orientation"
                  checked={orientationGiven === "yes"}
                  onChange={() => setOrientationGiven("yes")}
                  className="text-amber-600"
                />
                <span className="text-sm">{t.yes}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="orientation"
                  checked={orientationGiven === "na"}
                  onChange={() => setOrientationGiven("na")}
                  className="text-amber-600"
                />
                <span className="text-sm">{t.na}</span>
              </label>
            </div>
          </div>

          <SignatureCanvas
            label={t.signature}
            onChange={setSignature}
            onClear={clearSignature}
            clearLabel={t.clear}
          />

          {signError && (
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">
              {signError}
            </p>
          )}

          <button
            type="button"
            disabled={
              signStatus === "loading" ||
              signStatus === "success" ||
              !name.trim() ||
              !signature
            }
            onClick={handleSign}
            className={`w-full py-4 rounded-2xl font-semibold text-white transition-colors min-h-[56px] ${
              signStatus === "success"
                ? "bg-emerald-600 cursor-default"
                : signStatus === "error"
                  ? "bg-red-500 hover:bg-red-400"
                  : signStatus === "loading"
                    ? "bg-amber-400 cursor-wait"
                    : "bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
            }`}
          >
            {signStatus === "loading" && t.signButtonLoading}
            {signStatus === "success" && t.signButtonSuccess}
            {signStatus === "error" && t.signButtonError}
            {signStatus === "idle" && t.signButtonIdle}
          </button>
        </div>
      </div>
    </div>
  );
}
