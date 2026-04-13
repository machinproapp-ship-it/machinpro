"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, QrCode, Shield } from "lucide-react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { EmployeeDocument, ComplianceRecord } from "@/types/homePage";
import type { TrainingEmployeeOption } from "@/components/TrainingHubModule";

export function SafetyPassportModule({
  t,
  companyId,
  companyName,
  employees,
  employeeDocs,
  complianceRecords,
  dateLocale,
}: {
  t: Record<string, string>;
  companyId: string | null;
  companyName: string;
  employees: TrainingEmployeeOption[];
  employeeDocs: EmployeeDocument[];
  complianceRecords: ComplianceRecord[];
  dateLocale: string;
}) {
  const L = (k: string, fb: string) => t[k] ?? fb;
  const [empId, setEmpId] = useState(employees[0]?.id ?? "");
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const docsFor = useMemo(() => {
    if (!empId) return [];
    return employeeDocs.filter((d) => d.employeeId === empId);
  }, [employeeDocs, empId]);

  const certsFor = useMemo(() => {
    if (!empId) return [];
    return complianceRecords.filter((r) => r.targetType === "employee" && r.targetId === empId);
  }, [complianceRecords, empId]);

  const selectedName = employees.find((e) => e.id === empId)?.name ?? empId;

  const exportPdf = useCallback(() => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    let y = 48;
    doc.setFontSize(16);
    doc.text(L("safety_passport_title", "Safety passport"), 40, y);
    y += 28;
    doc.setFontSize(11);
    doc.text(`${selectedName} · ${companyName}`, 40, y);
    y += 36;
    doc.setFontSize(12);
    doc.text(L("training_certificate", "Certificates"), 40, y);
    y += 18;
    doc.setFontSize(10);
    for (const r of certsFor.slice(0, 40)) {
      doc.text(`· ${r.fieldId} — ${r.status} (${r.expiryDate ?? "—"})`, 48, y);
      y += 14;
      if (y > 760) {
        doc.addPage();
        y = 48;
      }
    }
    y += 10;
    doc.setFontSize(12);
    doc.text(L("documents", "Documents"), 40, y);
    y += 18;
    doc.setFontSize(10);
    for (const d of docsFor.slice(0, 40)) {
      doc.text(`· ${d.title} (${d.type})`, 48, y);
      y += 14;
      if (y > 760) {
        doc.addPage();
        y = 48;
      }
    }
    doc.save(`passport_${selectedName.replace(/\s+/g, "_")}.pdf`);
  }, [L, certsFor, companyName, docsFor, selectedName]);

  const makeQr = useCallback(async () => {
    const payload = JSON.stringify({
      v: 1,
      companyId: companyId ?? "",
      employeeId: empId,
      employeeName: selectedName,
    });
    const url = await QRCode.toDataURL(payload, { margin: 1, width: 200 });
    setQrUrl(url);
  }, [companyId, empId, selectedName]);

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <Shield className="h-5 w-5 text-amber-600" aria-hidden />
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
          {L("safety_passport_title", "Safety passport")}
        </h3>
      </div>
      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {L("employees", "Employees")}
        <select
          value={empId}
          onChange={(e) => {
            setEmpId(e.target.value);
            setQrUrl(null);
          }}
          className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/40">
        <p className="font-medium text-zinc-800 dark:text-zinc-100">
          {L("compliance", "Compliance")} ({certsFor.length})
        </p>
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-zinc-600 dark:text-zinc-300">
          {certsFor.length === 0 ? (
            <li className="text-zinc-400">{L("noEntries", "—")}</li>
          ) : (
            certsFor.map((r) => (
              <li key={r.id}>
                · {r.fieldId} — {r.status}
                {r.expiryDate ? ` (${new Intl.DateTimeFormat(dateLocale).format(new Date(r.expiryDate))})` : ""}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/40">
        <p className="font-medium text-zinc-800 dark:text-zinc-100">
          {L("documents", "Documents")} ({docsFor.length})
        </p>
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-zinc-600 dark:text-zinc-300">
          {docsFor.length === 0 ? (
            <li className="text-zinc-400">{L("noEntries", "—")}</li>
          ) : (
            docsFor.map((d) => (
              <li key={d.id}>
                · {d.title} ({d.type})
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => void exportPdf()}
          className="inline-flex min-h-[44px] w-full flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600 sm:w-auto"
        >
          <Download className="h-4 w-4" />
          {L("safety_passport_export", "Export passport PDF")}
        </button>
        <button
          type="button"
          onClick={() => void makeQr()}
          className="inline-flex min-h-[44px] w-full flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 sm:w-auto"
        >
          <QrCode className="h-4 w-4" />
          {L("safety_passport_qr", "Passport QR")}
        </button>
      </div>
      {qrUrl ? (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="" className="h-44 w-44 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-600" />
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">{L("safety_passport_qr", "Passport QR")}</p>
        </div>
      ) : null}
    </div>
  );
}
