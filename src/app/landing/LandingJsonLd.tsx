import { PAID_PLAN_ORDER, PLAN_PRICES_USD } from "@/lib/stripe";

const SITE = "https://machin.pro";

export function LandingJsonLd() {
  const description =
    "Manage your construction company from your phone. Projects, team, schedules, logistics and safety. All in one place. Available in 21 languages.";

  const offers = PAID_PLAN_ORDER.map((plan) => ({
    "@type": "Offer",
    name: plan.replace(/_/g, " "),
    price: String(PLAN_PRICES_USD[plan].monthly),
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    category: "subscription",
  }));

  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MachinPro",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    description,
    url: SITE,
    offers,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
