"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, ShieldCheck, Trash2, X } from "lucide-react";
import {
  checklistLabel,
  getPosition,
  insertInspection,
  queueInspection,
  regulationRefFor,
  sha256Hex,
  templateLabel,
  uploadInspectionImage,
  type ChecklistAnswer,
  type ChecklistAnswerStatus,
  type EquipmentInspection,
  type InspectionItemKind,
  type InspectionResult,
  type InspectionTemplate,
} from "@/lib/inspections";

export type InspectableItemRef = {
  kind: InspectionItemKind;
  id: string;
  label: string;
  serial?: string | null;
  projectId?: string | null;
  templateId?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  item: InspectableItemRef | null;
  templates: InspectionTemplate[];
  labels: Record<string, string>;
  countryCode?: string | null;
  locale?: string | null;
  /** Corrección: la inspección nueva apunta a la original, que queda intacta. */
  supersedes?: EquipmentInspection | null;
  onSaved: (saved: EquipmentInspection | null, queued: boolean) => void;
};

type Photo = { blob: Blob; url: string; hash: string };

const MAX_PHOTO_SIDE = 1920;

/** Reduce la foto antes de subirla (la huella se calcula sobre lo que se sube). */
async function downscale(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bmp.width, bmp.height));
    if (scale >= 1 && file.size < 2_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return out ?? file;
  } catch {
    return file;
  }
}

function isTouchDevice(): boolean {
  return typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
}

export function EquipmentInspectionFlow({
  open,
  onClose,
  companyId,
  item,
  templates,
  labels: t,
  countryCode,
  locale,
  supersedes,
  onSaved,
}: Props) {
  const [templateId, setTemplateId] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswer>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [result, setResult] = useState<InspectionResult | "">("");
  const [defects, setDefects] = useState("");
  const [notes, setNotes] = useState("");
  const [declared, setDeclared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ saved: EquipmentInspection | null; queued: boolean } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const sigRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const template = useMemo(() => templates.find((x) => x.id === templateId) ?? null, [templates, templateId]);

  useEffect(() => {
    if (!open || !item) return;
    const preferred =
      (item.templateId && templates.find((x) => x.id === item.templateId)?.id) ||
      (supersedes?.templateId && templates.find((x) => x.id === supersedes.templateId)?.id) ||
      templates.find((x) => x.itemCategory === "other" && x.isBase)?.id ||
      templates[0]?.id ||
      "";
    setTemplateId(preferred);
    setAnswers({});
    setPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    setResult("");
    setDefects("");
    setNotes(supersedes ? `${t.inspectionCorrectionOf ?? "Corrección de la inspección"} ${supersedes.contentHash.slice(0, 12)}` : "");
    setDeclared(false);
    setError(null);
    setDone(null);
    setHasSignature(false);
  }, [open, item, templates, supersedes, t.inspectionCorrectionOf]);

  const defectCount = Object.values(answers).filter((a) => a.status === "defect").length;
  useEffect(() => {
    if (defectCount > 0 && result === "pass") setResult("fail");
  }, [defectCount, result]);

  if (!open || !item) return null;

  const checklist = template?.checklist ?? [];
  const minPhotos = template?.requiresPhoto ? Math.max(1, template.minPhotos) : 0;
  const allAnswered = checklist.every((c) => answers[c.id]);
  const needsDefectText = result === "fail" || defectCount > 0;
  const canSubmit =
    !!template &&
    allAnswered &&
    photos.length >= minPhotos &&
    !!result &&
    declared &&
    (!needsDefectText || defects.trim().length > 0) &&
    !busy;
  const regRef = regulationRefFor(template?.regulationRefs, countryCode);
  const declarationText =
    t.inspectionDeclaration ??
    "Declaro que he inspeccionado personalmente este equipo antes de usarlo y que la información y las fotos son reales.";

  function setAnswer(id: string, status: ChecklistAnswerStatus) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], status } }));
  }
  function setAnswerNote(id: string, note: string) {
    setAnswers((prev) => ({ ...prev, [id]: { status: prev[id]?.status ?? "ok", note } }));
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: Photo[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      const blob = await downscale(f);
      next.push({ blob, url: URL.createObjectURL(blob), hash: await sha256Hex(blob) });
    }
    setPhotos((prev) => [...prev, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePhoto(i: number) {
    setPhotos((prev) => {
      const p = prev[i];
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter((_, j) => j !== i);
    });
  }

  // ── firma táctil opcional ──
  function sigPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = sigRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }
  function sigDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = sigRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const p = sigPoint(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    sigRef.current?.setPointerCapture(e.pointerId);
  }
  function sigMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = sigRef.current?.getContext("2d");
    if (!ctx) return;
    const p = sigPoint(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasSignature(true);
  }
  function sigUp() {
    drawing.current = false;
  }
  function sigClear() {
    const c = sigRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setHasSignature(false);
  }
  async function signatureBlob(): Promise<Blob | null> {
    if (!hasSignature || !sigRef.current) return null;
    return new Promise((r) => sigRef.current!.toBlob((b) => r(b), "image/png"));
  }

  async function submit() {
    if (!canSubmit || !template || !item || !result) return;
    setBusy(true);
    setError(null);
    const pos = await getPosition();
    const base = {
      companyId,
      itemKind: item.kind,
      itemId: item.id,
      projectId: item.projectId ?? null,
      templateId: template.id,
      answers,
      result,
      defects: needsDefectText ? defects.trim() : defects.trim() || null,
      notes: notes.trim() || null,
      declarationText,
      gpsLat: pos?.coords.latitude ?? null,
      gpsLng: pos?.coords.longitude ?? null,
      gpsAccuracy: pos?.coords.accuracy ?? null,
      deviceInfo: (typeof navigator !== "undefined" ? navigator.userAgent : "").slice(0, 500) + (isTouchDevice() ? "" : " [desktop]"),
      locale: locale ?? null,
      countryCode: countryCode ?? null,
      clientRecordedAt: new Date().toISOString(),
      supersedesId: supersedes?.id ?? null,
    };
    const sig = await signatureBlob();
    const queue = async (why?: string) => {
      await queueInspection({
        localId: crypto.randomUUID(),
        input: base,
        photos: photos.map((p) => p.blob),
        photoHashes: photos.map((p) => p.hash),
        signature: sig,
        createdAt: base.clientRecordedAt,
        lastError: why,
      });
      setDone({ saved: null, queued: true });
      onSaved(null, true);
    };
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        await queue("offline");
        return;
      }
      let photoUrls: string[];
      let signatureUrl: string | null = null;
      try {
        photoUrls = [];
        for (let i = 0; i < photos.length; i++) {
          photoUrls.push(await uploadInspectionImage(photos[i].blob, companyId, `inspection-${i + 1}.jpg`));
        }
        if (sig) signatureUrl = await uploadInspectionImage(sig, companyId, "signature.png");
      } catch (e) {
        // Fallo de red al subir fotos: se guarda en el dispositivo y se envía al volver la conexión.
        await queue(e instanceof Error ? e.message : String(e));
        return;
      }
      const saved = await insertInspection({ ...base, photoUrls, photoHashes: photos.map((p) => p.hash), signatureUrl });
      setDone({ saved, queued: false });
      onSaved(saved, false);
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
      setError(
        /permission|policy|42501|forbidden/i.test(msg)
          ? t.inspectionNotAllowed ?? "No tienes permiso para registrar inspecciones. Pídeselo a tu administrador."
          : `${t.inspectionSaveError ?? "No se pudo guardar la inspección"}: ${msg}`
      );
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "min-h-[44px] min-w-[44px] rounded-lg px-3 text-sm font-medium transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500";

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex h-full w-full flex-col bg-white dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl sm:shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 p-4 dark:border-slate-700">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-orange-600 dark:text-orange-400">
              {supersedes ? t.inspectionCorrect ?? "Corregir inspección" : t.inspect ?? "Inspeccionar"}
            </p>
            <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-white">{item.label}</h2>
            {item.serial ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t.serialNumber ?? "Número de serie"}: {item.serial}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className={`${btn} border-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800`} aria-label={t.common_close ?? "Cerrar"}>
            <X className="h-5 w-5" />
          </button>
        </header>

        {done ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">
              {done.queued ? t.inspectionPendingSync ?? "Guardada en el dispositivo. Se enviará al volver la conexión." : t.inspectionSaved ?? "Inspección registrada"}
            </p>
            {done.saved ? (
              <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                <p>
                  {t.inspectionServerTime ?? "Hora del servidor"}: {new Date(done.saved.serverRecordedAt).toLocaleString(locale ?? undefined)}
                </p>
                <p>
                  {t.inspectionVerificationCode ?? "Código de verificación"}:{" "}
                  <span className="font-mono">{done.saved.contentHash.slice(0, 12)}</span>
                </p>
              </div>
            ) : null}
            <button type="button" onClick={onClose} className={`${btn} border-orange-600 bg-orange-600 px-6 text-white hover:bg-orange-700`}>
              {t.common_close ?? "Cerrar"}
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {/* Plantilla */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="insp-template">
                  {t.inspectionTemplate ?? "Plantilla de inspección"}
                </label>
                <select
                  id="insp-template"
                  value={templateId}
                  onChange={(e) => {
                    setTemplateId(e.target.value);
                    setAnswers({});
                  }}
                  className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {templateLabel(tpl, t)}
                    </option>
                  ))}
                </select>
                {regRef ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t.inspectionRegulationRef ?? "Referencia normativa"}: {regRef}
                  </p>
                ) : null}
              </div>

              {/* Checklist */}
              <ol className="space-y-3">
                {checklist.map((c, idx) => {
                  const a = answers[c.id];
                  const opt = (st: ChecklistAnswerStatus, label: string, active: string) => (
                    <button
                      type="button"
                      onClick={() => setAnswer(c.id, st)}
                      aria-pressed={a?.status === st}
                      className={`${btn} flex-1 ${a?.status === st ? active : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:text-zinc-200 dark:hover:bg-slate-800"}`}
                    >
                      {label}
                    </button>
                  );
                  return (
                    <li key={c.id} className="rounded-xl border border-zinc-200 p-3 dark:border-slate-700">
                      <p className="mb-2 text-sm text-zinc-900 dark:text-white">
                        <span className="me-1 text-zinc-400">{idx + 1}.</span>
                        {checklistLabel(c, t)}
                      </p>
                      <div className="flex gap-2">
                        {opt("ok", t.inspectionStatusOk ?? "Correcto", "border-emerald-600 bg-emerald-600 text-white")}
                        {opt("defect", t.inspectionStatusDefect ?? "Defecto", "border-red-600 bg-red-600 text-white")}
                        {opt("na", t.inspectionStatusNa ?? "No aplica", "border-zinc-500 bg-zinc-500 text-white")}
                      </div>
                      {a?.status === "defect" ? (
                        <input
                          value={a.note ?? ""}
                          onChange={(e) => setAnswerNote(c.id, e.target.value)}
                          placeholder={t.inspectionDefectNote ?? "Describe el defecto"}
                          className="mt-2 min-h-[44px] w-full rounded-lg border border-red-300 bg-white px-3 text-sm dark:border-red-800 dark:bg-slate-800 dark:text-white"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ol>

              {/* Fotos */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {t.inspectionPhotos ?? "Fotos de la inspección"}
                  {minPhotos > 0 ? (
                    <span className="ms-1 text-xs font-normal text-zinc-500">
                      ({(t.inspectionPhotosRequired ?? "mínimo {n}").replace("{n}", String(minPhotos))})
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div key={p.url} className="relative h-24 w-24 overflow-hidden rounded-lg border border-zinc-200 dark:border-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute end-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
                        aria-label={t.common_delete ?? "Quitar"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-orange-400 text-xs font-medium text-orange-700 hover:bg-orange-50 dark:text-orange-300 dark:hover:bg-slate-800"
                  >
                    <Camera className="h-6 w-6" />
                    {t.inspectionTakePhoto ?? "Hacer foto"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple={!isTouchDevice()}
                    className="hidden"
                    onChange={(e) => void onFiles(e.target.files)}
                  />
                </div>
              </div>

              {/* Resultado */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{t.inspectionResult ?? "Resultado"}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["pass", t.inspectionResultPass ?? "Apto", "border-emerald-600 bg-emerald-600 text-white"],
                      ["pass_with_notes", t.inspectionResultPassWithNotes ?? "Apto con observaciones", "border-amber-500 bg-amber-500 text-white"],
                      ["fail", t.inspectionResultFail ?? "NO APTO", "border-red-600 bg-red-600 text-white"],
                    ] as const
                  ).map(([val, label, active]) => (
                    <button
                      key={val}
                      type="button"
                      disabled={val === "pass" && defectCount > 0}
                      onClick={() => setResult(val)}
                      aria-pressed={result === val}
                      className={`${btn} ${result === val ? active : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-slate-600 dark:text-zinc-200 dark:hover:bg-slate-800"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {needsDefectText ? (
                  <textarea
                    value={defects}
                    onChange={(e) => setDefects(e.target.value)}
                    rows={3}
                    placeholder={t.inspectionDefects ?? "Describe los defectos encontrados"}
                    className="w-full rounded-lg border border-red-300 bg-white p-3 text-sm dark:border-red-800 dark:bg-slate-800 dark:text-white"
                  />
                ) : null}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t.inspectionNotes ?? "Observaciones (opcional)"}
                  className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Firma opcional */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{t.inspectionSignature ?? "Firma (opcional)"}</p>
                  {hasSignature ? (
                    <button type="button" onClick={sigClear} className={`${btn} border-transparent text-zinc-500`}>
                      {t.inspectionSignatureClear ?? "Borrar firma"}
                    </button>
                  ) : null}
                </div>
                <canvas
                  ref={sigRef}
                  width={600}
                  height={180}
                  onPointerDown={sigDown}
                  onPointerMove={sigMove}
                  onPointerUp={sigUp}
                  onPointerLeave={sigUp}
                  className="h-32 w-full touch-none rounded-lg border border-zinc-300 bg-white dark:border-slate-600"
                />
              </div>

              {/* Declaración */}
              <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-zinc-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-zinc-100">
                <input
                  type="checkbox"
                  checked={declared}
                  onChange={(e) => setDeclared(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-orange-600"
                />
                <span>
                  <ShieldCheck className="me-1 inline h-4 w-4 text-orange-600" />
                  {declarationText}
                </span>
              </label>

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t.inspectionImmutableNote ??
                  "Una vez guardada, la inspección no se puede editar ni borrar. Si hay un error, se registra una corrección."}
              </p>

              {error ? (
                <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <footer className="flex gap-2 border-t border-zinc-200 p-4 dark:border-slate-700">
              <button type="button" onClick={onClose} className={`${btn} flex-1 border-zinc-300 text-zinc-700 dark:border-slate-600 dark:text-zinc-200`}>
                {t.common_cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!canSubmit}
                className={`${btn} flex flex-[2] items-center justify-center gap-2 border-orange-600 bg-orange-600 text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {t.inspectionSubmit ?? "Registrar inspección"}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
