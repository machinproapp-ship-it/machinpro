import { redirect } from "next/navigation";

/** Cancelación Stripe Checkout → pricing in-app en facturación. */
export default function PricingPage() {
  redirect("/billing?canceled=1");
}
