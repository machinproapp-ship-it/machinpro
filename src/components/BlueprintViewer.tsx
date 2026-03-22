"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  Upload,
  X,
  Layers,
  MousePointer2,
  Crosshair,
  File,
  StickyNote,
  History,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAuditEvent } from "@/lib/useAuditLog";
import type {
  Blueprint as BlueprintRow,
  BlueprintAnnotation,
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

const NOTE_COLORS = ["#fbbf24", "#22c55e", "#3b82f6", "#ec4899"] as const;

const MAX_NOTE_LEN = 500;
const NOTE_PREVIEW_LEN = 50;

function normalizeBlueprintRow(r: Record<string, unknown>): BlueprintRow {
  return {
    ...(r as unknown as BlueprintRow),
    parent_version_id: (r.parent_version_id as string | null | undefined) ?? null,
    version_notes: (r.version_notes as string | null | undefined) ?? null,
  };
}

function formatBlueprintWhen(iso: string, locale: string | undefined): string {
  try {
    return new Date(iso).toLocaleString(locale || undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

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

const UPLOAD_ACCEPT = ["image/png", "image/jpeg", "application/pdf"] as const;

function isValidBlueprintFile(f: File): boolean {
  return UPLOAD_ACCEPT.includes(f.type as (typeof UPLOAD_ACCEPT)[number]);
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
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const uploadDragDepthRef = useRef(0);
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

  const [notesLayerVisible, setNotesLayerVisible] = useState(true);
  const [addNoteMode, setAddNoteMode] = useState(false);
  const [annotations, setAnnotations] = useState<BlueprintAnnotation[]>([]);
  const [annotationPopup, setAnnotationPopup] = useState<BlueprintAnnotation | null>(null);
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [pendingNotePct, setPendingNotePct] = useState<{ x: number; y: number } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteColorChoice, setNoteColorChoice] = useState<string>(NOTE_COLORS[0]);
  const [savingNote, setSavingNote] = useState(false);

  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNotesText, setVersionNotesText] = useState("");
  const [migratePins, setMigratePins] = useState(true);
  const [migrateAnnotations, setMigrateAnnotations] = useState(true);
  const [versionUploading, setVersionUploading] = useState(false);
  const [versionDragActive, setVersionDragActive] = useState(false);
  const versionFileInputRef = useRef<HTMLInputElement>(null);
  const versionDragDepthRef = useRef(0);

  const [historyOpen, setHistoryOpen] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinchRef = useRef<{ dist: number; z: number } | null>(null);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const browserLocale = useMemo(
    () => (typeof navigator !== "undefined" ? navigator.language : undefined),
    []
  );

  const blueprintOptions = useMemo(() => {
    return [...rows].sort((a, b) => {
      const c = a.name.localeCompare(b.name);
      if (c !== 0) return c;
      return b.version - a.version;
    });
  }, [rows]);

  const sameNamePeers = useMemo(() => {
    if (!selected) return [];
    return rows.filter((r) => r.name === selected.name);
  }, [rows, selected]);

  const activeVersionRow = useMemo(() => {
    if (!selected) return null;
    const peers = rows.filter((r) => r.name === selected.name);
    const active = peers.find((r) => r.is_active);
    if (active) return active;
    const sorted = [...peers].sort((a, b) => b.version - a.version);
    return sorted[0] ?? null;
  }, [rows, selected]);

  const isViewingActiveVersion = Boolean(
    selected && activeVersionRow && selected.id === activeVersionRow.id
  );

  const activeNotesCount = useMemo(
    () => annotations.filter((a) => !a.is_resolved).length,
    [annotations]
  );

  const closeUploadModal = useCallback(() => {
    setUploadOpen(false);
    setUploadFile(null);
    setUploadName("");
    setUploadDragActive(false);
    uploadDragDepthRef.current = 0;
    if (uploadFileInputRef.current) uploadFileInputRef.current.value = "";
  }, []);

  const pickUploadFile = useCallback((file: File | null | undefined) => {
    if (file && isValidBlueprintFile(file)) setUploadFile(file);
  }, []);

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
      .order("name", { ascending: true })
      .order("version", { ascending: false });
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data ?? []).map((r) => normalizeBlueprintRow(r as Record<string, unknown>)));
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

  const loadAnnotations = useCallback(
    async (bpId: string) => {
      if (!supabase || !companyId) {
        setAnnotations([]);
        return;
      }
      const { data, error } = await supabase
        .from("blueprint_annotations")
        .select("*")
        .eq("blueprint_id", bpId);
      if (error) {
        console.error(error);
        setAnnotations([]);
        return;
      }
      setAnnotations((data ?? []) as BlueprintAnnotation[]);
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
    if (selectedId) void loadAnnotations(selectedId);
    else setAnnotations([]);
  }, [selectedId, loadAnnotations]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId && !rows.some((r) => r.id === selectedId)) {
      const active = rows.find((r) => r.is_active) ?? rows[0];
      setSelectedId(active.id);
      return;
    }
    if (!selectedId) {
      const active = rows.find((r) => r.is_active) ?? rows[0];
      setSelectedId(active.id);
    }
  }, [rows, selectedId]);

  const closeVersionModal = useCallback(() => {
    setVersionModalOpen(false);
    setVersionFile(null);
    setVersionNotesText("");
    setMigratePins(true);
    setMigrateAnnotations(true);
    setVersionDragActive(false);
    versionDragDepthRef.current = 0;
    if (versionFileInputRef.current) versionFileInputRef.current.value = "";
  }, []);

  const pickVersionFile = useCallback((file: File | null | undefined) => {
    if (file && isValidBlueprintFile(file)) setVersionFile(file);
  }, []);

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
    if (!selected) return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    if (addNoteMode && userProfileId && notesLayerVisible) {
      setPendingNotePct({ x, y });
      setNoteDraft("");
      setNoteColorChoice(NOTE_COLORS[0]);
      setNoteFormOpen(true);
      return;
    }

    if (!addMode || !canEditPins) return;
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

  const canEditAnnotation = (a: BlueprintAnnotation) =>
    Boolean(userProfileId && (a.author_id === userProfileId || canEditPins));

  const saveNote = async () => {
    if (!supabase || !companyId || !userProfileId || !selected || !pendingNotePct || !noteDraft.trim()) return;
    const content = noteDraft.trim().slice(0, MAX_NOTE_LEN);
    if (!content) return;
    setSavingNote(true);
    try {
      const row = {
        blueprint_id: selected.id,
        company_id: companyId,
        project_id: projectId,
        x_percent: pendingNotePct.x,
        y_percent: pendingNotePct.y,
        content,
        color: noteColorChoice,
        author_id: userProfileId,
        author_name: userName,
        is_resolved: false,
      };
      const { data, error } = await supabase
        .from("blueprint_annotations")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      await logAuditEvent({
        company_id: companyId,
        user_id: userProfileId,
        user_name: userName,
        action: "annotation_added",
        entity_type: "blueprint",
        entity_id: String(data?.id ?? ""),
        entity_name: content.slice(0, 80),
        new_value: { blueprint_id: selected.id, x: pendingNotePct.x, y: pendingNotePct.y },
      });
      setNoteFormOpen(false);
      setPendingNotePct(null);
      setAddNoteMode(false);
      await loadAnnotations(selected.id);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNote(false);
    }
  };

  const resolveAnnotation = async (ann: BlueprintAnnotation) => {
    if (!supabase || !companyId || !userProfileId) return;
    if (!canEditAnnotation(ann) || ann.is_resolved) return;
    const { error } = await supabase
      .from("blueprint_annotations")
      .update({ is_resolved: true })
      .eq("id", ann.id);
    if (error) return;
    await logAuditEvent({
      company_id: companyId,
      user_id: userProfileId,
      user_name: userName,
      action: "annotation_resolved",
      entity_type: "blueprint",
      entity_id: ann.id,
      entity_name: ann.content.slice(0, 80),
    });
    setAnnotationPopup(null);
    if (selectedId) await loadAnnotations(selectedId);
  };

  const deleteAnnotation = async (ann: BlueprintAnnotation) => {
    if (!supabase || !companyId || !userProfileId) return;
    if (!canEditAnnotation(ann)) return;
    const { error } = await supabase.from("blueprint_annotations").delete().eq("id", ann.id);
    if (error) return;
    await logAuditEvent({
      company_id: companyId,
      user_id: userProfileId,
      user_name: userName,
      action: "annotation_deleted",
      entity_type: "blueprint",
      entity_id: ann.id,
      entity_name: ann.content.slice(0, 80),
    });
    setAnnotationPopup(null);
    if (selectedId) await loadAnnotations(selectedId);
  };

  const submitNewVersion = async () => {
    if (!supabase || !companyId || !userProfileId || !selected || !versionFile) return;
    setVersionUploading(true);
    try {
      let blob: Blob = versionFile;
      let fname = versionFile.name;
      let w: number | null = null;
      let h: number | null = null;
      let fileType: "image" | "pdf" = "image";

      if (versionFile.type === "application/pdf") {
        const r = await pdfFirstPageToPng(versionFile);
        blob = r.blob;
        w = r.width;
        h = r.height;
        fname = "blueprint-page1.png";
        fileType = "pdf";
      } else {
        const url = URL.createObjectURL(versionFile);
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

      const peers = rows.filter((r) => r.name === selected.name);
      const nextVersion =
        peers.length > 0 ? Math.max(...peers.map((r) => r.version)) + 1 : selected.version + 1;

      await supabase
        .from("blueprints")
        .update({ is_active: false })
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .eq("name", selected.name);

      const insert = {
        company_id: companyId,
        project_id: projectId,
        project_name: projectName,
        name: selected.name,
        version: nextVersion,
        image_url: imageUrl,
        file_type: fileType,
        width: w,
        height: h,
        is_active: true,
        parent_version_id: selected.id,
        version_notes: versionNotesText.trim() || null,
        created_by: userProfileId,
        created_by_name: userName,
      };
      const { data: newRow, error: insErr } = await supabase
        .from("blueprints")
        .insert(insert)
        .select("id")
        .single();
      if (insErr) throw insErr;
      const newId = String(newRow?.id ?? "");

      if (migratePins) {
        const { data: oldPins } = await supabase.from("blueprint_pins").select("*").eq("blueprint_id", selected.id);
        for (const p of oldPins ?? []) {
          const raw = p as Record<string, unknown>;
          const { id: _pid, ...pinRest } = raw;
          await supabase.from("blueprint_pins").insert({ ...pinRest, blueprint_id: newId });
        }
      }

      if (migrateAnnotations) {
        const { data: oldAnn } = await supabase
          .from("blueprint_annotations")
          .select("*")
          .eq("blueprint_id", selected.id);
        for (const a of oldAnn ?? []) {
          const raw = a as Record<string, unknown>;
          const { id: _aid, ...annRest } = raw;
          await supabase.from("blueprint_annotations").insert({ ...annRest, blueprint_id: newId });
        }
      }

      await logAuditEvent({
        company_id: companyId,
        user_id: userProfileId,
        user_name: userName,
        action: "blueprint_new_version",
        entity_type: "blueprint",
        entity_id: newId,
        entity_name: selected.name,
        new_value: {
          from_version: selected.version,
          to_version: nextVersion,
          parent_id: selected.id,
        },
      });

      closeVersionModal();
      await loadBlueprints();
      setSelectedId(newId);
    } catch (e) {
      console.error(e);
    } finally {
      setVersionUploading(false);
    }
  };

  const restoreVersion = async (targetId: string) => {
    if (!supabase || !companyId || !userProfileId || !selected) return;
    const target = rows.find((r) => r.id === targetId);
    if (!target || target.name !== selected.name) return;

    await supabase
      .from("blueprints")
      .update({ is_active: false })
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .eq("name", target.name);

    const { error } = await supabase.from("blueprints").update({ is_active: true }).eq("id", targetId);
    if (error) return;

    await logAuditEvent({
      company_id: companyId,
      user_id: userProfileId,
      user_name: userName,
      action: "blueprint_version_restored",
      entity_type: "blueprint",
      entity_id: targetId,
      entity_name: target.name,
      new_value: { version: target.version },
    });

    setHistoryOpen(false);
    await loadBlueprints();
    setSelectedId(targetId);
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

      const trimmedName = uploadName.trim();
      const siblings = rows.filter((r) => r.name === trimmedName);
      const nextVersion =
        siblings.length > 0 ? Math.max(...siblings.map((r) => r.version)) + 1 : 1;
      const parentId =
        siblings.length > 0
          ? [...siblings].sort((a, b) => b.version - a.version)[0]?.id ?? null
          : null;

      if (siblings.length > 0) {
        await supabase
          .from("blueprints")
          .update({ is_active: false })
          .eq("company_id", companyId)
          .eq("project_id", projectId)
          .eq("name", trimmedName);
      }

      const insert = {
        company_id: companyId,
        project_id: projectId,
        project_name: projectName,
        name: trimmedName,
        version: nextVersion,
        image_url: imageUrl,
        file_type: fileType,
        width: w,
        height: h,
        is_active: true,
        parent_version_id: parentId,
        version_notes: null,
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
      closeUploadModal();
      await loadBlueprints();
      if (data?.id) setSelectedId(String(data.id));
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const onPointerDownViewport = (e: React.PointerEvent) => {
    if (addMode || addNoteMode) return;
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
            onClick={() => {
              uploadDragDepthRef.current = 0;
              setUploadDragActive(false);
              setUploadOpen(true);
            }}
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
            <button
              type="button"
              onClick={() => setNotesLayerVisible((v) => !v)}
              className={`flex w-full min-h-[44px] items-center justify-between rounded-lg border px-2 py-2 text-left text-xs font-medium ${
                notesLayerVisible
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                  : "border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                {t.blueprints_notes_layer ?? "Notes"}
              </span>
              <span className="tabular-nums opacity-70" title={t.blueprints_active_notes ?? "Active notes"}>
                {activeNotesCount}
              </span>
            </button>
          </aside>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-zinc-600 dark:text-zinc-400 flex flex-wrap items-center gap-2">
                {t.blueprints_select ?? "Blueprint"}
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value || null)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm min-h-[44px] px-2 max-w-[min(100%,280px)]"
                >
                  {blueprintOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · V{r.version}
                      {r.is_active ? ` · ${t.blueprints_version_active ?? "Active"}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  V{selected.version}
                </span>
              )}
              {canEditPins && selected && (
                <button
                  type="button"
                  onClick={() => {
                    versionDragDepthRef.current = 0;
                    setVersionDragActive(false);
                    setVersionModalOpen(true);
                  }}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <Upload className="h-4 w-4 shrink-0" aria-hidden />
                  {t.blueprints_new_version ?? "New version"}
                </button>
              )}
              {selected && sameNamePeers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <History className="h-4 w-4 shrink-0" aria-hidden />
                  {t.blueprints_version_history ?? "Version history"}
                </button>
              )}
            </div>

            {selected && activeVersionRow && selected.id !== activeVersionRow.id && (
              <div
                role="status"
                className="rounded-xl border border-amber-400/80 bg-amber-50 dark:bg-amber-950/35 dark:border-amber-600/60 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100"
              >
                {t.blueprints_old_version_banner ?? "Versión anterior — viendo"} V{selected.version}
                <span className="opacity-90">
                  {" "}
                  ({t.blueprints_version_current ?? "actual"}: V{activeVersionRow.version})
                </span>
              </div>
            )}

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
                  setAddNoteMode(false);
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
                  !addMode && !addNoteMode
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
                  onClick={() =>
                    setAddMode((a) => {
                      const n = !a;
                      if (n) setAddNoteMode(false);
                      return n;
                    })
                  }
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
              {userProfileId && (
                <button
                  type="button"
                  onClick={() =>
                    setAddNoteMode((a) => {
                      const n = !a;
                      if (n) setAddMode(false);
                      return n;
                    })
                  }
                  className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
                    addNoteMode
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                      : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <StickyNote className="h-4 w-4 shrink-0" aria-hidden />
                  {t.blueprints_add_note ?? "Add note"}
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
                        (addMode && canEditPins) || (addNoteMode && userProfileId && notesLayerVisible)
                          ? "cursor-crosshair"
                          : ""
                      }`}
                      onClick={handleImgClick}
                      draggable={false}
                    />
                    {visiblePins.map((pin) => (
                      <button
                        key={pin.id}
                        type="button"
                        className="absolute min-h-[44px] min-w-[44px] flex items-end justify-center -translate-x-1/2 -translate-y-full text-lg leading-none drop-shadow-md transition-opacity"
                        style={{
                          left: `${num(pin.x_percent)}%`,
                          top: `${num(pin.y_percent)}%`,
                          color: pin.status === "resolved" ? "#22c55e" : pin.color,
                          opacity: isViewingActiveVersion ? 1 : 0.42,
                          filter: isViewingActiveVersion ? undefined : "grayscale(0.5)",
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
                    {notesLayerVisible &&
                      annotations.map((ann) => {
                        const preview =
                          ann.content.length > NOTE_PREVIEW_LEN
                            ? `${ann.content.slice(0, NOTE_PREVIEW_LEN)}…`
                            : ann.content;
                        return (
                          <button
                            key={ann.id}
                            type="button"
                            className="absolute z-[1] flex max-w-[min(200px,45vw)] min-h-[44px] -translate-x-1/2 -translate-y-full flex-col items-stretch rounded-lg border border-black/10 dark:border-white/10 px-2 py-1.5 text-left shadow-md transition-opacity"
                            style={{
                              left: `${num(ann.x_percent)}%`,
                              top: `${num(ann.y_percent)}%`,
                              backgroundColor: ann.color,
                              opacity: ann.is_resolved ? 0.5 : 1,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAnnotationPopup(ann);
                            }}
                            aria-label={preview}
                          >
                            <span
                              className={`text-[11px] font-semibold leading-snug text-zinc-900 line-clamp-3 ${
                                ann.is_resolved ? "line-through opacity-90" : ""
                              }`}
                            >
                              {preview}
                            </span>
                            <span className="mt-1 text-[9px] font-medium text-zinc-800/90 truncate">
                              {(ann.author_name ?? "—") +
                                " · " +
                                formatBlueprintWhen(ann.created_at, browserLocale)}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-5 sm:p-6 space-y-4 shadow-xl max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center gap-2">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white pr-2">
                {t.blueprints_upload ?? "Upload"}
              </h3>
              <button
                type="button"
                onClick={() => closeUploadModal()}
                className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                aria-label={t.hazards_close ?? "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-600 dark:text-zinc-400">{t.blueprints_name ?? "Name"}</span>
              <input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 min-h-[44px] text-sm"
              />
            </label>

            <input
              ref={uploadFileInputRef}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              className="hidden"
              aria-hidden
              onChange={(e) => {
                pickUploadFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <div>
              <button
                type="button"
                onClick={() => uploadFileInputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  uploadDragDepthRef.current += 1;
                  setUploadDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  uploadDragDepthRef.current -= 1;
                  if (uploadDragDepthRef.current <= 0) {
                    uploadDragDepthRef.current = 0;
                    setUploadDragActive(false);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  uploadDragDepthRef.current = 0;
                  setUploadDragActive(false);
                  const f = e.dataTransfer.files?.[0];
                  pickUploadFile(f);
                }}
                className={`group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 sm:py-12 text-center transition-colors min-h-[200px] touch-manipulation ${
                  uploadDragActive
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-400"
                    : "border-zinc-300 bg-zinc-50/80 dark:border-zinc-600 dark:bg-zinc-800/50 hover:border-amber-400/80 hover:bg-amber-50/50 dark:hover:border-amber-600/60 dark:hover:bg-amber-950/20"
                }`}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-zinc-200/80 dark:ring-zinc-600 text-amber-600 dark:text-amber-400">
                  <Upload className="h-7 w-7" aria-hidden />
                </span>
                <div className="space-y-1 px-2">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {t.blueprints_upload_drop_primary ?? "Arrastra tu plano aquí"}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t.blueprints_upload_drop_or ?? "o haz clic para seleccionar"}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500 pt-1">
                    {t.blueprints_upload_formats ?? "PNG, JPG, PDF"}
                  </p>
                </div>
              </button>

              {uploadFile && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2.5 min-h-[44px]">
                  <File className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {uploadFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadFile(null);
                      if (uploadFileInputRef.current) uploadFileInputRef.current.value = "";
                    }}
                    className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    aria-label={t.blueprints_upload_remove_file ?? "Quitar archivo"}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={uploading || !uploadName.trim() || !uploadFile}
              onClick={() => void submitUpload()}
              className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 disabled:opacity-50 disabled:pointer-events-none"
            >
              {uploading
                ? (t.hazards_loading ?? "…")
                : (t.blueprints_upload_save ?? t.hazards_save ?? "Guardar")}
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

      {noteFormOpen && pendingNotePct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-5 sm:p-6 space-y-3 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {t.blueprints_add_note ?? "Add note"}
            </h3>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                {t.blueprints_note_placeholder ?? "Note"}
              </span>
              <textarea
                value={noteDraft}
                maxLength={MAX_NOTE_LEN}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, MAX_NOTE_LEN))}
                placeholder={t.blueprints_note_placeholder ?? ""}
                className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 min-h-[100px] text-sm"
              />
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                {noteDraft.length}/{MAX_NOTE_LEN}
              </span>
            </label>
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {t.blueprints_note_color ?? "Color"}
              </p>
              <div className="flex flex-wrap gap-3">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`${t.blueprints_note_color ?? "Color"} ${c}`}
                    onClick={() => setNoteColorChoice(c)}
                    className={`min-h-[44px] min-w-[44px] rounded-full border-2 transition-transform ${
                      noteColorChoice === c
                        ? "border-zinc-900 dark:border-white scale-110"
                        : "border-transparent ring-2 ring-zinc-300 dark:ring-zinc-600"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setNoteFormOpen(false);
                  setPendingNotePct(null);
                }}
                className="flex-1 min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                {t.hazards_close ?? "Cancel"}
              </button>
              <button
                type="button"
                disabled={savingNote || !noteDraft.trim()}
                onClick={() => void saveNote()}
                className="flex-1 min-h-[44px] rounded-xl bg-amber-600 text-white font-semibold text-sm disabled:opacity-50"
              >
                {t.hazards_save ?? "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {versionModalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-5 sm:p-6 space-y-4 shadow-xl max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center gap-2">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white pr-2">
                {t.blueprints_new_version ?? "New version"}
              </h3>
              <button
                type="button"
                onClick={() => closeVersionModal()}
                className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                aria-label={t.hazards_close ?? "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <input
              ref={versionFileInputRef}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              className="hidden"
              aria-hidden
              onChange={(e) => {
                pickVersionFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <div>
              <button
                type="button"
                onClick={() => versionFileInputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  versionDragDepthRef.current += 1;
                  setVersionDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  versionDragDepthRef.current -= 1;
                  if (versionDragDepthRef.current <= 0) {
                    versionDragDepthRef.current = 0;
                    setVersionDragActive(false);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  versionDragDepthRef.current = 0;
                  setVersionDragActive(false);
                  pickVersionFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors min-h-[160px] touch-manipulation ${
                  versionDragActive
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-400"
                    : "border-zinc-300 bg-zinc-50/80 dark:border-zinc-600 dark:bg-zinc-800/50 hover:border-amber-400/80 dark:hover:border-amber-600/60"
                }`}
              >
                <Upload className="h-8 w-8 text-amber-600 dark:text-amber-400" aria-hidden />
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {t.blueprints_upload_drop_primary ?? "Drop file"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t.blueprints_upload_formats ?? "PNG, JPG, PDF"}
                </p>
              </button>
              {versionFile && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-600 px-2 py-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <File className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{versionFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setVersionFile(null);
                      if (versionFileInputRef.current) versionFileInputRef.current.value = "";
                    }}
                    className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600"
                    aria-label={t.blueprints_upload_remove_file ?? "Remove"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                {t.blueprints_version_notes ?? "Version notes"}
              </span>
              <textarea
                value={versionNotesText}
                onChange={(e) => setVersionNotesText(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2.5 min-h-[72px] text-sm"
              />
            </label>

            <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={migratePins}
                onChange={(e) => setMigratePins(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-zinc-300"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{t.blueprints_migrate_pins ?? ""}</span>
            </label>
            <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={migrateAnnotations}
                onChange={(e) => setMigrateAnnotations(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-zinc-300"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {t.blueprints_migrate_annotations ?? ""}
              </span>
            </label>

            <button
              type="button"
              disabled={versionUploading || !versionFile}
              onClick={() => void submitNewVersion()}
              className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 disabled:opacity-50 disabled:pointer-events-none"
            >
              {versionUploading ? (t.hazards_loading ?? "…") : (t.hazards_save ?? "Save")}
            </button>
          </div>
        </div>
      )}

      {historyOpen && selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50"
          role="dialog"
          aria-modal="true"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="h-full w-full max-w-md overflow-y-auto border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 px-4 py-3 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white pr-2">
                {t.blueprints_version_history ?? "Version history"}
              </h3>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-600"
                aria-label={t.hazards_close ?? "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              {[...sameNamePeers]
                .sort((a, b) => b.version - a.version)
                .map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-600 overflow-hidden bg-zinc-50/50 dark:bg-zinc-800/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.image_url}
                      alt=""
                      className="h-32 w-full object-cover border-b border-zinc-200 dark:border-zinc-600"
                    />
                    <div className="p-3 space-y-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                          V{row.version}
                        </span>
                        {row.is_active && (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {t.blueprints_version_active ?? "Active"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-medium text-zinc-600 dark:text-zinc-300">
                          {t.blueprints_version_author ?? "Author"}:{" "}
                        </span>
                        {row.created_by_name ?? "—"}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-medium text-zinc-600 dark:text-zinc-300">
                          {t.blueprints_version_date ?? "Date"}:{" "}
                        </span>
                        {formatBlueprintWhen(row.created_at, browserLocale)}
                      </p>
                      {row.version_notes && (
                        <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                          {row.version_notes}
                        </p>
                      )}
                      {canEditPins && (
                        <button
                          type="button"
                          onClick={() => void restoreVersion(row.id)}
                          className="w-full min-h-[44px] rounded-xl border border-amber-600 text-amber-800 dark:text-amber-300 text-sm font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        >
                          {t.blueprints_restore_version ?? "Restore as active"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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

      {annotationPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-sm max-h-[min(90vh,520px)] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-5 space-y-3 shadow-xl"
            style={{ borderTop: `4px solid ${annotationPopup.color}` }}
          >
            <div className="flex justify-between gap-2">
              <h4
                className={`font-semibold text-zinc-900 dark:text-white pr-2 ${
                  annotationPopup.is_resolved ? "line-through opacity-70" : ""
                }`}
              >
                {t.blueprints_notes_layer ?? "Note"}
              </h4>
              <button
                type="button"
                onClick={() => setAnnotationPopup(null)}
                className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-600"
                aria-label={t.hazards_close ?? "Close"}
              >
                <X className="h-5 w-5 mx-auto" />
              </button>
            </div>
            <p
              className={`text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap ${
                annotationPopup.is_resolved ? "line-through opacity-60" : ""
              }`}
            >
              {annotationPopup.content}
            </p>
            <div className="text-xs space-y-1 text-zinc-500 dark:text-zinc-400">
              <p>
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  {t.blueprints_note_author ?? "Author"}:{" "}
                </span>
                {annotationPopup.author_name ?? "—"}
              </p>
              <p>
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  {t.blueprints_version_date ?? "Date"}:{" "}
                </span>
                {formatBlueprintWhen(annotationPopup.created_at, browserLocale)}
              </p>
            </div>
            {annotationPopup.is_resolved && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {t.hazards_resolved ?? "Resolved"}
              </p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              {canEditAnnotation(annotationPopup) && !annotationPopup.is_resolved && (
                <button
                  type="button"
                  onClick={() => void resolveAnnotation(annotationPopup)}
                  className="min-h-[44px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold"
                >
                  {t.blueprints_note_resolved ?? "Mark as resolved"}
                </button>
              )}
              {canEditAnnotation(annotationPopup) && (
                <button
                  type="button"
                  onClick={() => void deleteAnnotation(annotationPopup)}
                  className="min-h-[44px] rounded-xl border border-red-600 text-red-700 dark:text-red-400 text-sm font-semibold"
                >
                  {t.blueprints_note_delete ?? "Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
