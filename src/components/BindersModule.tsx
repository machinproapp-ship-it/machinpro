"use client";

import { useState } from "react";
import {
  Shield,
  FileWarning,
  Mail,
  ListChecks,
  Award,
  FolderOpen,
  Plus,
  Trash2,
  ExternalLink,
  ArrowLeft,
  FileText,
  Image,
  FileCode,
  File,
  X,
} from "lucide-react";
import type { Binder, BinderDocument } from "@/types/binders";

type BindersView = "list" | "binder";

const BINDER_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  shield: Shield,
  "file-warning": FileWarning,
  mail: Mail,
  "list-checks": ListChecks,
  award: Award,
  folder: FolderOpen,
};

const FILE_TYPE_ICONS: Record<BinderDocument["fileType"], React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  image: Image,
  doc: FileCode,
  other: File,
};

export interface BindersModuleProps {
  binders: Binder[];
  documents: BinderDocument[];
  canManage: boolean;
  currentUserRole: string;
  employees: { id: string; name: string }[];
  roleOptions?: { id: string; name: string }[];
  labels: Record<string, string>;
  onAddBinder: (b: Binder) => void;
  onDeleteBinder: (id: string) => void;
  onAddDocument: (d: BinderDocument) => void;
  onDeleteDocument: (id: string) => void;
}

export function BindersModule({
  binders,
  documents,
  canManage,
  currentUserRole,
  employees,
  roleOptions = [],
  labels,
  onAddBinder,
  onDeleteBinder,
  onAddDocument,
  onDeleteDocument,
}: BindersModuleProps) {
  const [view, setView] = useState<BindersView>("list");
  const [selectedBinder, setSelectedBinder] = useState<Binder | null>(null);
  const [addBinderOpen, setAddBinderOpen] = useState(false);
  const [addDocumentOpen, setAddDocumentOpen] = useState(false);

  const openBinder = (binder: Binder) => {
    setSelectedBinder(binder);
    setView("binder");
  };

  const goBack = () => {
    setView("list");
    setSelectedBinder(null);
  };

  const docsInBinder = selectedBinder
    ? documents.filter((d) => d.binderId === selectedBinder.id)
    : [];
  const docCount = (b: Binder) => documents.filter((d) => d.binderId === b.id).length;

  const deleteBinder = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteBinder(id);
  };

  const deleteDoc = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    onDeleteDocument(id);
  };

  return (
    <div className="space-y-6">
      {view === "list" && (
        <>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {labels.binders ?? "Documentos"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {binders.map((binder) => {
              const IconComp = BINDER_ICONS[binder.icon] ?? FolderOpen;
              const count = docCount(binder);
              return (
                <div
                  key={binder.id}
                  onClick={() => openBinder(binder)}
                  className="cursor-pointer rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 hover:shadow-md hover:border-amber-300 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="rounded-xl p-2.5"
                      style={{ backgroundColor: binder.color + "20" }}
                    >
                      <IconComp
                        className="h-5 w-5"
                        style={{ color: binder.color }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
                        {binder.name}
                      </h3>
                      <p className="text-xs text-zinc-500 truncate">
                        {(labels as Record<string, string>)[binder.category === "health_safety" ? "healthSafetyDesc" : binder.category === "safety_data" ? "safetyDataDesc" : `${binder.category}Desc`] ?? binder.description ?? ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {count} {labels.documents ?? "documentos"}
                    </span>
                    {!binder.isDefault && canManage && (
                      <button
                        type="button"
                        onClick={(e) => deleteBinder(e, binder.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        aria-label={labels.delete ?? "Eliminar"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {canManage && (
              <button
                type="button"
                onClick={() => setAddBinderOpen(true)}
                className="rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 p-5 hover:border-amber-400 transition-colors flex flex-col items-center justify-center gap-2 text-zinc-400 hover:text-amber-500 min-h-[120px]"
              >
                <Plus className="h-6 w-6" />
                <span className="text-sm font-medium">
                  {labels.newBinder ?? "Nueva carpeta"}
                </span>
              </button>
            )}
          </div>
        </>
      )}

      {view === "binder" && selectedBinder && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={goBack}
              className="p-2 rounded-lg border border-zinc-200 dark:border-slate-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex-1 truncate">
              {selectedBinder.name}
            </h2>
            {canManage && (
              <button
                type="button"
                onClick={() => setAddDocumentOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-amber-500 text-amber-600 dark:text-amber-400 px-3 py-2 text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-900/20"
              >
                <Plus className="h-4 w-4" />
                {labels.addDocument ?? "Añadir documento"}
              </button>
            )}
          </div>

          {docsInBinder.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
              <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                {labels.noDocuments ?? "Sin documentos en esta carpeta"}
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setAddDocumentOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-white px-4 py-2 text-sm font-medium hover:bg-amber-600"
                >
                  <Plus className="h-4 w-4" />
                  {labels.addDocument ?? "Añadir documento"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {docsInBinder.map((doc) => {
                const FileIcon = FILE_TYPE_ICONS[doc.fileType];
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-sm transition-all"
                  >
                    <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <FileIcon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-zinc-500">
                        {doc.uploadedAt}
                        {doc.fileSize ? ` · ${doc.fileSize}` : ""}
                        {doc.version ? ` · v${doc.version}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          aria-label={labels.addDocument ?? "Abrir"}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {doc.isRequired && (
                        <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full px-2 py-0.5">
                          {labels.required ?? "Obligatorio"}
                        </span>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          onClick={(e) => deleteDoc(e, doc.id)}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          aria-label={labels.delete ?? "Eliminar"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {addDocumentOpen && (
            <AddDocumentModal
              binderId={selectedBinder.id}
              binderName={selectedBinder.name}
              roleOptions={roleOptions}
              employees={employees}
              labels={labels}
              onClose={() => setAddDocumentOpen(false)}
              onSave={(d) => {
                onAddDocument(d);
                setAddDocumentOpen(false);
              }}
            />
          )}
        </>
      )}

      {addBinderOpen && (
        <AddBinderModal
          labels={labels}
          onClose={() => setAddBinderOpen(false)}
          onSave={(b) => {
            onAddBinder(b);
            setAddBinderOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Modal: Añadir Binder ───────────────────────────────────────────────────────

interface AddBinderModalProps {
  labels: Record<string, string>;
  onClose: () => void;
  onSave: (b: Binder) => void;
}

function AddBinderModal({ labels, onClose, onSave }: AddBinderModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8b5cf6");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const binder: Binder = {
      id: "b-" + Date.now(),
      name: name.trim(),
      category: "custom",
      description: description.trim() || undefined,
      color,
      icon: "folder",
      isDefault: false,
      createdAt: new Date().toISOString(),
      documentCount: 0,
    };
    onSave(binder);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {labels.newBinder ?? "Nueva carpeta"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {(labels as Record<string, string>).name ?? (labels as Record<string, string>).binderName ?? "Nombre"}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {labels.description ?? "Descripción"}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {(labels as Record<string, string>).color ?? (labels as Record<string, string>).roleColor ?? "Color"}
            </label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full h-10 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium"
            >
              {labels.cancel ?? "Cancelar"}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600"
            >
              {labels.save ?? "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Modal: Añadir Documento ────────────────────────────────────────────────────

interface AddDocumentModalProps {
  binderId: string;
  binderName: string;
  roleOptions: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  labels: Record<string, string>;
  onClose: () => void;
  onSave: (d: BinderDocument) => void;
}

const FILE_TYPES: { value: BinderDocument["fileType"]; labelKey: string }[] = [
  { value: "pdf", labelKey: "PDF" },
  { value: "image", labelKey: "image" },
  { value: "doc", labelKey: "doc" },
  { value: "other", labelKey: "other" },
];

function AddDocumentModal({
  binderId,
  roleOptions,
  employees,
  labels,
  onClose,
  onSave,
}: AddDocumentModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fileType, setFileType] = useState<BinderDocument["fileType"]>("pdf");
  const [fileUrl, setFileUrl] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [version, setVersion] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [visibleToRoles, setVisibleToRoles] = useState<string[]>([]);

  const toggleRole = (roleId: string) => {
    setVisibleToRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const uploader = employees[0]?.name ?? "Admin";
    const doc: BinderDocument = {
      id: "doc-" + Date.now(),
      binderId,
      name: name.trim(),
      description: description.trim() || undefined,
      fileType,
      fileUrl: fileUrl.trim() || undefined,
      fileSize: fileSize.trim() || undefined,
      uploadedBy: uploader,
      uploadedAt: new Date().toISOString().slice(0, 10),
      version: version.trim() || undefined,
      isRequired,
      visibleToRoles: visibleToRoles.length > 0 ? visibleToRoles : roleOptions.map((r) => r.id),
    };
    onSave(doc);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {labels.addDocument ?? "Añadir documento"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {(labels as Record<string, string>).docName ?? "Nombre del documento"}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {labels.description ?? "Descripción"}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {labels.category ?? "Tipo"}
            </label>
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value as BinderDocument["fileType"])}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {FILE_TYPES.map(({ value, labelKey }) => (
                <option key={value} value={value}>
                  {labels[labelKey] ?? value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {labels.fileUrl ?? "URL del archivo"}
            </label>
            <input
              type="text"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {labels.fileSize ?? "Tamaño"}
            </label>
            <input
              type="text"
              value={fileSize}
              onChange={(e) => setFileSize(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              placeholder="2.3 MB"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {labels.version ?? "Versión"}
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="doc-required"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <label htmlFor="doc-required" className="text-sm">
              {labels.required ?? "Obligatorio"}
            </label>
          </div>
          {roleOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {labels.visibleToRoles ?? "Visible para roles"}
              </label>
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleToRoles.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      className="rounded border-zinc-300"
                    />
                    {role.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium"
            >
              {labels.cancel ?? "Cancelar"}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600"
            >
              {labels.save ?? "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
