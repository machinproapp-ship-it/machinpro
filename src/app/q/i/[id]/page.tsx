"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useAppLocale } from "@/hooks/useAppLocale";
import { buildInventoryItemQrUrl } from "@/lib/inventoryQrUrl";
import { readLocalInventoryItems } from "@/lib/localInventoryStorage";
import { supabase } from "@/lib/supabase";
import { QrQuickBackLink, QrQuickResolveLayout } from "@/components/inventory/QrQuickResolveLayout";

export default function QrItemQuickPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { t } = useAppLocale();
  const L = (k: string, fb: string) => (t as Record<string, string>)[k] ?? fb;

  const itemId =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [phase, setPhase] = useState<"loading" | "error" | "redirect">("loading");

  useEffect(() => {
    if (authLoading || !itemId) return;

    if (!user) {
      const redirect = `/q/i/${encodeURIComponent(itemId)}`;
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    void (async () => {
      const local = readLocalInventoryItems();
      const inLocal = local.some((i) => i.id === itemId && !i.deletedAt);

      let inRemote = false;
      if (!inLocal && supabase && profile?.companyId) {
        const { data } = await supabase
          .from("inventory_items")
          .select("id")
          .eq("id", itemId)
          .eq("company_id", profile.companyId)
          .maybeSingle();
        inRemote = !!data?.id;
      }

      if (!inLocal && !inRemote) {
        setPhase("error");
        return;
      }

      setPhase("redirect");
      const scanUrl = buildInventoryItemQrUrl(itemId);
      router.replace(`/?mp_qr_scan=${encodeURIComponent(scanUrl)}`);
    })();
  }, [authLoading, user, itemId, profile?.companyId, router]);

  return (
    <QrQuickResolveLayout loading={phase !== "error"} labels={t as Record<string, string>}>
      {phase === "error" ? (
        <>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {L("inventory_qrItemNotFound", "This QR does not belong to your company or the item no longer exists")}
          </h1>
          <QrQuickBackLink labels={t as Record<string, string>} />
        </>
      ) : null}
    </QrQuickResolveLayout>
  );
}
