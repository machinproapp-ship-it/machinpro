"use client";

import { useEffect, useMemo, useState } from "react";
import type { HazardCategory, HazardProbability, HazardSeverity } from "@/types/hazard";
import { supabase } from "@/lib/supabase";

type ProjectOpt = { id: string; name: string };

const CATEGORIES: HazardCategory[] = [
  "electrical",
  "chemical",
  "physical",
  "ergonomic",
  "biological",
  "fire",
  "other",
];
const SEVERITIES: HazardSeverity[] = ["low", "medium", "high", "critical"];
const PROBS: HazardProbability[] = ["low", "medium", "high"];

export function QuickHazardModal({
  open,
  onClose,
  companyId,
  labels,
  projects,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  labels: Record<string, string>;
  projects: ProjectOpt[];
  onSaved?: () => void;
}) {
  const L = (k: string, fb: string) => labels[k] ?? fb;
  const activeProjects = useMemo(() => projects.filter((p) => p.id), [projects]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<HazardCategory>("other");
  const [severity, setSeverity] = useState<HazardSeverity>("medium");
  const [probability, setProbability] = useState<HazardProbability>("medium");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setTitle("");
    setDescription("");
    setCategory("other");
    setSeverity("medium");
    setProbability("medium");
    if (activeProjects.length === 1) {
      setProjectId(activeProjects[0]!.id);
    } else {
      setProjectId("");
    }
  }, [open, activeProjects]);

  if (!open) return null;

  const submit = async () => {
    if (!title.trim() || !projectId) {
      setErr(L("validation_required", "Required"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setBusy(false);
        return;
      }
      const res = await fetch("/api/hazards/quick-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId,
          projectId,
          title: title.trim(),
          description: description.trim() || null,
          category,
          severity,
          probability,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(j.error ?? "Error");
        setBusy(false);
        return;
      }
      setBusy(false);
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[62] bg-black/50 touch-none" aria-hidden onClick={() => !busy && onClose()} />
      <div className="fixed left-1/2 top-1/2 z-[63] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">{L("quick_report_hazard_title", L("quick_report_hazard", "Report hazard"))}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{L("hazards_project", "Project")}</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">{L("common_select", "Select…")}</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{L("hazards_title", "Title")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{L("hazards_description", "Description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{L("hazards_category", "Category")}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as HazardCategory)}
                className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {L(`hazards_cat_${c}`, c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{L("hazards_severity", "Severity")}</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as HazardSeverity)}
                className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {L(`hazards_sev_${s}`, s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{L("hazards_probability", "Probability")}</label>
              <select
                value={probability}
                onChange={(e) => setProbability(e.target.value as HazardProbability)}
                className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm"
              >
                {PROBS.map((p) => (
                  <option key={p} value={p}>
                    {L(`hazards_prob_${p}`, p)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm min-h-[44px]">
            {L("cancel", "Cancel")}
          </button>
          <button
            type="button"
            disabled={busy || !projectId}
            onClick={() => void submit()}
            className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
          >
            {busy ? "…" : L("save", "Save")}
          </button>
        </div>
      </div>
    </>
  );
}
