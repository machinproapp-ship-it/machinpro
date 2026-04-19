"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PenLine, Plus, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { ALL_TRANSLATIONS } from "@/lib/i18n";

type SwpRow = {
  id: string;
  company_id: string;
  title: string;
  equipment: string;
  description: string | null;
  steps: unknown;
  ppe_required: unknown;
  deleted_at: string | null;
};

type SigRow = {
  id: string;
  swp_id: string;
  user_id: string;
  company_id: string;
  signed_at: string;
};

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  return [];
}

export interface SwpModuleProps {
  t: Record<string, string>;
  companyId: string;
  userProfileId: string | null;
  canManage: boolean;
  employees: { id: string; name: string }[];
}

export function SwpModule({ t, companyId, userProfileId, canManage, employees }: SwpModuleProps) {
  const { showToast } = useToast();
  const L = (k: string, fb: string) =>
    (t[k] as string | undefined) || (ALL_TRANSLATIONS.en as Record<string, string>)[k] || fb;

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [swps, setSwps] = useState<SwpRow[]>([]);
  const [sigs, setSigs] = useState<SigRow[]>([]);
  const [modal, setModal] = useState<null | { mode: "create" } | { mode: "edit"; row: SwpRow }>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, e.name);
    return m;
  }, [employees]);

  const reload = useCallback(async () => {
    if (!supabase || !companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("safe_work_procedures")
        .select("id, company_id, title, equipment, description, steps, ppe_required, deleted_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setSwps((rows ?? []) as SwpRow[]);

      const ids = ((rows ?? []) as SwpRow[]).map((r) => r.id);
      if (ids.length === 0) {
        setSigs([]);
        return;
      }
      const { data: sigRows, error: sigErr } = await supabase
        .from("swp_signatures")
        .select("id, swp_id, user_id, company_id, signed_at")
        .eq("company_id", companyId)
        .in("swp_id", ids);
      if (sigErr) throw sigErr;
      setSigs((sigRows ?? []) as SigRow[]);
    } catch {
      setSwps([]);
      setSigs([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const signedSetForUser = useMemo(() => {
    const uid = userProfileId ?? "";
    const s = new Set<string>();
    if (!uid) return s;
    for (const x of sigs) {
      if (x.user_id === uid) s.add(x.swp_id);
    }
    return s;
  }, [sigs, userProfileId]);

  const pendingForUser = useMemo(() => {
    if (!userProfileId) return 0;
    return swps.filter((w) => !signedSetForUser.has(w.id)).length;
  }, [swps, signedSetForUser, userProfileId]);

  const sigsBySwp = useMemo(() => {
    const m = new Map<string, SigRow[]>();
    for (const s of sigs) {
      const list = m.get(s.swp_id) ?? [];
      list.push(s);
      m.set(s.swp_id, list);
    }
    return m;
  }, [sigs]);

  const signSwp = async (swpId: string) => {
    if (!supabase || !userProfileId || !companyId) return;
    setBusyId(`sign-${swpId}`);
    try {
      const payload = {
        swp_id: swpId,
        user_id: userProfileId,
        company_id: companyId,
        signature_data: JSON.stringify({ at: new Date().toISOString(), acknowledge: true }),
      };
      const { error } = await supabase.from("swp_signatures").insert(payload);
      if (error && error.code !== "23505") throw error;
      showToast("success", L("swp_signed", "Signed"));
      await reload();
    } catch {
      showToast("error", L("error_generic", "Error"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      {pendingForUser > 0 ? (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />
          <p className="min-w-0">{L("swp_compliance_alert", "")}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{L("swp_title", "SWP")}</h3>
        {canManage ? (
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 self-start rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 sm:self-auto"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            {L("swp_new", "New")}
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        </div>
      ) : swps.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-slate-900">
          {L("noEntries", "No entries")}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {swps.map((row) => {
            const signed = userProfileId ? signedSetForUser.has(row.id) : false;
            const sigCount = sigsBySwp.get(row.id)?.length ?? 0;
            return (
              <li
                key={row.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900"
              >
                <div className="flex flex-col gap-2">
                  <p className="font-semibold text-zinc-900 dark:text-white">{row.title}</p>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {L("swp_equipment", "Equipment")}
                  </p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-200">{row.equipment}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailId(row.id)}
                      className="min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {L("viewDetail", "View detail")}
                    </button>
                    {userProfileId ? (
                      <button
                        type="button"
                        disabled={busyId === `sign-${row.id}` || signed}
                        onClick={() => void signSwp(row.id)}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {busyId === `sign-${row.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <PenLine className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                        {signed ? L("swp_signed", "Signed") : L("swp_sign", "Sign")}
                      </button>
                    ) : null}
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "edit", row })}
                        className="min-h-[44px] rounded-lg border border-amber-400/70 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40"
                      >
                        {L("swp_edit", "Edit")}
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {L("swp_signed_by", "Signed by")}: {sigCount}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {signed ? L("swp_signed", "") : L("swp_pending", "")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {detailId ? (
        <SwpDetailModal
          row={swps.find((x) => x.id === detailId) ?? null}
          sigs={sigsBySwp.get(detailId) ?? []}
          nameByUserId={nameByUserId}
          onClose={() => setDetailId(null)}
          t={t}
        />
      ) : null}

      {modal ? (
        <SwpEditModal
          mode={modal.mode}
          initial={modal.mode === "edit" ? modal.row : null}
          companyId={companyId}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void reload();
            showToast("success", L("toast_saved", "Saved"));
          }}
          t={t}
        />
      ) : null}
    </div>
  );
}

function SwpDetailModal({
  row,
  sigs,
  nameByUserId,
  onClose,
  t,
}: {
  row: SwpRow | null;
  sigs: SigRow[];
  nameByUserId: Map<string, string>;
  onClose: () => void;
  t: Record<string, string>;
}) {
  const L = (k: string, fb: string) =>
    (t[k] as string | undefined) || (ALL_TRANSLATIONS.en as Record<string, string>)[k] || fb;
  if (!row) return null;
  const steps = asStringArray(row.steps);
  const ppe = asStringArray(row.ppe_required);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal
        className="flex max-h-[min(92dvh,92vh)] w-full max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[min(90dvh,90vh)] sm:rounded-2xl md:max-w-xl"
      >
        <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <h4 className="min-w-0 text-sm font-semibold text-zinc-900 dark:text-white">{row.title}</h4>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-600"
          >
            {L("cancel", "Close")}
          </button>
        </div>
        <div className="space-y-4 px-4 py-4 text-sm">
          <section>
            <p className="text-xs font-semibold uppercase text-zinc-500">{L("swp_equipment", "")}</p>
            <p className="mt-1 text-zinc-800 dark:text-zinc-100">{row.equipment}</p>
          </section>
          {row.description ? (
            <section>
              <p className="text-xs font-semibold uppercase text-zinc-500">{L("swp_description", "")}</p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">{row.description}</p>
            </section>
          ) : null}
          <section>
            <p className="text-xs font-semibold uppercase text-zinc-500">{L("swp_steps", "")}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-700 dark:text-zinc-200">
              {steps.length ? (
                steps.map((s, i) => <li key={i}>{s}</li>)
              ) : (
                <li className="list-none pl-0 text-zinc-400">—</li>
              )}
            </ol>
          </section>
          <section>
            <p className="text-xs font-semibold uppercase text-zinc-500">{L("swp_ppe", "")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-200">
              {ppe.length ? (
                ppe.map((s, i) => <li key={i}>{s}</li>)
              ) : (
                <li className="list-none pl-0 text-zinc-400">—</li>
              )}
            </ul>
          </section>
          <section>
            <p className="text-xs font-semibold uppercase text-zinc-500">{L("swp_signatures", "")}</p>
            <ul className="mt-2 space-y-1">
              {sigs.length === 0 ? (
                <li className="text-zinc-400">{L("swp_not_signed", "")}</li>
              ) : (
                sigs.map((s) => (
                  <li key={s.id} className="text-zinc-700 dark:text-zinc-200">
                    {nameByUserId.get(s.user_id) ?? s.user_id}{" "}
                    <span className="text-xs text-zinc-500">· {new Date(s.signed_at).toLocaleString()}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function SwpEditModal({
  mode,
  initial,
  companyId,
  onClose,
  onSaved,
  t,
}: {
  mode: "create" | "edit";
  initial: SwpRow | null;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
  t: Record<string, string>;
}) {
  const { showToast } = useToast();
  const L = (k: string, fb: string) =>
    (t[k] as string | undefined) || (ALL_TRANSLATIONS.en as Record<string, string>)[k] || fb;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [equipment, setEquipment] = useState(initial?.equipment ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [stepsText, setStepsText] = useState(() => asStringArray(initial?.steps).join("\n"));
  const [ppeText, setPpeText] = useState(() => asStringArray(initial?.ppe_required).join("\n"));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!supabase || !companyId) return;
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const ppe = ppeText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!title.trim() || !equipment.trim()) {
      showToast("error", L("error_generic", "Error"));
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        const { error } = await supabase.from("safe_work_procedures").insert({
          company_id: companyId,
          title: title.trim(),
          equipment: equipment.trim(),
          description: description.trim() || null,
          steps,
          ppe_required: ppe,
        });
        if (error) throw error;
      } else if (initial) {
        const { error } = await supabase
          .from("safe_work_procedures")
          .update({
            title: title.trim(),
            equipment: equipment.trim(),
            description: description.trim() || null,
            steps,
            ppe_required: ppe,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initial.id);
        if (error) throw error;
      }
      onSaved();
    } catch {
      showToast("error", L("error_generic", "Error"));
    } finally {
      setSaving(false);
    }
  };

  const softDelete = async () => {
    if (!supabase || !initial) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("safe_work_procedures")
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", initial.id);
      if (error) throw error;
      onSaved();
    } catch {
      showToast("error", L("error_generic", "Error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[72] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[min(92dvh,92vh)] w-full max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[min(90dvh,90vh)] sm:rounded-2xl md:max-w-lg">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {mode === "create" ? L("swp_new", "") : L("swp_edit", "")}
          </h4>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4">
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{L("projectFormNameLabel", "Name")}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-800"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{L("swp_equipment", "")}</span>
            <input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-800"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{L("swp_description", "")}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-800"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {L("swp_steps", "")} · {L("swp_line_hint", "")}
            </span>
            <textarea
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-800"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {L("swp_ppe", "")} · {L("swp_line_hint", "")}
            </span>
            <textarea
              value={ppeText}
              onChange={(e) => setPpeText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-slate-800"
            />
          </label>
        </div>
        <div className="mt-auto flex flex-col-reverse gap-2 border-t border-zinc-200 px-4 py-3 dark:border-slate-700 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="min-h-[44px] w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium sm:w-auto dark:border-zinc-600"
          >
            {L("cancel", "Cancel")}
          </button>
          {mode === "edit" && initial ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void softDelete()}
              className="min-h-[44px] w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 sm:w-auto dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            >
              {L("swp_delete", "Remove")}
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white sm:w-auto ${saving ? "opacity-50" : ""}`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {L("swp_save", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
