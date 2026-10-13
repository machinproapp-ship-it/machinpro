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
