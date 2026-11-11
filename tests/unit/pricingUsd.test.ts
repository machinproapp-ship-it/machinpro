import { describe, expect, it } from "vitest";
import { getUsdPriceForTier } from "@/lib/stripe";
import { formatPricingMoney } from "@/lib/pricingMoney";

describe("precios en USD", () => {
  it("el precio grande es lo que se cobra en USD, con céntimos si los hay", () => {
    expect(getUsdPriceForTier("esencial", "monthly", 1)).toBe(39);
    expect(getUsdPriceForTier("esencial", "annual", 1)).toBe(374.4);
    expect(formatPricingMoney(39, "USD")).toBe("$39");
    expect(formatPricingMoney(374.4, "USD")).toBe("$374.40");
  });
});

import { EUROZONE_COUNTRIES, EUR_PRICING_LIVE, getChargePrice } from "@/lib/stripe";

describe("cobro en euros", () => {
  it("España cobra en euros solo cuando están activados, con el 20% de su región", () => {
    const p = getChargePrice("esencial", "monthly", 2, "ES");
    if (EUR_PRICING_LIVE) expect(p).toEqual({ amount: 28, currency: "EUR" });
    else expect(p).toEqual({ amount: 31.2, currency: "USD" });
    expect(EUROZONE_COUNTRIES.has("ES")).toBe(true);
  });
  it("Canadá sigue en dólares", () => {
    expect(getChargePrice("todo_incluido", "monthly", 1, "CA")).toEqual({ amount: 99, currency: "USD" });
  });
});
