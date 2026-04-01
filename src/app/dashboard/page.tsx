import { redirect } from "next/navigation";

/** Tras Stripe Checkout; la app vive en `/`. Preserva `session_id` para el cliente. */
export default async function DashboardReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const sp = await searchParams;
  const sid = sp.session_id?.trim();
  redirect(sid ? `/?session_id=${encodeURIComponent(sid)}` : "/");
}
