"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useAppLocale } from "@/hooks/useAppLocale";
import { buildInventoryBlankQrUrl, buildInventoryItemQrUrl } from "@/lib/inventoryQrUrl";
import { fetchBlankLabelById } from "@/lib/inventoryBlankLabels";
import { formatBlankLabelSequence } from "@/lib/inventoryBlankLabels";
import { readLocalInventoryItems } from "@/lib/localInventoryStorage";
import { QrQuickBackLink, QrQuickResolveLayout } from "@/components/inventory/QrQuickResolveLayout";

export default function QrBlankQuickPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { t } = useAppLocale();
  const L = (k: string, fb: string) => (t as Record<string, string>)[k] ?? fb;

  const blankId =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [phase, setPhase] = useState<"loading" | "error" | "consumed" | "redirect">("loading");
  const [consumedItemId, setConsumedItemId] = useState<string | null>(null);
  const [consumedItemName, setConsumedItemName] = useState<string | undefined>();
  const [sequenceNumber, setSequenceNumber] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading || !blankId) return;

    if (!user) {
      const redirect = `/q/b/${encodeURIComponent(blankId)}`;
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    void (async () => {
      if (!profile?.companyId) {
        setPhase("error");
        return;
      }

      const row = await fetchBlankLabelById(profile.companyId, blankId);
      if (!row) {
        setPhase("error");
        return;
      }

      setSequenceNumber(row.sequence_number);

      if (row.consumed_at && row.consumed_into_item_id) {
        const local = readLocalInventoryItems();
        const item = local.find((i) => i.id === row.consumed_into_item_id && !i.deletedAt);
        setConsumedItemId(row.consumed_into_item_id);
        setConsumedItemName(item?.name);
        setPhase("consumed");
        return;
      }

      setPhase("redirect");
      const scanUrl = buildInventoryBlankQrUrl(blankId);
      router.replace(`/?mp_qr_scan=${encodeURIComponent(scanUrl)}`);
    })();
  }, [authLoading, user, blankId, profile?.companyId, router]);

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

      {phase === "consumed" && consumedItemId ? (
        <>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {L("inventory_qrBlankLabelConsumed", "This label was already used to register:")}{" "}
            <span className="font-medium text-zinc-900 dark:text-white">
              {consumedItemName ??
                (sequenceNumber != null
                  ? formatBlankLabelSequence(sequenceNumber, 999)
                  : consumedItemId)}
            </span>
          </p>
          <Link
            href={`/?mp_qr_scan=${encodeURIComponent(buildInventoryItemQrUrl(consumedItemId))}`}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500"
          >
            {L("inventory_qrBlankLabelViewItem", "View tool")}
          </Link>
          <QrQuickBackLink labels={t as Record<string, string>} />
        </>
      ) : null}
    </QrQuickResolveLayout>
  );
}
