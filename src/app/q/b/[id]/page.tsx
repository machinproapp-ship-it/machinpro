"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAppLocale } from "@/hooks/useAppLocale";
import { formatBlankLabelSequence } from "@/lib/inventoryBlankLabels";
import { QrQuickBackLink, QrQuickResolveLayout } from "@/components/inventory/QrQuickResolveLayout";
import { supabase } from "@/lib/supabase";

const MP_QR_SCAN_KEY = "mp_qr_scan";

export default function QrBlankQuickPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useAppLocale();
  const L = (k: string, fb: string) => (t as Record<string, string>)[k] ?? fb;

  const blankId =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [phase, setPhase] = useState<"loading" | "error" | "consumed" | "redirect">("loading");
  const [consumedItemQr, setConsumedItemQr] = useState<string | null>(null);
  const [consumedItemName, setConsumedItemName] = useState<string | undefined>();
  const [sequenceNumber, setSequenceNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!blankId) return;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const redirect = `/q/b/${encodeURIComponent(blankId)}`;
        router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
        return;
      }

      const { data: label, error } = await supabase
        .from("inventory_blank_labels")
        .select("id, qr_code, sequence_number, consumed_at, consumed_into_item_id")
        .eq("id", blankId)
        .maybeSingle();

      if (error) {
        console.error("QR blank lookup:", error);
        setPhase("error");
        return;
      }

      if (!label?.id) {
        setPhase("error");
        return;
      }

      setSequenceNumber(label.sequence_number);

      if (label.consumed_at) {
        if (label.consumed_into_item_id) {
          const { data: item } = await supabase
            .from("inventory_items")
            .select("id, name, qr_code")
            .eq("id", label.consumed_into_item_id)
            .maybeSingle();

          const qr = item?.qr_code?.trim();
          if (qr) setConsumedItemQr(qr);
          setConsumedItemName(item?.name ?? undefined);
        }
        setPhase("consumed");
        return;
      }

      const qrCode = label.qr_code?.trim();
      if (!qrCode) {
        setPhase("error");
        return;
      }

      try {
        sessionStorage.setItem(MP_QR_SCAN_KEY, qrCode);
      } catch {
        /* ignore */
      }

      setPhase("redirect");
      router.replace(
        `/?mp_qr_scan=${encodeURIComponent(qrCode)}&mp_qr_blank_id=${encodeURIComponent(label.id)}`
      );
    })();
  }, [blankId, router]);

  return (
    <QrQuickResolveLayout loading={phase === "loading" || phase === "redirect"} labels={t as Record<string, string>}>
      {phase === "error" ? (
        <>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {L(
              "inventory_qrBlankNotFound",
              "Label not found or does not belong to your company"
            )}
          </h1>
          <QrQuickBackLink labels={t as Record<string, string>} />
        </>
      ) : null}

      {phase === "consumed" ? (
        <>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {L("inventory_qrBlankLabelConsumed", "This label was already used to register:")}{" "}
            <span className="font-medium text-zinc-900 dark:text-white">
              {consumedItemName ??
                (sequenceNumber != null
                  ? formatBlankLabelSequence(sequenceNumber, 999)
                  : "—")}
            </span>
          </p>
          {consumedItemQr ? (
            <Link
              href={`/?mp_qr_scan=${encodeURIComponent(consumedItemQr)}`}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500"
            >
              {L("inventory_qrBlankLabelViewItem", "View tool")}
            </Link>
          ) : null}
          <QrQuickBackLink labels={t as Record<string, string>} />
        </>
      ) : null}
    </QrQuickResolveLayout>
  );
}
