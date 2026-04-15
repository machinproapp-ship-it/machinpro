"use client";

import { useCallback, useState } from "react";
import { Loader2, MessageSquare, X } from "lucide-react";
import { useToast } from "@/components/Toast";

export type FeedbackWidgetProps = {
  labels: Record<string, string>;
  accessToken: string | null;
  userId: string | null;
  companyId: string | null;
};

const L = (dict: Record<string, string>, key: string, fb: string) => dict[key] ?? fb;

const FEEDBACK_TYPES = ["bug", "suggestion", "positive", "question"] as const;
type FeedbackType = (typeof FEEDBACK_TYPES)[number];

const MODULE_VALUES = ["", "central", "operations", "schedule", "logistics", "security", "settings", "general"] as const;
type FeedbackModule = (typeof MODULE_VALUES)[number];

export function FeedbackWidget({ labels: t, accessToken, userId, companyId }: FeedbackWidgetProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [module, setModule] = useState<FeedbackModule>("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const typeLabel = useCallback(
    (k: FeedbackType) => {
      const key =
        k === "bug"
          ? "feedback_type_bug"
          : k === "suggestion"
            ? "feedback_type_suggestion"
            : k === "positive"
              ? "feedback_type_positive"
              : "feedback_type_question";
      return L(t, key, k);
    },
    [t]
  );

  const moduleLabel = useCallback(
    (v: FeedbackModule) => {
      if (!v) return L(t, "feedback_module_placeholder", "—");
      return L(t, `feedback_module_${v}`, v);
    },
    [t]
  );

  const send = useCallback(async () => {
    const msg = message.trim();
    if (!msg || !accessToken || !userId) {
      showToast("error", L(t, "feedback_error", "Could not send. Please try again."));
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      showToast("error", L(t, "feedback_error_offline", "Offline."));
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type,
          message: msg,
          userId,
          companyId: companyId ?? "",
          page: typeof window !== "undefined" ? window.location.href : "",
          module: module || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        if (data.error === "feedback_table_missing") {
          showToast("error", L(t, "feedback_error_config", "Temporarily unavailable."));
        } else {
          showToast("error", L(t, "feedback_error", "Could not send. Please try again."));
        }
        return;
      }
      showToast("success", L(t, "feedback_sent", "Thanks for your feedback!"));
      setMessage("");
      setModule("");
      setOpen(false);
    } catch {
      showToast("error", L(t, "feedback_error", "Could not send. Please try again."));
    } finally {
      setSending(false);
    }
  }, [accessToken, companyId, message, module, showToast, t, type, userId]);

  if (!accessToken || !userId) return null;

  return (
    <>
      <button
        type="button"
        title={L(t, "feedback_btn", "Enviar feedback")}
        aria-label={L(t, "feedback_btn", "Enviar feedback")}
        onClick={() => setOpen(true)}
        className="fixed bottom-[5.5rem] right-4 z-[62] flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600"
      >
        <MessageSquare className="h-5 w-5 shrink-0" aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[200] bg-black/50"
            aria-label={L(t, "common_close", "Close")}
            onClick={() => !sending && setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[201] w-full max-w-[calc(100vw-2rem)] max-h-[min(90dvh,90svh)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-md sm:p-5"
          >
            <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
              <h2 className="min-w-0 break-words text-base font-semibold text-zinc-900 dark:text-white">
                {L(t, "feedback_title", "¿Tienes alguna sugerencia?")}
              </h2>
              <button
                type="button"
                disabled={sending}
                onClick={() => setOpen(false)}
                className="inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
                aria-label={L(t, "common_close", "Close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              {L(
                t,
                "feedback_subtitle",
                "Ayúdanos a mejorar MachinPro. Tu opinión como beta founder es muy valiosa."
              )}
            </p>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {L(t, "feedback_type_label", "Tipo")}
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as FeedbackType)}
              className="mb-3 w-full min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
            >
              {FEEDBACK_TYPES.map((k) => (
                <option key={k} value={k}>
                  {typeLabel(k)}
                </option>
              ))}
            </select>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {L(t, "feedback_module_label", "Affected area")}
            </label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value as FeedbackModule)}
              className="mb-3 w-full min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
            >
              {MODULE_VALUES.map((v) => (
                <option key={v || "none"} value={v}>
                  {moduleLabel(v)}
                </option>
              ))}
            </select>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {L(t, "feedback_message_label", "Describe tu sugerencia o problema")}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="mb-4 min-h-[100px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={sending}
                onClick={() => setOpen(false)}
                className="min-h-[44px] w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium dark:border-slate-600 sm:w-auto"
              >
                {L(t, "cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={sending || !message.trim()}
                onClick={() => void send()}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 sm:w-auto sm:min-w-[44px]"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    <span>{L(t, "feedback_sending", L(t, "loading_saving", "Sending…"))}</span>
                  </>
                ) : (
                  L(t, "feedback_send", "Enviar")
                )}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
