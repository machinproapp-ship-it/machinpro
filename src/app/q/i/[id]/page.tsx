"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppLocale } from "@/hooks/useAppLocale";
import { QrQuickBackLink, QrQuickResolveLayout } from "@/components/inventory/QrQuickResolveLayout";
import { supabase } from "@/lib/supabase";

const MP_QR_SCAN_KEY = "mp_qr_scan";

export default function QrItemQuickPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useAppLocale();
  const L = (k: string, fb: string) => (t as Record<string, string>)[k] ?? fb;

  const itemId =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [phase, setPhase] = useState<"loading" | "error" | "redirect">("loading");

  useEffect(() => {
    if (!itemId) return;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const redirect = `/q/i/${encodeURIComponent(itemId)}`;
        router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
        return;
      }

      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, qr_code, company_id")
        .eq("id", itemId)
        .maybeSingle();

      if (error) {
        console.error("QR item lookup:", error);
        setPhase("error");
        return;
      }

      if (!data?.id) {
        setPhase("error");
        return;
      }

      const qrCode = data.qr_code?.trim();
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
      router.replace(`/?mp_qr_scan=${encodeURIComponent(qrCode)}`);
    })();
  }, [itemId, router]);

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
