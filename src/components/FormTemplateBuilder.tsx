"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Eye,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type {
  FieldType,
  FormField,
  FormSection,
  FormTemplate,
  InspectionTableRow,
} from "@/types/forms";
import { FormFieldInput } from "@/components/FormFieldInput";
import { resolveFormLabel } from "@/lib/formTemplateDisplay";
import { ALL_TRANSLATIONS } from "@/lib/i18n";

const PM_EN = ALL_TRANSLATIONS.en as Record<string, string>;

const BUILDER_FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "time",
  "select",
  "multiselect",
  "radio",
  "inspection_table",
  "photo",
  "signature",
];

const BUILDER_CATEGORIES = [
  "form_cat_inspection",
  "form_cat_safety",
  "form_cat_meeting",
  "form_cat_permit",
  "form_cat_custom",
] as const;

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyField(type: FieldType = "text"): FormField {
  const base: FormField = {
    id: newId("fld"),
    type,
    label: "",
    required: false,
  };
  if (type === "select" || type === "multiselect" || type === "radio") {
    return { ...base, options: [""] };
  }
  if (type === "inspection_table") {
    return {
      ...base,
      options: ["pass", "fail", "na"],
      rows: [{ id: newId("row"), label: "" }],
      columns: [
        { id: "status", label: "form_insp_col_status", kind: "select" },
        { id: "notes", label: "form_insp_col_notes", kind: "text" },
      ],
    };
  }
  return base;
}

export function FormTemplateBuilder({
  labels,
  currentUserEmployeeId,
  onBack,
  onSaveTemplate,
}: {
  labels: Record<string, string>;
  currentUserEmployeeId: string;
  onBack: () => void;
  onSaveTemplate: (tpl: FormTemplate) => void;
}) {
  const t = { ...PM_EN, ...labels } as Record<string, string>;
  const l = (k: string) => t[k] ?? PM_EN[k] ?? k;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("form_cat_inspection");
  const [sections, setSections] = useState<FormSection[]>([]);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeFieldIdx, setActiveFieldIdx] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);

  useEffect(() => {
    if (sections.length === 0) {
      setActiveSectionIdx(0);
      return;
    }
    setActiveSectionIdx((i) => Math.min(Math.max(0, i), sections.length - 1));
  }, [sections.length]);

  const activeSection = sections[activeSectionIdx] ?? null;
  const activeField =
    activeSection && activeFieldIdx != null ? activeSection.fields[activeFieldIdx] ?? null : null;

  const draftTemplate: FormTemplate = useMemo(
    () => ({
      id: "draft-preview",
      name: name.trim() || PM_EN.form_builder_untitled || "Template",
      description: description.trim() || undefined,
      region: ["GLOBAL"],
      category,
      isBase: false,
      requiresAllSignatures: false,
      expiresInHours: 72,
      createdAt: new Date().toISOString(),
      createdBy: currentUserEmployeeId,
      language: "en",
      sections,
    }),
    [name, description, category, sections, currentUserEmployeeId]
  );

  const addSection = () => {
    const sec: FormSection = {
      id: newId("sec"),
      title: "",
      fields: [],
    };
    setSections((prev) => [...prev, sec]);
    setActiveSectionIdx(sections.length);
    setActiveFieldIdx(null);
  };

  const moveSection = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= sections.length) return;
    setSections((prev) => {
      const next = [...prev];
      const [s] = next.splice(from, 1);
      next.splice(to, 0, s);
      return next;
    });
    setActiveSectionIdx(to);
  };

  const updateSectionTitle = (idx: number, title: string) => {
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, title } : s))
    );
  };

  const removeSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
    setActiveFieldIdx(null);
  };

  const addField = () => {
    if (!activeSection) return;
    const field = emptyField();
    setSections((prev) =>
      prev.map((s, i) =>
        i === activeSectionIdx ? { ...s, fields: [...s.fields, field] } : s
      )
    );
    setActiveFieldIdx(activeSection.fields.length);
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      setMobileConfigOpen(true);
    }
  };

  const moveField = (secIdx: number, fieldIdx: number, dir: -1 | 1) => {
    setSections((prev) =>
      prev.map((s, si) => {
        if (si !== secIdx) return s;
        const to = fieldIdx + dir;
        if (to < 0 || to >= s.fields.length) return s;
        const f = [...s.fields];
        const [x] = f.splice(fieldIdx, 1);
        f.splice(to, 0, x);
        return { ...s, fields: f };
      })
    );
    setActiveFieldIdx((i) => (i == null ? i : i + dir));
  };

  const removeField = (secIdx: number, fieldIdx: number) => {
    setSections((prev) =>
      prev.map((s, si) =>
        si === secIdx ? { ...s, fields: s.fields.filter((_, fi) => fi !== fieldIdx) } : s
      )
    );
    setActiveFieldIdx(null);
  };

  const patchActiveField = useCallback(
    (patch: Partial<FormField>) => {
      if (activeSectionIdx < 0 || activeFieldIdx == null || !activeField) return;
      setSections((prev) =>
        prev.map((s, si) => {
          if (si !== activeSectionIdx) return s;
          return {
            ...s,
            fields: s.fields.map((f, fi) =>
              fi === activeFieldIdx ? { ...f, ...patch } : f
            ),
          };
        })
      );
    },
    [activeSectionIdx, activeFieldIdx, activeField]
  );

  const patchInspectionRow = (rowIdx: number, label: string) => {
    if (!activeField || activeField.type !== "inspection_table") return;
    const rows = [...(activeField.rows ?? [])];
    rows[rowIdx] = { ...rows[rowIdx], label };
    patchActiveField({ rows });
  };

  const addInspectionRow = () => {
    if (!activeField || activeField.type !== "inspection_table") return;
    patchActiveField({
      rows: [...(activeField.rows ?? []), { id: newId("row"), label: "" }],
    });
  };

  const removeInspectionRow = (rowIdx: number) => {
    if (!activeField || activeField.type !== "inspection_table") return;
    const rows = (activeField.rows ?? []).filter((_, i) => i !== rowIdx);
    patchActiveField({ rows: rows.length ? rows : [{ id: newId("row"), label: "" }] });
  };

  const patchOption = (optIdx: number, val: string) => {
    if (!activeField) return;
    const opts = [...(activeField.options ?? [])];
    opts[optIdx] = val;
    patchActiveField({ options: opts });
  };

  const addOption = () => {
    if (!activeField) return;
    patchActiveField({ options: [...(activeField.options ?? []), ""] });
  };

  const removeOption = (optIdx: number) => {
    if (!activeField?.options) return;
    const opts = activeField.options.filter((_, i) => i !== optIdx);
    patchActiveField({ options: opts.length ? opts : [""] });
  };

  const changeFieldType = (nextType: FieldType) => {
    if (activeFieldIdx == null || activeSectionIdx < 0) return;
    setSections((prev) =>
      prev.map((s, si) => {
        if (si !== activeSectionIdx) return s;
        return {
          ...s,
          fields: s.fields.map((f, fi) => {
            if (fi !== activeFieldIdx) return f;
            return { ...emptyField(nextType), id: f.id };
          }),
        };
      })
    );
  };

  const handleSave = () => {
    if (!name.trim() || sections.length === 0) return;
    const tpl: FormTemplate = {
      id: `tpl-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      region: ["GLOBAL"],
      category,
      isBase: false,
      requiresAllSignatures: false,
      expiresInHours: 72,
      createdAt: new Date().toISOString(),
      createdBy: currentUserEmployeeId,
      language: "en",
      sections: sections.map((s) => ({
        ...s,
        fields: s.fields.map((f) => {
          if (f.type === "inspection_table") {
            return {
              ...f,
              rows: (f.rows ?? []).filter((r) => r.label.trim()),
            };
          }
          if (f.options) {
            return { ...f, options: f.options.filter((o) => o.trim()) };
          }
          return f;
        }),
      })),
    };
    onSaveTemplate(tpl);
    onBack();
  };

  const fieldConfigPanel = activeField ? (
    <div className="space-y-4 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
        {l("form_builder_field_settings")}
      </h3>
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          {l("form_builder_field_type")}
        </label>
        <select
          value={activeField.type}
          onChange={(e) => changeFieldType(e.target.value as FieldType)}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
        >
          {BUILDER_FIELD_TYPES.map((ft) => (
            <option key={ft} value={ft}>
              {l(`form_builder_ft_${ft}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          {l("form_builder_field_label")}
        </label>
        <input
          type="text"
          value={activeField.label}
          onChange={(e) => patchActiveField({ label: e.target.value })}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 min-h-[44px]">
        <input
          type="checkbox"
          checked={activeField.required}
          onChange={(e) => patchActiveField({ required: e.target.checked })}
          className="h-4 w-4 rounded"
        />
        {l("form_builder_field_required")}
      </label>
      {activeField.type === "photo" && (
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 min-h-[44px]">
          <input
            type="checkbox"
            checked={!!activeField.multiple}
            onChange={(e) => patchActiveField({ multiple: e.target.checked })}
            className="h-4 w-4 rounded"
          />
          {l("form_builder_photo_multiple")}
        </label>
      )}
      {["select", "multiselect", "radio"].includes(activeField.type) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {l("form_builder_options")}
          </p>
          {(activeField.options ?? []).map((opt, oi) => (
            <div key={oi} className="flex gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => patchOption(oi, e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => removeOption(oi)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-red-500"
                aria-label={l("forms_delete_template")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="text-sm text-amber-600 dark:text-amber-400 min-h-[44px]"
          >
            + {l("form_builder_add_option")}
          </button>
        </div>
      )}
      {activeField.type === "inspection_table" && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {l("form_builder_inspection_rows")}
          </p>
          {(activeField.rows ?? []).map((row: InspectionTableRow, ri) => (
            <div key={row.id} className="flex gap-2">
              <input
                type="text"
                value={row.label}
                onChange={(e) => patchInspectionRow(ri, e.target.value)}
                placeholder={l("form_builder_row_label_placeholder")}
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => removeInspectionRow(ri)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-red-500"
                aria-label={l("forms_delete_template")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addInspectionRow}
            className="text-sm text-amber-600 dark:text-amber-400 min-h-[44px]"
          >
            + {l("form_builder_add_row")}
          </button>
        </div>
      )}
    </div>
  ) : (
    <p className="text-sm text-zinc-500 dark:text-zinc-400 p-4">
      {l("form_builder_select_field_hint")}
    </p>
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-2 sm:px-0">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg border border-zinc-200 dark:border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          {l("form_builder_title")}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Meta */}
        <div className="lg:col-span-12 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              {l("form_builder_template_name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              {l("form_builder_template_category")}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            >
              {BUILDER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {l(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              {l("form_builder_template_description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
        </div>

        {/* Sidebar sections */}
        <aside className="lg:col-span-3 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900/50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {l("form_builder_sections")}
            </span>
            <button
              type="button"
              onClick={addSection}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 text-white px-3 py-2 text-xs font-medium min-h-[44px]"
            >
              <Plus className="h-4 w-4" />
              {l("form_builder_add_section")}
            </button>
          </div>
          {sections.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">{l("form_builder_no_sections")}</p>
          ) : (
            <ul className="space-y-1">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSectionIdx(i);
                      setActiveFieldIdx(null);
                    }}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm min-h-[44px] ${
                      i === activeSectionIdx
                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100"
                        : "hover:bg-zinc-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {s.title.trim() || l("form_builder_section_untitled")}
                  </button>
                  <div className="flex gap-1 mt-1 justify-end">
                    <button
                      type="button"
                      onClick={() => moveSection(i, -1)}
                      className="p-2 rounded border border-zinc-200 dark:border-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={l("form_builder_move_up")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(i, 1)}
                      className="p-2 rounded border border-zinc-200 dark:border-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={l("form_builder_move_down")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(i)}
                      className="p-2 rounded border border-red-200 text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={l("forms_delete_template")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Center: section title + fields */}
        <main className="lg:col-span-5 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
          {!activeSection ? (
            <p className="text-sm text-zinc-500">{l("form_builder_no_sections")}</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  {l("form_builder_section_title")}
                </label>
                <input
                  type="text"
                  value={activeSection.title}
                  onChange={(e) => updateSectionTitle(activeSectionIdx, e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {l("form_builder_fields")}
                </span>
                <button
                  type="button"
                  onClick={addField}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-600 text-amber-700 dark:text-amber-400 px-3 py-2 text-sm min-h-[44px]"
                >
                  <Plus className="h-4 w-4" />
                  {l("form_builder_add_field")}
                </button>
              </div>
              {activeSection.fields.length === 0 ? (
                <p className="text-sm text-zinc-500">{l("form_builder_no_fields")}</p>
              ) : (
                <ul className="space-y-2">
                  {activeSection.fields.map((f, fi) => (
                    <li
                      key={f.id}
                      className={`rounded-lg border p-3 ${
                        fi === activeFieldIdx
                          ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                          : "border-zinc-200 dark:border-slate-700"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFieldIdx(fi);
                          if (
                            typeof window !== "undefined" &&
                            window.matchMedia("(max-width: 1023px)").matches
                          ) {
                            setMobileConfigOpen(true);
                          }
                        }}
                        className="w-full text-left"
                      >
                        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                          {f.label.trim() || l("form_builder_field_untitled")}
                        </p>
                        <p className="text-xs text-zinc-500">{l(`form_builder_ft_${f.type}`)}</p>
                      </button>
                      <div className="flex flex-wrap gap-1 mt-2 justify-end">
                        <button
                          type="button"
                          onClick={() => moveField(activeSectionIdx, fi, -1)}
                          className="p-2 rounded border border-zinc-200 dark:border-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label={l("form_builder_move_up")}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(activeSectionIdx, fi, 1)}
                          className="p-2 rounded border border-zinc-200 dark:border-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label={l("form_builder_move_down")}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(activeSectionIdx, fi)}
                          className="p-2 rounded border border-red-200 text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label={l("forms_delete_template")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </main>

        {/* Right: field config — desktop */}
        <aside className="hidden lg:block lg:col-span-4">{fieldConfigPanel}</aside>
      </div>

      {/* Mobile field config drawer */}
      {mobileConfigOpen && activeField && (
        <div className="fixed inset-0 z-[60] lg:hidden flex flex-col bg-black/40">
          <button
            type="button"
            className="flex-1 min-h-[44px]"
            aria-label={l("cancel") ?? "Close"}
            onClick={() => setMobileConfigOpen(false)}
          />
          <div className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white dark:bg-slate-900 border-t border-zinc-200 dark:border-slate-700 p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="font-medium text-zinc-900 dark:text-white">
                {l("form_builder_field_settings")}
              </span>
              <button
                type="button"
                onClick={() => setMobileConfigOpen(false)}
                className="text-sm text-amber-600 min-h-[44px] px-2"
              >
                {l("forms_continue")}
              </button>
            </div>
            {fieldConfigPanel}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={sections.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-3 text-sm font-medium min-h-[44px] disabled:opacity-50"
        >
          <Eye className="h-4 w-4" />
          {l("form_builder_preview")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim() || sections.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 text-white px-4 py-3 text-sm font-medium min-h-[44px] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {l("form_builder_save")}
        </button>
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-auto w-full max-w-lg flex-1 overflow-hidden flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 shadow-xl">
            <div className="flex items-center justify-between gap-2 p-4 border-b border-zinc-200 dark:border-slate-700">
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                {l("form_builder_preview")}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg px-3 py-2 text-sm min-h-[44px] text-zinc-600"
              >
                {l("cancel")}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <p className="text-lg font-medium text-zinc-900 dark:text-white">
                {resolveFormLabel(draftTemplate.name, t)}
              </p>
              {draftTemplate.sections.map((sec) => (
                <div key={sec.id} className="space-y-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    {resolveFormLabel(sec.title, t)}
                  </h4>
                  {sec.fields.map((field) => (
                    <FormFieldInput
                      key={field.id}
                      field={field}
                      value={field.multiple ? [] : ""}
                      onChange={() => {}}
                      labels={t}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
