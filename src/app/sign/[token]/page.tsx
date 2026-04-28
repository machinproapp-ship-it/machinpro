"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import type { FormInstance, FormTemplate } from "@/types/forms";
import {
  getSignPageLocale,
  getSignPageTranslations,
  type SignPageLocale,
} from "@/lib/signPageTranslations";
import { ALL_TRANSLATIONS } from "@/lib/i18n";
import {
  resolveFormLabel,
  resolveTemplateName,
  formatFormFieldValue,
} from "@/lib/formTemplateDisplay";
import Link from "next/link";

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
      <button
        type="button"
        onClick={onClear}
        className="mt-2 text-sm text-zinc-500 hover:text-zinc-700 min-h-[44px] px-1"
      >
        {clearLabel}
      </button>
    </div>
  );
}

export default function SignPage() {
  const params = useParams();
  const router = useRouter();
  const token = (params?.token as string) ?? "";
  const [instance, setInstance] = useState<FormInstance | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [docNumber, setDocNumber] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyAddress, setCompanyAddress] = useState<string | null>(null);
  const [companyPhone, setCompanyPhone] = useState<string | null>(null);
  const [companyEmail, setCompanyEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [orientationGiven, setOrientationGiven] = useState<"yes" | "na">("na");
  const [signature, setSignature] = useState("");
  const [signed, setSigned] = useState(false);
  const [signStatus, setSignStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [signError, setSignError] = useState("");
  const [locale, setLocale] = useState<SignPageLocale>("es");

  const t = getSignPageTranslations(locale);
  const formLabels = {
    ...ALL_TRANSLATIONS.en,
    ...(ALL_TRANSLATIONS[locale] ?? {}),
  } as Record<string, string>;
  const L = (k: string) => formLabels[k] ?? k;

  useEffect(() => {
    setLocale(getSignPageLocale());
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/forms/external/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        if (data.error === "expired") setExpired(true);
        else if (data.error === "not_found") setNotFound(true);
        else if (data.instance && data.template) {
          setInstance(data.instance as FormInstance);
          setTemplate(data.template as FormTemplate);
          setCompanyName(typeof data.companyName === "string" ? data.companyName : "");
          setCompanyLogoUrl(typeof data.companyLogoUrl === "string" ? data.companyLogoUrl : null);
          setCompanyAddress(typeof data.companyAddress === "string" ? data.companyAddress : null);
          setCompanyPhone(typeof data.companyPhone === "string" ? data.companyPhone : null);
          setCompanyEmail(typeof data.companyEmail === "string" ? data.companyEmail : null);
          setDocNumber(data.docNumber != null ? String(data.docNumber) : null);
        } else setLoadError(true);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [token]);

  const clearSignature = useCallback(() => {
    setSignature("");
  }, []);

  const handleSign = async () => {
    if (!instance || !signature.trim() || !name.trim()) return;
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
      const res = await fetch(`/api/forms/external/${encodeURIComponent(token)}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim() || undefined,
          email: email.trim() || undefined,
          signature,
          orientationGiven: orientationGiven === "yes",
        }),
      });
      if (!res.ok) throw new Error("sign_failed");
      setSigned(true);
      setSignStatus("success");
    } catch {
      setSignStatus("error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-slate-900 px-4">
        <p className="text-zinc-500 animate-pulse text-center">{L("sign_external_loading")}</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 max-w-md text-center">
          <p className="text-zinc-700 dark:text-zinc-200 font-medium">{L("sign_external_not_found")}</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-4 min-h-[44px] rounded-xl bg-zinc-200 dark:bg-zinc-700 px-4 py-2 text-sm font-medium w-full sm:w-auto"
          >
            {t.back}
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <p className="text-red-600 dark:text-red-400">{L("sign_external_not_found")}</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 max-w-md text-center">
          <p className="text-red-600 dark:text-red-400 font-medium">{L("sign_external_expired")}</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-4 min-h-[44px] rounded-xl bg-zinc-200 dark:bg-zinc-700 px-4 py-2 text-sm font-medium w-full sm:w-auto"
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
        <p className="text-zinc-500">{L("sign_external_loading")}</p>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 max-w-md text-center">
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-lg">
            {L("sign_external_signed_success")}
          </p>
        </div>
      </div>
    );
  }

  const projectLabel =
    instance.contextName ?? instance.projectId ?? (instance.contextId ?? "—");
  const supervisorName = (() => {
    const v = instance.fieldValues["f3"];
    return v ? String(v) : null;
  })();

  const matchedAttendee = instance.attendees.find(
    (a) => a.name.toLowerCase() === name.trim().toLowerCase()
  );
  const isInternal = !!matchedAttendee?.employeeId;
  const companyRequired = !isInternal;

  const displayTitle = resolveTemplateName(template, formLabels);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-slate-900 py-6 sm:py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6 pb-16">
        <header className="rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              {companyLogoUrl ? (
                <img
                  src={companyLogoUrl}
                  alt=""
                  className="max-h-14 w-auto object-contain mb-3"
                />
              ) : null}
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                {companyName}
                <span className="text-zinc-400 dark:text-zinc-500"> · MachinPro</span>
              </p>
              {companyAddress ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 whitespace-pre-wrap">
                  {companyAddress}
                </p>
              ) : null}
              <div className="flex flex-col gap-0.5 mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                {companyPhone ? <span>{companyPhone}</span> : null}
                {companyEmail ? <span>{companyEmail}</span> : null}
              </div>
            </div>
            {docNumber ? (
              <div className="shrink-0 text-right">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {L("forms_pdf_doc_number")}
                </span>
                <p className="text-lg font-bold text-zinc-900 dark:text-white tabular-nums">{docNumber}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-slate-800">
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white leading-snug">
              {displayTitle}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {t.project}: {projectLabel} · {t.date}: {instance.date}
            </p>
            {supervisorName ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t.supervisor}: {supervisorName}
              </p>
            ) : null}
          </div>
        </header>

        <div className="rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
          {template.sections.slice(0, 2).map((section) => (
            <div key={section.id}>
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                {resolveFormLabel(section.title, formLabels)}
              </h3>
              <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                {section.fields.map((field) => {
                  if (field.type === "signature" || field.type === "attendance") return null;
                  const val = instance.fieldValues[field.id];
                  if (val == null || val === "") return null;
                  if (
                    field.type === "photo" &&
                    typeof val === "string" &&
                    val.startsWith("http")
                  ) {
                    return (
                      <p key={field.id}>
                        <span className="font-medium">
                          {resolveFormLabel(field.label, formLabels)}:
                        </span>{" "}
                        <a
                          href={val}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-600 dark:text-amber-400 underline break-all"
                        >
                          {L("forms_view")}
                        </a>
                      </p>
                    );
                  }
                  const text = formatFormFieldValue(field, val, L);
                  return (
                    <p key={field.id} className="whitespace-pre-wrap">
                      <span className="font-medium">
                        {resolveFormLabel(field.label, formLabels)}:
                      </span>{" "}
                      {text}
                    </p>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
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
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {companyRequired ? t.companyRequired : t.companyOptional}
              {companyRequired && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required={companyRequired}
              placeholder={companyRequired ? t.companyRequired : t.companyOptional}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {L("forms_email_field_placeholder")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={L("forms_external_email_placeholder")}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t.orientationLabel}
            </label>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input
                  type="radio"
                  name="orientation"
                  checked={orientationGiven === "yes"}
                  onChange={() => setOrientationGiven("yes")}
                  className="text-amber-600 w-5 h-5"
                />
                <span className="text-sm">{t.yes}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input
                  type="radio"
                  name="orientation"
                  checked={orientationGiven === "na"}
                  onChange={() => setOrientationGiven("na")}
                  className="text-amber-600 w-5 h-5"
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
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">{signError}</p>
          )}

          <button
            type="button"
            disabled={
              signStatus === "loading" ||
              signStatus === "success" ||
              !name.trim() ||
              !signature
            }
            onClick={() => void handleSign()}
            className={`w-full py-4 rounded-2xl font-semibold text-white transition-colors min-h-[44px] ${
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

        <footer className="text-center text-xs text-zinc-500 dark:text-zinc-400 pt-2">
          <Link href="https://machin.pro" className="hover:text-amber-600 dark:hover:text-amber-400 underline-offset-2">
            {L("sign_external_powered_by")}
          </Link>
        </footer>
      </div>
    </div>
  );
}
