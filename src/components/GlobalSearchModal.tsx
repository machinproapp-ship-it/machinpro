"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, FileText, FolderKanban, Search, Truck, Users, X } from "lucide-react";

const MAX_PER_CATEGORY = 5;
const DEBOUNCE_MS = 300;

export type GlobalSearchFlags = {
  employees: boolean;
  projects: boolean;
  vehicles: boolean;
  suppliers: boolean;
  documents: boolean;
};

export interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  labels: Record<string, string>;
  employees: { id: string; name: string; email?: string | null }[];
  projects: { id: string; name: string }[];
  vehicles: { id: string; plate: string }[];
  suppliers: { id: string; name: string }[];
  binderDocuments: { id: string; name: string; binderId: string }[];
  binders: { id: string; name: string }[];
  flags: GlobalSearchFlags;
  onSelectEmployee: (id: string) => void;
  onSelectProject: (id: string) => void;
  onSelectVehicle: (id: string) => void;
  onSelectSupplier: (id: string) => void;
  onSelectDocument: (docId: string, binderId: string) => void;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function matches(q: string, ...parts: (string | undefined | null)[]): boolean {
  if (!q) return true;
  const n = norm(q);
  return parts.some((p) => p && norm(String(p)).includes(n));
}

export function GlobalSearchModal({
  open,
  onClose,
  labels: L,
  employees,
  projects,
  vehicles,
  suppliers,
  binderDocuments,
  binders,
  flags,
  onSelectEmployee,
  onSelectProject,
  onSelectVehicle,
  onSelectSupplier,
  onSelectDocument,
}: GlobalSearchModalProps) {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setInput("");
      setDebounced("");
      return;
    }
    const t = window.setTimeout(() => setDebounced(input.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [input, open]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const binderName = useCallback(
    (binderId: string) => binders.find((b) => b.id === binderId)?.name ?? "",
    [binders]
  );

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const sections = useMemo(() => {
    const q = debounced;
    if (q.length < 1) return [];
    const out: {
      key: string;
      label: string;
      icon: typeof Users;
      rows: { id: string; title: string; subtitle?: string; onPick: () => void }[];
    }[] = [];

    if (flags.employees) {
      const rows = employees
        .filter((e) => matches(q, e.name, e.email))
        .slice(0, MAX_PER_CATEGORY)
        .map((e) => ({
          id: e.id,
          title: e.name,
          subtitle: e.email ?? undefined,
          onPick: () => onSelectEmployee(e.id),
        }));
      if (rows.length || q.length > 0) {
        out.push({ key: "emp", label: L.search_employees ?? "Employees", icon: Users, rows });
      }
    }

    if (flags.projects) {
      const rows = projects
        .filter((p) => matches(q, p.name))
        .slice(0, MAX_PER_CATEGORY)
        .map((p) => ({
          id: p.id,
          title: p.name,
          onPick: () => onSelectProject(p.id),
        }));
      if (rows.length || q.length > 0) {
        out.push({
          key: "proj",
          label: L.search_projects ?? "Projects",
          icon: FolderKanban,
          rows,
        });
      }
    }

    if (flags.vehicles) {
      const rows = vehicles
        .filter((v) => matches(q, v.plate))
        .slice(0, MAX_PER_CATEGORY)
        .map((v) => ({
          id: v.id,
          title: v.plate || v.id,
          onPick: () => onSelectVehicle(v.id),
        }));
      if (rows.length || q.length > 0) {
        out.push({ key: "veh", label: L.search_vehicles ?? "Vehicles", icon: Truck, rows });
      }
    }

    if (flags.suppliers) {
      const rows = suppliers
        .filter((s) => matches(q, s.name))
        .slice(0, MAX_PER_CATEGORY)
        .map((s) => ({
          id: s.id,
          title: s.name,
          onPick: () => onSelectSupplier(s.id),
        }));
      if (rows.length || q.length > 0) {
        out.push({
          key: "sup",
          label: L.search_suppliers ?? "Suppliers",
          icon: Building2,
          rows,
        });
      }
    }

    if (flags.documents) {
      const rows = binderDocuments
        .filter((d) => matches(q, d.name, binderName(d.binderId)))
        .slice(0, MAX_PER_CATEGORY)
        .map((d) => ({
          id: d.id,
          title: d.name,
          subtitle: binderName(d.binderId),
          onPick: () => onSelectDocument(d.id, d.binderId),
        }));
      if (rows.length || q.length > 0) {
        out.push({
          key: "doc",
          label: L.search_documents ?? "Documents",
          icon: FileText,
          rows,
        });
      }
    }

    return out;
  }, [
    L,
    binderDocuments,
    binderName,
    debounced,
    employees,
    flags.documents,
    flags.employees,
    flags.projects,
    flags.suppliers,
    flags.vehicles,
    onSelectDocument,
    onSelectEmployee,
    onSelectProject,
    onSelectSupplier,
    onSelectVehicle,
    projects,
    suppliers,
    vehicles,
  ]);

  const anyResults = sections.some((s) => s.rows.length > 0);
  const showEmpty = debounced.length >= 1 && !anyResults;

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[120] bg-black/50 touch-none"
        aria-label={L.common_close ?? "Close"}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={L.search_global ?? "Search"}
        className="fixed z-[121] flex max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-x-hidden border-zinc-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 max-sm:inset-0 max-sm:rounded-none sm:left-1/2 sm:top-[8vh] sm:max-h-[min(85vh,720px)] sm:w-[min(100%,calc(100vw-2rem),28rem)] sm:-translate-x-1/2 sm:rounded-2xl sm:border lg:max-w-2xl"
      >
        <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-slate-700 md:px-6">
          <Search className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={L.search_global ?? "Search…"}
            className="min-h-[44px] min-w-0 flex-1 border-0 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
            aria-label={L.common_close ?? "Close"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 md:px-6 md:py-4">
          {debounced.length < 1 ? (
            <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {L.search_type_hint ?? L.search_global ?? "Type to search"}
            </p>
          ) : showEmpty ? (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {L.search_no_results ?? "No results"}
            </p>
          ) : (
            <div className="space-y-5">
              {sections.map((sec) => (
                <div key={sec.key}>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <sec.icon className="h-3.5 w-3.5" aria-hidden />
                    {sec.label}
                  </div>
                  {sec.rows.length === 0 ? (
                    <p className="text-sm text-zinc-400 dark:text-zinc-500">—</p>
                  ) : (
                    <ul className="space-y-1">
                      {sec.rows.map((r) => (
                        <li key={`${sec.key}-${r.id}`}>
                          <button
                            type="button"
                            onClick={() => {
                              r.onPick();
                              onClose();
                            }}
                            className="flex min-h-[44px] w-full flex-col items-start justify-center rounded-xl border border-transparent px-3 py-2 text-left text-sm hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/80"
                          >
                            <span className="font-medium text-zinc-900 dark:text-white">{r.title}</span>
                            {r.subtitle ? (
                              <span className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                                {r.subtitle}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="shrink-0 border-t border-zinc-100 px-4 py-2 text-center text-[11px] text-zinc-400 dark:border-slate-800 dark:text-zinc-500 md:px-6">
          {L.search_kb_hint ?? "Ctrl+K"}
        </p>
      </div>
    </>
  );
}
