"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  FileText,
  Upload,
  ChevronLeft,
  MapPin,
  StickyNote,
  Camera,
  Hand,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  FolderInput,
} from "lucide-react";
import type {
  Blueprint,
  Annotation,
  BlueprintRevision,
  BlueprintCategory,
  AnnotationType,
  AnnotationColor,
} from "@/types/blueprints";

import * as pdfjsLib from "pdfjs-dist";
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

export interface BlueprintViewerProps {
  blueprints: Blueprint[];
  projects: { id: string; name: string }[];
  currentUserEmployeeId: string;
  currentUserName: string;
  canUpload: boolean;
  canAnnotate: boolean;
  onAddBlueprint: (bp: Blueprint) => void;
  onUpdateAnnotations: (blueprintId: string, annotations: Annotation[]) => void;
  onAddRevision: (blueprintId: string, revision: BlueprintRevision) => void;
  labels: { blueprints?: string; uploadPlan?: string; currentVersion?: string; blueprintVersion?: string };
  onMarkBlueprintNotCurrent?: (blueprintId: string) => void;
}

const CATEGORIES: { id: BlueprintCategory; label: string; color: string }[] = [
  { id: "architectural", label: "Arquitectura", color: "blue" },
  { id: "electrical", label: "Eléctrico", color: "amber" },
  { id: "structural", label: "Estructural", color: "red" },
  { id: "detail", label: "Detalles", color: "zinc" },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BlueprintViewer({
  blueprints,
  projects,
  currentUserEmployeeId,
  canUpload,
  canAnnotate,
  onAddBlueprint,
  onUpdateAnnotations,
  onAddRevision,
  labels,
  onMarkBlueprintNotCurrent,
}: BlueprintViewerProps) {
  const [view, setView] = useState<"list" | "viewer">("list");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<BlueprintCategory | "all">("all");
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState<BlueprintCategory>("architectural");
  const [uploadVersion, setUploadVersion] = useState("");
  const [uploadFileData, setUploadFileData] = useState("");
  const [uploadFileType, setUploadFileType] = useState<"pdf" | "image">("image");
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadAttempted, setUploadAttempted] = useState(false);
  const [activeRevisionIndex, setActiveRevisionIndex] = useState(0);
  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<"pin" | "note" | "photo" | "move">("pin");
  const [selectedColor, setSelectedColor] = useState<AnnotationColor>("red");
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [annotationModalOpen, setAnnotationModalOpen] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<{ x: number; y: number } | null>(null);
  const [annotationContent, setAnnotationContent] = useState("");
  const [annotationFilter, setAnnotationFilter] = useState<"all" | "open" | "resolved">("all");
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [planeSize, setPlaneSize] = useState({ width: 800, height: 600 });

  const filteredBlueprints = blueprints
    .filter((bp) => {
      if (selectedProjectId && bp.projectId !== selectedProjectId) return false;
      if (categoryFilter !== "all" && bp.category !== categoryFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.isCurrentVersion && !b.isCurrentVersion) return -1;
      if (!a.isCurrentVersion && b.isCurrentVersion) return 1;
      const numA = parseInt((a.version || "v0").replace(/\D/g, "") || "0", 10);
      const numB = parseInt((b.version || "v0").replace(/\D/g, "") || "0", 10);
      return numB - numA;
    });

  const currentBlueprint = selectedBlueprint;
  const currentRevision = currentBlueprint?.revisions?.[activeRevisionIndex] ?? currentBlueprint?.revisions?.find((r) => r.isCurrent) ?? currentBlueprint?.revisions?.[0];
  const isPdf = currentRevision?.fileType === "pdf";

  useEffect(() => {
    if (currentBlueprint) setLocalAnnotations(currentBlueprint.annotations ?? []);
  }, [currentBlueprint?.id, currentBlueprint?.annotations]);

  useEffect(() => {
    if (projects.length === 1 && !selectedProjectId) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const openViewer = (bp: Blueprint) => {
    setSelectedBlueprint(bp);
    setLocalAnnotations(bp.annotations ?? []);
    setActiveRevisionIndex(Math.max(0, bp.revisions?.findIndex((r) => r.isCurrent) ?? 0));
    setView("viewer");
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setSelectedAnnotation(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    setUploadLoading(true);

    const isPdf = file.type === "application/pdf";
    setUploadFileType(isPdf ? "pdf" : "image");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setUploadFileData(result ?? "");
      setUploadLoading(false);
    };
    reader.onerror = () => {
      setUploadLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSave = () => {
    setUploadAttempted(true);
    const versionTrim = (uploadVersion || "v1").trim() || "v1";
    if (!uploadName.trim() || !versionTrim || !uploadFileData || !selectedProjectId) return;

    const newBlueprint: Blueprint = {
      id: `bp${Date.now()}`,
      projectId: selectedProjectId,
      category: uploadCategory,
      name: uploadName.trim(),
      version: versionTrim,
      isCurrentVersion: true,
      revisions: [
        {
          revisionNumber: 1,
          fileData: uploadFileData,
          fileType: uploadFileType,
          fileName: uploadFileName || "file",
          uploadedAt: new Date().toISOString(),
          uploadedBy: currentUserEmployeeId,
          isCurrent: true,
        },
      ],
      annotations: [],
    };

    onAddBlueprint(newBlueprint);

    setUploadName("");
    setUploadCategory("architectural");
    setUploadVersion("");
    setUploadFileData("");
    setUploadFileName("");
    setUploadFileType("image");
    setUploadLoading(false);
    setUploadAttempted(false);
    setUploadModalOpen(false);
  };

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    setUploadAttempted(false);
    setUploadName("");
    setUploadCategory("architectural");
    setUploadVersion("");
    setUploadFileData("");
    setUploadFileName("");
    setUploadFileType("image");
    setUploadLoading(false);
  };

  const handleSaveNewRevision = () => {
    if (!currentBlueprint || !uploadFileData) return;
    const versionTrim = (uploadVersion || "v" + ((currentBlueprint.revisions?.length ?? 0) + 1)).trim() || "v2";
    onMarkBlueprintNotCurrent?.(currentBlueprint.id);
    const newBlueprint: Blueprint = {
      id: `bp${Date.now()}`,
      projectId: currentBlueprint.projectId,
      category: currentBlueprint.category,
      name: currentBlueprint.name,
      version: versionTrim,
      isCurrentVersion: true,
      revisions: [
        {
          revisionNumber: 1,
          fileData: uploadFileData,
          fileType: uploadFileType,
          fileName: uploadFileName || "file",
          uploadedAt: new Date().toISOString(),
          uploadedBy: currentUserEmployeeId,
          isCurrent: true,
        },
      ],
      annotations: [],
    };
    onAddBlueprint(newBlueprint);
    setRevisionModalOpen(false);
    setUploadVersion("");
    setUploadFileData("");
    setUploadFileName("");
    setUploadLoading(false);
    setView("list");
    setSelectedBlueprint(null);
  };


  const toggleResolved = (annId: string) => {
    const updated = localAnnotations.map((a) => (a.id === annId ? { ...a, resolved: !a.resolved } : a));
    setLocalAnnotations(updated);
    if (currentBlueprint) onUpdateAnnotations(currentBlueprint.id, updated);
    setSelectedAnnotation(null);
  };

  const deleteAnnotation = (annId: string) => {
    const updated = localAnnotations.filter((a) => a.id !== annId);
    setLocalAnnotations(updated);
    if (currentBlueprint) onUpdateAnnotations(currentBlueprint.id, updated);
    setSelectedAnnotation(null);
  };

  const handlePlanoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === "move" || !canAnnotate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingAnnotation({ x, y });
    setAnnotationContent("");
    setAnnotationModalOpen(true);
  };

  const handleSaveAnnotation = () => {
    if (!pendingAnnotation || !currentBlueprint) return;
    const content = activeTool === "photo" ? annotationContent : annotationContent.trim();
    if (!content && activeTool !== "photo") return;
    const newAnn: Annotation = {
      id: `ann${Date.now()}`,
      type: activeTool as AnnotationType,
      x: pendingAnnotation.x,
      y: pendingAnnotation.y,
      content: content || "(sin texto)",
      color: selectedColor,
      resolved: false,
      createdBy: currentUserEmployeeId,
      createdAt: new Date().toISOString(),
    };
    const updated = [...localAnnotations, newAnn];
    setLocalAnnotations(updated);
    onUpdateAnnotations(currentBlueprint.id, updated);
    setAnnotationModalOpen(false);
    setPendingAnnotation(null);
    setAnnotationContent("");
  };

  const exportAnnotations = () => {
    if (!currentBlueprint) return;
    const data = { blueprintId: currentBlueprint.id, blueprintName: currentBlueprint.name, projectId: currentBlueprint.projectId, exportedAt: new Date().toISOString(), annotations: localAnnotations };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notas-${currentBlueprint.name}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importAnnotations = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentBlueprint) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data.annotations)) {
          const merged = [...localAnnotations, ...data.annotations.filter((a: Annotation) => !localAnnotations.find((la) => la.id === a.id))];
          setLocalAnnotations(merged);
          onUpdateAnnotations(currentBlueprint.id, merged);
        }
      } catch {
        /* */
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const renderPdfPage = useCallback(
    async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
      if (!canvasRef.current || !currentRevision) return;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      setPlaneSize({ width: viewport.width, height: viewport.height });
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    },
    [currentRevision]
  );

  useEffect(() => {
    if (!currentRevision || currentRevision.fileType !== "pdf" || !currentRevision.fileData) return;
    let cancelled = false;
    const load = async () => {
      try {
        const rawBase64 = currentRevision.fileData.startsWith("data:")
          ? currentRevision.fileData.split(",")[1] ?? ""
          : currentRevision.fileData;
        const loadingTask = pdfjsLib.getDocument({ data: atob(rawBase64) });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        await renderPdfPage(pdf, 1);
      } catch {
        setTotalPages(1);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentRevision?.fileData, currentRevision?.fileType, renderPdfPage]);

  const goToPdfPage = (dir: number) => {
    if (!currentRevision || currentRevision.fileType !== "pdf") return;
    const rawBase64 = currentRevision.fileData.startsWith("data:")
      ? currentRevision.fileData.split(",")[1] ?? ""
      : currentRevision.fileData;
    const next = Math.max(1, Math.min(totalPages, currentPage + dir));
    setCurrentPage(next);
    pdfjsLib.getDocument({ data: atob(rawBase64) }).promise.then((pdf) => renderPdfPage(pdf, next));
  };

  const filteredAnnotations = annotationFilter === "open" ? localAnnotations.filter((a) => !a.resolved) : annotationFilter === "resolved" ? localAnnotations.filter((a) => a.resolved) : localAnnotations;
  const openCount = localAnnotations.filter((a) => !a.resolved).length;
  const resolvedCount = localAnnotations.filter((a) => a.resolved).length;

  const pinColorClass = (ann: Annotation) =>
    ann.resolved ? "bg-emerald-500" : ann.color === "red" ? "bg-red-500" : ann.color === "yellow" ? "bg-amber-500" : ann.color === "blue" ? "bg-blue-500" : "bg-emerald-500";

  if (view === "viewer" && currentBlueprint && currentRevision) {
    const naturalWidth = isPdf ? planeSize.width : 800;
    const naturalHeight = isPdf ? planeSize.height : 600;
    return (
      <section className="flex flex-col h-[calc(100vh-8rem)] rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-3 border-b border-zinc-200 dark:border-slate-700 flex-wrap">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setView("list")} className="flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium min-h-[44px]">
              <ChevronLeft className="h-4 w-4" /> Volver
            </button>
            <h2 className="font-semibold text-zinc-900 dark:text-white truncate max-w-[200px]">{currentBlueprint.name}</h2>
            <select value={activeRevisionIndex} onChange={(e) => setActiveRevisionIndex(Number(e.target.value))} className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm min-h-[44px]">
              {currentBlueprint.revisions?.map((rev, i) => (
                <option key={i} value={i}>Rev. {rev.revisionNumber}{rev.isCurrent ? " (actual)" : ""} · {new Date(rev.uploadedAt).toLocaleDateString("es")}</option>
              ))}
            </select>
            {canUpload && (
              <button type="button" onClick={() => { setUploadVersion("v" + ((currentBlueprint.revisions?.length ?? 0) + 1)); setRevisionModalOpen(true); }} className="rounded-lg bg-amber-600 text-white px-3 py-2 text-sm font-medium min-h-[44px]">Subir nueva revisión</button>
            )}
          </div>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 p-2 border-b border-zinc-200 dark:border-slate-700">
              {(["pin", "note", "photo", "move"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setActiveTool(t)} className={`p-2 rounded-lg border min-h-[44px] min-w-[44px] flex items-center justify-center ${activeTool === t ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-zinc-200 dark:border-slate-700"}`}>
                  {t === "pin" && <MapPin className="h-4 w-4" />}
                  {t === "note" && <StickyNote className="h-4 w-4" />}
                  {t === "photo" && <Camera className="h-4 w-4" />}
                  {t === "move" && <Hand className="h-4 w-4" />}
                </button>
              ))}
              {(["red", "yellow", "green", "blue"] as AnnotationColor[]).map((c) => (
                <button key={c} type="button" onClick={() => setSelectedColor(c)} className={`w-6 h-6 rounded-full border-2 ${selectedColor === c ? "border-zinc-900 dark:border-white scale-110" : "border-transparent"} ${c === "red" ? "bg-red-500" : c === "yellow" ? "bg-amber-500" : c === "green" ? "bg-emerald-500" : "bg-blue-500"}`} />
              ))}
              <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="p-2 rounded-lg border border-zinc-200 min-h-[44px] min-w-[44px] flex items-center justify-center"><ZoomIn className="h-4 w-4" /></button>
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="p-2 rounded-lg border border-zinc-200 min-h-[44px] min-w-[44px] flex items-center justify-center"><ZoomOut className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setZoom(1); setPanX(0); setPanY(0); }} className="p-2 rounded-lg border border-zinc-200 min-h-[44px] min-w-[44px] flex items-center justify-center"><RotateCcw className="h-4 w-4" /></button>
              <button type="button" onClick={exportAnnotations} className="p-2 rounded-lg border border-zinc-200 text-sm flex items-center gap-1 min-h-[44px]"><Download className="h-4 w-4" /> Exportar</button>
              <label className="p-2 rounded-lg border border-zinc-200 text-sm flex items-center gap-1 min-h-[44px] cursor-pointer"><FolderInput className="h-4 w-4" /> Importar <input type="file" accept=".json" className="hidden" onChange={importAnnotations} /></label>
            </div>
            <div ref={containerRef} className="flex-1 overflow-hidden relative bg-zinc-100 dark:bg-zinc-900" onWheel={(e) => { e.preventDefault(); setZoom((z) => Math.min(3, Math.max(0.5, z - e.deltaY * 0.001))); }} style={{ touchAction: "none" }}>
              <div className="absolute inset-0 overflow-auto flex items-start justify-start" onMouseDown={(e) => { if (activeTool === "move") { setIsPanning(true); setLastPos({ x: e.clientX - panX, y: e.clientY - panY }); } }} onMouseMove={(e) => { if (isPanning) { setPanX(e.clientX - lastPos.x); setPanY(e.clientY - lastPos.y); setLastPos({ x: e.clientX - panX, y: e.clientY - panY }); } }} onMouseUp={() => setIsPanning(false)} onMouseLeave={() => setIsPanning(false)}>
                <div className="relative origin-top-left cursor-crosshair" style={{ transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`, width: naturalWidth, height: naturalHeight, minWidth: naturalWidth, minHeight: naturalHeight }} onClick={handlePlanoClick}>
                  {isPdf ? (
                    <>
                      <canvas ref={canvasRef} width={naturalWidth} height={naturalHeight} className="block" />
                      {totalPages > 1 && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 text-white px-3 py-1.5 rounded-lg text-sm">
                          <button type="button" onClick={() => goToPdfPage(-1)} disabled={currentPage <= 1}>‹</button>
                          <span>{currentPage} / {totalPages}</span>
                          <button type="button" onClick={() => goToPdfPage(1)} disabled={currentPage >= totalPages}>›</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <img src={currentRevision.fileData.startsWith("data:") ? currentRevision.fileData : `data:${(currentRevision.fileName?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg")};base64,${currentRevision.fileData}`} alt={currentBlueprint.name} className="block max-w-none" style={{ width: naturalWidth, height: naturalHeight, objectFit: "contain" }} onLoad={(e) => { const img = e.currentTarget; setPlaneSize({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 }); }} />
                  )}
                </div>
                <div className="absolute top-0 left-0 pointer-events-none" style={{ width: naturalWidth * zoom, height: naturalHeight * zoom, transform: `translate(${panX}px, ${panY}px)` }}>
                  <div className="w-full h-full relative pointer-events-none">
                    {localAnnotations.map((ann) => {
                      const pinLeft = (ann.x / 100) * naturalWidth * zoom;
                      const pinTop = (ann.y / 100) * naturalHeight * zoom;
                      return (
                        <div key={ann.id} style={{ left: pinLeft, top: pinTop }} className="absolute -translate-x-1/2 -translate-y-full cursor-pointer z-10 pointer-events-auto" onClick={(e) => { e.stopPropagation(); setSelectedAnnotation(selectedAnnotation === ann.id ? null : ann.id); }}>
                          <div className={`w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold text-white ${pinColorClass(ann)}`}>{ann.type === "pin" ? "📍" : ann.type === "note" ? "📝" : "📷"}</div>
                          {selectedAnnotation === ann.id && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl z-20 pointer-events-auto">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex-1 min-w-0">{ann.content.startsWith("data:") ? <img src={ann.content} className="w-full rounded-lg max-h-24 object-contain" alt="foto" /> : <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 break-words">{ann.content}</p>}</div>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedAnnotation(null); }} className="shrink-0 text-zinc-400 hover:text-zinc-600"><X className="h-3 w-3" /></button>
                              </div>
                              <p className="text-xs text-zinc-400">{ann.createdBy} · {new Date(ann.createdAt).toLocaleDateString("es")}</p>
                              <div className="flex gap-1 mt-2">
                                <button type="button" onClick={(e) => { e.stopPropagation(); toggleResolved(ann.id); }} className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium ${ann.resolved ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600" : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700"}`}>{ann.resolved ? "Reabrir" : "Resolver ✓"}</button>
                                {canAnnotate && <button type="button" onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }} className="rounded-lg px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600">Eliminar</button>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="w-64 border-l border-zinc-200 dark:border-slate-700 flex flex-col bg-zinc-50 dark:bg-zinc-900/50 hidden sm:flex">
            <div className="p-2 border-b border-zinc-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Anotaciones</p>
              <p className="text-xs text-zinc-500">{openCount} abiertos · {resolvedCount} resueltos</p>
              <div className="flex gap-1 mt-2">
                {(["all", "open", "resolved"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setAnnotationFilter(f)} className={`rounded px-2 py-0.5 text-xs ${annotationFilter === f ? "bg-amber-500 text-white" : "bg-zinc-200 dark:bg-zinc-700"}`}>{f === "all" ? "Todos" : f === "open" ? "Abiertos" : "Resueltos"}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredAnnotations.map((ann) => (
                <button key={ann.id} type="button" onClick={() => setSelectedAnnotation(ann.id)} className={`w-full text-left rounded-lg border px-2 py-1.5 text-xs ${selectedAnnotation === ann.id ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-zinc-200 dark:border-slate-700"}`}>
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${pinColorClass(ann)}`} />
                  {ann.type === "pin" ? "Pin" : ann.type === "note" ? "Nota" : "Foto"} · {(ann.content.startsWith("data:") ? "[imagen]" : ann.content).slice(0, 30)}
                  {ann.resolved ? <span className="ml-1 text-emerald-600">Resuelto</span> : <span className="ml-1 text-red-600">Abierto</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
        {annotationModalOpen && pendingAnnotation && (
          <>
            <div className="fixed inset-0 z-50 bg-black/50" aria-hidden onClick={() => { setAnnotationModalOpen(false); setPendingAnnotation(null); }} />
            <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl">
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-3">Nueva anotación</h4>
              {activeTool === "photo" ? <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) fileToDataUrl(f).then(setAnnotationContent); }} className="text-sm mb-3" /> : <textarea value={annotationContent} onChange={(e) => setAnnotationContent(e.target.value)} placeholder="Texto..." rows={3} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm mb-3" />}
              <div className="flex gap-2 mb-3">
                {(["red", "yellow", "green", "blue"] as AnnotationColor[]).map((c) => (
                  <button key={c} type="button" onClick={() => setSelectedColor(c)} className={`w-8 h-8 rounded-full ${c === "red" ? "bg-red-500" : c === "yellow" ? "bg-amber-500" : c === "green" ? "bg-emerald-500" : "bg-blue-500"} ${selectedColor === c ? "ring-2 ring-offset-2 ring-zinc-900" : ""}`} />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setAnnotationModalOpen(false); setPendingAnnotation(null); }} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">Cancelar</button>
                <button type="button" onClick={handleSaveAnnotation} className="rounded-lg bg-amber-600 text-white px-3 py-2 text-sm">Guardar</button>
              </div>
            </div>
          </>
        )}
        {revisionModalOpen && currentBlueprint && (
          <>
            <div className="fixed inset-0 z-50 bg-black/50" aria-hidden onClick={() => setRevisionModalOpen(false)} />
            <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
              <h3 className="text-lg font-semibold mb-4">Subir nueva revisión</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">{labels.blueprintVersion ?? "Versión del plano"} *</label>
                <input type="text" value={uploadVersion} onChange={(e) => setUploadVersion(e.target.value)} placeholder="v2" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 min-h-[44px]" />
              </div>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="block w-full text-sm mb-4" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRevisionModalOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
                <button type="button" onClick={handleSaveNewRevision} disabled={!uploadFileData || uploadLoading} className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm disabled:opacity-50">
                  {uploadLoading ? "Procesando…" : "Guardar"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-500" />
          {labels.blueprints ?? "Planos"}
        </h2>
        <div className="flex items-center gap-2">
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]">
            <option value="">Todos los proyectos</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          {canUpload && (
            <button type="button" onClick={() => setUploadModalOpen(true)} className="flex items-center gap-2 rounded-lg bg-amber-600 text-white px-4 py-2.5 text-sm font-medium min-h-[44px]">
              <Upload className="h-4 w-4" />
              {labels.uploadPlan ?? "Subir plano"}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-4 border-b border-zinc-200 dark:border-slate-700 pb-2">
        <button type="button" onClick={() => setCategoryFilter("all")} className={`px-3 py-2 rounded-t-lg text-sm font-medium ${categoryFilter === "all" ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>Todos</button>
        {CATEGORIES.map(({ id, label, color }) => (
          <button key={id} type="button" onClick={() => setCategoryFilter(id)} className={`px-3 py-2 rounded-t-lg text-sm font-medium ${categoryFilter === id ? color === "blue" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : color === "amber" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : color === "red" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>{label}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBlueprints.map((bp) => {
          const currentRev = bp.revisions?.find((r) => r.isCurrent) ?? bp.revisions?.[0];
          const openAnn = (bp.annotations ?? []).filter((a) => !a.resolved).length;
          const cat = CATEGORIES.find((c) => c.id === bp.category);
          const catColor = cat?.color ?? "zinc";
          const isCurrent = bp.isCurrentVersion === true;
          return (
            <div key={bp.id} className={`rounded-xl border p-4 flex flex-col gap-2 ${isCurrent ? "border-amber-400 dark:border-amber-500 ring-1 ring-amber-200 dark:ring-amber-800" : "border-zinc-200 dark:border-slate-700"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-zinc-900 dark:text-white">{bp.name}</p>
                {isCurrent ? (
                  <span className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {labels.currentVersion ?? "Vigente"}
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {bp.version || "—"}
                  </span>
                )}
              </div>
              <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${catColor === "blue" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700" : catColor === "amber" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700" : catColor === "red" ? "bg-red-100 dark:bg-red-900/30 text-red-700" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700"}`}>{cat?.label ?? bp.category}</span>
              <p className="text-xs text-zinc-500">Rev. {currentRev?.revisionNumber ?? 1} · {currentRev?.uploadedAt ? new Date(currentRev.uploadedAt).toLocaleDateString("es") : "—"}</p>
              {!isCurrent && (
                <span className="inline-flex w-fit rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium px-2 py-0.5">
                  No vigente
                </span>
              )}
              {openAnn > 0 && <span className="inline-flex w-fit rounded-full bg-red-500 text-white text-xs font-bold px-2 py-0.5">{openAnn} abiertos</span>}
              <button type="button" onClick={() => openViewer(bp)} className="mt-auto rounded-lg bg-amber-600 text-white px-3 py-2 text-sm font-medium min-h-[44px]">Ver plano</button>
            </div>
          );
        })}
      </div>
      {filteredBlueprints.length === 0 && <p className="text-center text-zinc-500 py-8">No hay planos. Sube uno para comenzar.</p>}
      {uploadModalOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" aria-hidden onClick={closeUploadModal} />
          <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Subir plano</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Proyecto *</label>
                <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]">
                  <option value="">Seleccionar…</option>
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nombre del plano *</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 ${
                    uploadAttempted && !uploadName.trim()
                      ? "border-red-400 focus:ring-red-400"
                      : "border-zinc-300 dark:border-zinc-600 focus:ring-amber-500"
                  }`}
                  placeholder="Ej: Planta baja"
                />
                {uploadAttempted && !uploadName.trim() && (
                  <p className="text-xs text-red-500 mt-1">
                    El nombre del plano es obligatorio
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{labels.blueprintVersion ?? "Versión del plano"} *</label>
                <input
                  type="text"
                  value={uploadVersion}
                  onChange={(e) => setUploadVersion(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                  placeholder="v1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Categoría</label>
                <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as BlueprintCategory)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]">
                  {CATEGORIES.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Archivo * (PDF, JPG, PNG)
                </label>
                <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-slate-800/50 cursor-pointer hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors">
                  {uploadFileData ? (
                    <div className="text-center px-4">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        ✓ {uploadFileName}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {uploadFileType === "pdf" ? "PDF" : "Imagen"} listo
                      </p>
                    </div>
                  ) : uploadLoading ? (
                    <p className="text-sm text-zinc-500 animate-pulse">
                      Procesando archivo…
                    </p>
                  ) : (
                    <div className="text-center px-4">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Arrastra o haz clic para seleccionar
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        PDF, JPG o PNG · máx. 10MB
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={closeUploadModal} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm min-h-[44px]">Cancelar</button>
              <button
                type="button"
                onClick={handleUploadSave}
                disabled={uploadLoading}
                className="rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-white min-h-[44px] transition-colors"
              >
                {uploadLoading ? "Procesando…" : "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
