import { redirect } from "next/navigation";

/** Precios públicos viven en la landing (`/landing#pricing`). */
export default function PricingRedirectPage() {
  redirect("/landing#pricing");
}
