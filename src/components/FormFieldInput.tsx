"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import type { FormField, InspectionTableValue } from "@/types/forms";

const CLOUDINARY_CLOUD = "dwdlmxmkt";
const CLOUDINARY_PRESET = "i5dmd07o";

interface EmployeeBasic {
  id: string;
  name: string;
  email?: string;
}

async function uploadToCloudinary(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: fd }
  );
  if (!res.ok) throw new Error("upload failed");
  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error("no url");
  return data.secure_url;
}

function normalizeInspectionValue(v: unknown): InspectionTableValue {
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    return v as InspectionTableValue;
  }
  return {};
}

export function FormFieldInput({
  field,
  value,
  onChange,
  optionsEmployees,
  labels,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  optionsEmployees?: EmployeeBasic[];
  labels: Record<string, string>;
}) {
  const L = (k: string) => labels[k] ?? k;
  const label = L(field.label);
  const required = field.required;
  const common =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]";

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const desktopRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const isMobileUi =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 768px)").matches;

  const processFile = useCallback(
    async (file: File | undefined) => {
      if (!file || !file.type.startsWith("image/")) return;
      setUploadErr("");
      setUploading(true);
      try {
        const url = await uploadToCloudinary(file);
        if (field.type === "photo" && field.multiple) {
          const prev = Array.isArray(value) ? (value as string[]) : [];
          onChange([...prev, url]);
        } else {
          onChange(url);
        }
      } catch {
        setUploadErr(L("forms_photo_upload_error"));
      } finally {
        setUploading(false);
      }
    },
    [onChange, L, field.type, field.multiple, value]
  );

  if (field.type === "text") {
    return (
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
          {required && " *"}
        </label>
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={common}
          placeholder={field.placeholder ? L(field.placeholder) : undefined}
        />
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
          {required && " *"}
        </label>
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${common} resize-none`}
          rows={3}
          placeholder={field.placeholder ? L(field.placeholder) : undefined}
        />
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
          {required && " *"}
        </label>
        <input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : undefined)
          }
          className={common}
        />
      </div>
    );
  }
  if (field.type === "date") {
    return (
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
          {required && " *"}
        </label>
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={common}
        />
      </div>
    );
  }
  if (field.type === "time") {
    return (
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
          {required && " *"}
        </label>
        <input
          type="time"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={common}
        />
      </div>
    );
  }
  if (field.type === "select") {
    const opts = field.options?.length
      ? field.options
      : optionsEmployees?.map((e) => e.name) ?? [];
    return (
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
          {required && " *"}
        </label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={common}
        >
          <option value="">{L("forms_select_placeholder")}</option>
          {opts.map((o) => {
            const display = labels[o] !== undefined ? L(o) : o;
            return (
              <option key={o} value={o}>
                {display}
              </option>
            );
          })}
        </select>
      </div>
    );
  }
  if (field.type === "multiselect") {
    const arr = (value as string[]) ?? [];
    const opts = field.options ?? [];
    return (
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
          {required && " *"}
        </label>
        <div className="space-y-2">
          {opts.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={arr.includes(opt)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...arr, opt]);
                  else onChange(arr.filter((x) => x !== opt));
                }}
                className="rounded border-zinc-300 text-amber-600"
              />
              <span className="text-sm">{L(opt)}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (field.type === "radio") {
    const opts = field.options ?? [];
    return (
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
          {required && " *"}
        </label>
        <div className="flex flex-wrap gap-4">
          {opts.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={field.id}
                checked={(value as string) === opt}
                onChange={() => onChange(opt)}
                className="border-zinc-300 text-amber-600"
              />
              <span className="text-sm">{L(opt)}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (field.type === "inspection_table") {
    const rows = field.rows ?? [];
    const cols = field.columns ?? [];
    const tableVal = normalizeInspectionValue(value);
    const selectOpts = field.options?.length
      ? field.options
      : ["pass", "fail", "na"];

    const setCell = (rowId: string, colId: string, v: string) => {
      const next: InspectionTableValue = {
        ...tableVal,
        [rowId]: { ...(tableVal[rowId] ?? {}), [colId]: v },
      };
      onChange(next);
    };

    return (
      <div className="space-y-2 overflow-x-auto">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
          {required && " *"}
        </label>
        <table className="min-w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800">
              <th className="text-left p-2 border-b border-zinc-200 dark:border-zinc-700">
                {L("forms_inspection_item")}
              </th>
              {cols.map((c) => (
                <th
                  key={c.id}
                  className="text-left p-2 border-b border-zinc-200 dark:border-zinc-700"
                >
                  {L(c.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="p-2 border-b border-zinc-100 dark:border-zinc-800 font-medium text-zinc-800 dark:text-zinc-200">
                  {L(row.label)}
                </td>
                {cols.map((col) => {
                  const cell = tableVal[row.id]?.[col.id] ?? "";
                  if (col.kind === "text") {
                    return (
                      <td
                        key={col.id}
                        className="p-2 border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) =>
                            setCell(row.id, col.id, e.target.value)
                          }
                          className="w-full min-w-[120px] rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm min-h-[44px]"
                        />
                      </td>
                    );
                  }
                  return (
                    <td
                      key={col.id}
                      className="p-2 border-b border-zinc-100 dark:border-zinc-800"
                    >
                      <select
                        value={cell}
                        onChange={(e) =>
                          setCell(row.id, col.id, e.target.value)
                        }
                        className="w-full min-w-[100px] rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm min-h-[44px]"
                      >
                        <option value="">{L("forms_select_placeholder")}</option>
                        {selectOpts.map((o) => (
                          <option key={o} value={o}>
                            {L(
                              o === "pass"
                                ? "form_opt_pass"
                                : o === "fail"
                                  ? "form_opt_fail"
                                  : o === "na"
                                    ? "form_opt_na"
                                    : o
                            )}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (field.type === "photo") {
    const urls =
      field.multiple && Array.isArray(value)
        ? (value as string[]).filter((u) => typeof u === "string")
        : typeof value === "string" && value
          ? [value]
          : [];
    const singleUrl = !field.multiple && typeof value === "string" ? value : "";
    return (
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
          {required && " *"}
        </label>
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void processFile(e.target.files?.[0])}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void processFile(e.target.files?.[0])}
        />
        <input
          ref={desktopRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void processFile(e.target.files?.[0])}
        />

        {isMobileUi ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium min-h-[44px] min-w-[44px] text-zinc-800 dark:text-zinc-200"
            >
              <ImageIcon className="h-4 w-4" />
              {L("forms_photo_gallery")}
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium min-h-[44px] min-w-[44px] text-zinc-800 dark:text-zinc-200"
            >
              <Upload className="h-4 w-4" />
              {L("forms_photo_camera")}
            </button>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") desktopRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              void processFile(f);
            }}
            onClick={() => desktopRef.current?.click()}
            className={`mt-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm cursor-pointer transition-colors min-h-[120px] ${
              dragOver
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                : "border-zinc-300 dark:border-zinc-600 hover:border-amber-400 dark:hover:border-amber-500"
            }`}
          >
            <Upload className="h-8 w-8 text-zinc-400" />
            <span className="text-zinc-600 dark:text-zinc-400">
              {L("forms_photo_drop_hint")}
            </span>
          </div>
        )}

        {uploading && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
            {L("forms_photo_uploading")}
          </p>
        )}
        {uploadErr && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">{uploadErr}</p>
        )}

        {field.multiple ? (
          <div className="mt-3 flex flex-wrap gap-3">
            {urls.map((url, idx) => (
              <div key={`${url}-${idx}`} className="relative inline-block max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="max-h-48 rounded-lg border border-zinc-200 dark:border-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = urls.filter((_, i) => i !== idx);
                    onChange(next.length ? next : undefined);
                  }}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={L("forms_photo_remove")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          singleUrl && (
            <div className="mt-3 relative inline-block max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={singleUrl}
                alt=""
                className="max-h-48 rounded-lg border border-zinc-200 dark:border-zinc-700"
              />
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={L("forms_photo_remove")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        )}
      </div>
    );
  }
  return null;
}
