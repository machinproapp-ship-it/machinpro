"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Upload, X, Layers, MousePointer2, Crosshair } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAuditEvent } from "@/lib/useAuditLog";
import type {
  Blueprint as BlueprintRow,
  BlueprintPin,
  BlueprintLayer,
  PinType,
  PinStatus,
} from "@/types/blueprint";
import type { Hazard } from "@/types/hazard";
import type { CorrectiveAction } from "@/types/correctiveAction";

const CLOUDINARY_CLOUD = "dwdlmxmkt";
const CLOUDINARY_PRESET = "i5dmd07o";

const LAYERS: { id: BlueprintLayer; labelKey: string }[] = [
  { id: "general", labelKey: "blueprints_layer_general" },
  { id: "electrical", labelKey: "blueprints_layer_electrical" },
  { id: "structural", labelKey: "blueprints_layer_structural" },
  { id: "plumbing", labelKey: "blueprints_layer_plumbing" },
  { id: "safety", labelKey: "blueprints_layer_safety" },
  { id: "progress", labelKey: "blueprints_layer_progress" },
];

const PIN_TYPES: PinType[] = ["annotation", "hazard", "corrective_action", "photo"];

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

function touchDistance(a: React.Touch, b: React.Touch): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

async function uploadToCloudinary(file: Blob, fileName: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, fileName);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error("upload failed");
  const j = (await res.json()) as { secure_url?: string };
  if (!j.secure_url) throw new Error("no url");
  return j.secure_url;
}

function loadImageNaturalSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("image load"));
    img.src = url;
  });
}

async function pdfFirstPageToPng(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const task = page.render({ canvasContext: ctx, viewport });
  await task.promise;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/png");
  });
  return { blob, width: canvas.width, height: canvas.height };
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  return 0;
}

function pinEmoji(pinType: PinType): string {
  switch (pinType) {
    case "hazard":
      return "⚠️";
    case "corrective_action":
      return "📋";
    case "photo":
      return "📷";
    default:
      return "💬";
  }
}

function defaultColorForPin(pinType: PinType, status: PinStatus): string {
  if (status === "resolved") return "#22c55e";
  switch (pinType) {
    case "hazard":
      return "#ef4444";
    case "corrective_action":
      return "#f97316";
    case "photo":
      return "#22c55e";
    default:
      return "#3b82f6";
  }
}

export interface BlueprintViewerProps {
  t: Record<string, string>;
  companyId: string | null;
  projectId: string;
  projectName: string;
  userProfileId: string | null;
  userName: string;
  userRole: string;
  onNavigateToHazard?: (hazardId: string) => void;
  onNavigateToCorrective?: (actionId: string) => void;
}

export default function BlueprintViewer({
  t,
  companyId,
  projectId,
  projectName,
  userProfileId,
  userName,
  userRole,
  onNavigateToHazard,
  onNavigateToCorrective,
}: BlueprintViewerProps) {
  const canEditPins = userRole === "admin" || userRole === "supervisor";
  const [rows, setRows] = useState<BlueprintRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pins, setPins] = useState<BlueprintPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [addMode, setAddMode] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<Set<BlueprintLayer>>(
    () => new Set(LAYERS.map((l) => l.id))
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pinPopup, setPinPopup] = useState<BlueprintPin | null>(null);
  const [hazardDetail, setHazardDetail] = useState<Hazard | null>(null);
  const [actionDetail, setActionDetail] = useState<CorrectiveAction | null>(null);
  const [pinFormOpen, setPinFormOpen] = useState(false);
  const [pendingPct, setPendingPct] = useState<{ x: number; y: number } | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<PinType>("annotation");
  const [formLayer, setFormLayer] = useState<BlueprintLayer>("general");
  const [formHazardId, setFormHazardId] = useState("");
  const [formActionId, setFormActionId] = useState("");
  const [hazardSearch, setHazardSearch] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinchRef = useRef<{ dist: number; z: number } | null>(null);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const loadBlueprints = useCallback(async () => {
    if (!supabase || !companyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("blueprints")
      .select("*")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data ?? []) as BlueprintRow[]);
    }
    setLoading(false);
  }, [companyId, projectId]);

  const loadPins = useCallback(
    async (bpId: string) => {
      if (!supabase || !companyId) {
        setPins([]);
        return;
      }
      const { data } = await supabase.from("blueprint_pins").select("*").eq("blueprint_id", bpId);
      setPins((data ?? []) as BlueprintPin[]);
    },
    [companyId]
  );

  const loadLinks = useCallback(async () => {
    if (!supabase || !companyId) return;
    const [{ data: hz }, { data: ca }] = await Promise.all([
      supabase.from("hazards").select("*").eq("company_id", companyId).eq("project_id", projectId),
      supabase.from("corrective_actions").select("*").eq("company_id", companyId).eq("project_id", projectId),
    ]);
    setHazards((hz ?? []) as Hazard[]);
    setActions((ca ?? []) as CorrectiveAction[]);
  }, [companyId, projectId]);

  useEffect(() => {
    void loadBlueprints();
  }, [loadBlueprints]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  useEffect(() => {
    if (selectedId) void loadPins(selectedId);
    else setPins([]);
  }, [selectedId, loadPins]);

  useEffect(() => {
    if (rows.length && !selectedId) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  useEffect(() => {
    if (!pinPopup?.hazard_id) {
      setHazardDetail(null);
      return;
    }
    void (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("hazards").select("*").eq("id", pinPopup.hazard_id).maybeSingle();
      setHazardDetail((data as Hazard) ?? null);
    })();
  }, [pinPopup?.hazard_id]);

  useEffect(() => {
    if (!pinPopup?.corrective_action_id) {
      setActionDetail(null);
      return;
    }
    void (async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from("corrective_actions")
        .select("*")
        .eq("id", pinPopup.corrective_action_id)
        .maybeSingle();
      setActionDetail((data as CorrectiveAction) ?? null);
    })();
  }, [pinPopup?.corrective_action_id]);

  const filteredHazards = useMemo(() => {
    const q = hazardSearch.trim().toLowerCase();
    return hazards.filter((h) => !q || h.title.toLowerCase().includes(q));
  }, [hazards, hazardSearch]);

  const layerCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of LAYERS) m[l.id] = 0;
    for (const p of pins) {
      m[p.layer] = (m[p.layer] ?? 0) + 1;
    }
    return m;
  }, [pins]);

  const visiblePins = useMemo(
    () => pins.filter((p) => visibleLayers.has(p.layer)),
    [pins, visibleLayers]
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!viewportRef.current?.contains(e.target as Node)) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => clamp(z + delta, 0.25, 5));
  }, []);

  const toggleLayer = (id: BlueprintLayer) => {
    setVisibleLayers((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleImgClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!addMode || !canEditPins || !selected) return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    setPendingPct({ x, y });
    setFormTitle("");
    setFormDesc("");
    setFormType("annotation");
    setFormLayer("general");
    setFormHazardId("");
    setFormActionId("");
    setHazardSearch("");
    setPinFormOpen(true);
  };

  const savePin = async () => {
    if (!supabase || !companyId || !userProfileId || !selected || !pendingPct || !formTitle.trim()) return;
    setSavingPin(true);
    try {
      const row: Record<string, unknown> = {
        blueprint_id: selected.id,
        company_id: companyId,
        project_id: projectId,
        x_percent: pendingPct.x,
        y_percent: pendingPct.y,
        layer: formLayer,
        pin_type: formType,
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        hazard_id: formType === "hazard" && formHazardId ? formHazardId : null,
        corrective_action_id:
          formType === "corrective_action" && formActionId ? formActionId : null,
        color: defaultColorForPin(formType, "open"),
        icon: "pin",
        status: "open" as PinStatus,
        created_by: userProfileId,
        created_by_name: userName,
      };
      const { data, error } = await supabase.from("blueprint_pins").insert(row).select("id").single();
      if (error) throw error;
      await logAuditEvent({
        company_id: companyId,
        user_id: userProfileId,
        user_name: userName,
        action: "pin_added",
        entity_type: "blueprint",
        entity_id: String(data?.id ?? selected.id),
        entity_name: formTitle.trim(),
        new_value: { blueprint_id: selected.id, x: pendingPct.x, y: pendingPct.y },
      });
      setPinFormOpen(false);
      setPendingPct(null);
      setAddMode(false);
      await loadPins(selected.id);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPin(false);
    }
  };

  const deletePin = async (pin: BlueprintPin) => {
    if (!supabase || !companyId || !userProfileId || !selected) return;
    const { error } = await supabase.from("blueprint_pins").delete().eq("id", pin.id);
    if (error) return;
    await logAuditEvent({
      company_id: companyId,
      user_id: userProfileId,
      user_name: userName,
      action: "pin_deleted",
      entity_type: "blueprint",
      entity_id: pin.id,
      entity_name: pin.title,
    });
    setPinPopup(null);
    await loadPins(selected.id);
  };

  const submitUpload = async () => {
    if (!supabase || !companyId || !userProfileId || !uploadName.trim() || !uploadFile) return;
    setUploading(true);
    try {
      let blob: Blob = uploadFile;
      let fname = uploadFile.name;
      let w: number | null = null;
      let h: number | null = null;
      let fileType: "image" | "pdf" = "image";

      if (uploadFile.type === "application/pdf") {
        const r = await pdfFirstPageToPng(uploadFile);
        blob = r.blob;
        w = r.width;
        h = r.height;
        fname = "blueprint-page1.png";
        fileType = "pdf";
      } else {
        const url = URL.createObjectURL(uploadFile);
        try {
          const dim = await loadImageNaturalSize(url);
          w = dim.width;
          h = dim.height;
        } catch {
          w = null;
          h = null;
        }
        URL.revokeObjectURL(url);
      }

      const imageUrl = await uploadToCloudinary(blob, fname);
      if (w == null || h == null) {
        try {
          const dim = await loadImageNaturalSize(imageUrl);
          w = dim.width;
          h = dim.height;
        } catch {
          w = 1200;
          h = 800;
        }
      }

      const nextVersion =
        rows.length > 0 ? Math.max(...rows.map((r) => r.version)) + 1 : 1;

      const insert = {
        company_id: companyId,
        project_id: projectId,
        project_name: projectName,
        name: uploadName.trim(),
        version: nextVersion,
        image_url: imageUrl,
        file_type: fileType,
        width: w,
        height: h,
        is_active: true,
        created_by: userProfileId,
        created_by_name: userName,
      };
      const { data, error } = await supabase.from("blueprints").insert(insert).select("id").single();
      if (error) throw error;
      await logAuditEvent({
        company_id: companyId,
        user_id: userProfileId,
        user_name: userName,
        action: "blueprint_uploaded",
        entity_type: "blueprint",
        entity_id: String(data?.id ?? ""),
        entity_name: uploadName.trim(),
        new_value: { project_id: projectId, image_url: imageUrl },
      });
      setUploadOpen(false);
      setUploadName("");
      setUploadFile(null);
      await loadBlueprints();
      if (data?.id) setSelectedId(String(data.id));
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const onPointerDownViewport = (e: React.PointerEvent) => {
    if (addMode) return;
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };

  const onPointerMoveViewport = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPan({
      x: d.px + (e.clientX - d.x),
      y: d.py + (e.clientY - d.y),
    });
  };

  const onPointerUpViewport = () => {
    dragRef.current = null;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { dist: touchDistance(e.touches[0], e.touches[1]), z: zoom };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const d = touchDistance(e.touches[0], e.touches[1]);
      const ratio = d / pinchRef.current.dist;
      setZoom(clamp(pinchRef.current.z * ratio, 0.25, 5));
    }
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  if (!companyId) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-600 dark:text-zinc-400">
        {t.blueprints_no_blueprints ?? t.hazards_no_company ?? "—"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          {t.blueprints_title ?? t.blueprints ?? "Blueprints"}
        </h2>
        {canEditPins && (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 text-sm font-semibold"
          >
            <Upload className="h-4 w-4" />
            {t.blueprints_upload ?? "Upload"}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.hazards_loading ?? "…"}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.blueprints_no_blueprints ?? "—"}</p>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          <aside className="lg:w-56 shrink-0 space-y-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {t.blueprints_layers ?? "Layers"}
            </p>
            {LAYERS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => toggleLayer(l.id)}
                className={`flex w-full min-h-[44px] items-center justify-between rounded-lg border px-2 py-2 text-left text-xs font-medium ${
                  visibleLayers.has(l.id)
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                    : "border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <span>{t[l.labelKey] ?? l.id}</span>
                <span className="tabular-nums opacity-70">{layerCounts[l.id] ?? 0}</span>
              </button>
            ))}
          </aside>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                {t.blueprints_select ?? "Blueprint"}
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value || null)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm min-h-[44px] px-2"
                >
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · v{r.version}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  {t.blueprints_version ?? "v"}
                  {selected.version}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z + 0.15, 0.25, 5))}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200"
                aria-label={t.blueprints_zoom_in ?? "Zoom in"}
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z - 0.15, 0.25, 5))}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200"
                aria-label={t.blueprints_zoom_out ?? "Zoom out"}
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddMode(false);
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
                  !addMode
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                    : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <MousePointer2 className="h-4 w-4" />
                {t.blueprints_mode_view ?? "View"}
              </button>
              {canEditPins && (
                <button
                  type="button"
                  onClick={() => setAddMode((a) => !a)}
                  className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
                    addMode
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                      : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <Crosshair className="h-4 w-4" />
                  {t.blueprints_mode_add ?? "Add pin"}
                </button>
              )}
            </div>

            <div
              ref={viewportRef}
              className="relative rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-950 overflow-hidden touch-none"
              style={{ minHeight: "min(70vh, 560px)" }}
              onWheel={onWheel}
              onPointerDown={onPointerDownViewport}
              onPointerMove={onPointerMoveViewport}
              onPointerUp={onPointerUpViewport}
              onPointerCancel={onPointerUpViewport}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {selected && (
                <div
                  className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
                  style={{ touchAction: "none" }}
                >
                  <div
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: "center center",
                      transition: dragRef.current ? "none" : undefined,
                    }}
                    className="relative inline-block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imgRef}
                      src={selected.image_url}
                      alt=""
                      className={`max-w-[min(100vw-4rem,920px)] max-h-[min(70vh,560px)] w-auto h-auto object-contain select-none ${
                        addMode && canEditPins ? "cursor-crosshair" : ""
                      }`}
                      onClick={handleImgClick}
                      draggable={false}
                    />
                    {visiblePins.map((pin) => (
                      <button
                        key={pin.id}
                        type="button"
                        className="absolute min-h-[44px] min-w-[44px] flex items-end justify-center -translate-x-1/2 -translate-y-full text-lg leading-none drop-shadow-md"
                        style={{
                          left: `${num(pin.x_percent)}%`,
                          top: `${num(pin.y_percent)}%`,
                          color: pin.status === "resolved" ? "#22c55e" : pin.color,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinPopup(pin);
                        }}
                        aria-label={pin.title}
                      >
                        <span className="text-2xl">{pinEmoji(pin.pin_type)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {t.blueprints_upload ?? "Upload"}
              </h3>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-600"
                aria-label={t.hazards_close ?? "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-sm text-zinc-600 dark:text-zinc-400">
              {t.blueprints_name ?? "Name"}
              <input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 min-h-[44px] text-sm"
              />
            </label>
            <label className="block text-sm text-zinc-600 dark:text-zinc-400">
              PNG / JPG / PDF
              <input
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                className="mt-1 w-full text-sm"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              disabled={uploading || !uploadName.trim() || !uploadFile}
              onClick={() => void submitUpload()}
              className="w-full min-h-[44px] rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-50"
            >
              {uploading ? (t.hazards_loading ?? "…") : (t.hazards_save ?? "Save")}
            </button>
          </div>
        </div>
      )}

      {pinFormOpen && pendingPct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-6 space-y-3 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {t.blueprints_add_pin ?? "Add pin"}
            </h3>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{t.blueprints_pin_title ?? "Title"} *</span>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 min-h-[44px] text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{t.blueprints_pin_desc ?? "Description"}</span>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 min-h-[72px] text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{t.blueprints_pin_type ?? "Type"}</span>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as PinType)}
                className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 min-h-[44px] text-sm"
              >
                {PIN_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{t.blueprints_pin_layer ?? "Layer"}</span>
              <select
                value={formLayer}
                onChange={(e) => setFormLayer(e.target.value as BlueprintLayer)}
                className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 min-h-[44px] text-sm"
              >
                {LAYERS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {t[l.labelKey] ?? l.id}
                  </option>
                ))}
              </select>
            </label>
            {formType === "hazard" && (
              <div className="space-y-2">
                <input
                  placeholder={t.hazards_search ?? "Search"}
                  value={hazardSearch}
                  onChange={(e) => setHazardSearch(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2 min-h-[44px] text-sm"
                />
                <label className="block text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {t.blueprints_pin_hazard ?? "Hazard"}
                  </span>
                  <select
                    value={formHazardId}
                    onChange={(e) => setFormHazardId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 min-h-[44px] text-sm"
                  >
                    <option value="">—</option>
                    {filteredHazards.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {formType === "corrective_action" && (
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {t.blueprints_pin_action ?? "Corrective action"}
                </span>
                <select
                  value={formActionId}
                  onChange={(e) => setFormActionId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 min-h-[44px] text-sm"
                >
                  <option value="">—</option>
                  {actions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPinFormOpen(false);
                  setPendingPct(null);
                }}
                className="flex-1 min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                {t.hazards_close ?? "Cancel"}
              </button>
              <button
                type="button"
                disabled={savingPin || !formTitle.trim()}
                onClick={() => void savePin()}
                className="flex-1 min-h-[44px] rounded-xl bg-amber-600 text-white font-semibold text-sm disabled:opacity-50"
              >
                {t.hazards_save ?? "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pinPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-5 space-y-3 shadow-xl">
            <div className="flex justify-between gap-2">
              <h4 className="font-semibold text-zinc-900 dark:text-white pr-2">{pinPopup.title}</h4>
              <button
                type="button"
                onClick={() => setPinPopup(null)}
                className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-600"
              >
                <X className="h-5 w-5 mx-auto" />
              </button>
            </div>
            {pinPopup.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{pinPopup.description}</p>
            )}
            {pinPopup.hazard_id && hazardDetail && (
              <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-3 text-sm space-y-2">
                <p className="font-medium text-zinc-900 dark:text-white">{t.blueprints_linked_hazard ?? "Hazard"}</p>
                {hazardDetail.photos?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hazardDetail.photos[0]}
                    alt=""
                    className="w-full h-28 object-cover rounded-lg border border-zinc-200 dark:border-zinc-600"
                  />
                )}
                <p className="text-zinc-700 dark:text-zinc-300">
                  {hazardDetail.severity} · {hazardDetail.status}
                </p>
              </div>
            )}
            {pinPopup.corrective_action_id && actionDetail && (
              <div className="rounded-lg border border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20 p-3 text-sm space-y-1">
                <p className="font-medium">{t.blueprints_linked_action ?? "Action"}</p>
                <p>
                  {actionDetail.priority} · {actionDetail.status}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {actionDetail.assigned_to_name ?? "—"}
                </p>
              </div>
            )}
            {pinPopup.status === "resolved" && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {t.blueprints_pin_resolved ?? "Resolved"}
              </p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              {pinPopup.hazard_id && onNavigateToHazard && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToHazard(pinPopup.hazard_id!);
                    setPinPopup(null);
                  }}
                  className="min-h-[44px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold"
                >
                  {t.blueprints_pin_detail ?? "Full detail"}
                </button>
              )}
              {pinPopup.corrective_action_id && onNavigateToCorrective && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToCorrective(pinPopup.corrective_action_id!);
                    setPinPopup(null);
                  }}
                  className="min-h-[44px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold"
                >
                  {t.blueprints_pin_detail ?? "Full detail"}
                </button>
              )}
              {canEditPins && (
                <button
                  type="button"
                  onClick={() => void deletePin(pinPopup)}
                  className="min-h-[44px] rounded-xl border border-red-600 text-red-700 dark:text-red-400 text-sm font-semibold"
                >
                  {t.blueprints_delete_pin ?? "Delete pin"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
