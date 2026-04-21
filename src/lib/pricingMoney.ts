/** Formatting helper for IAP-style multi-currency pricing displays (Intl). */

export function formatPricingMoney(amount: number, currencyCode: string): string {
  const c = currencyCode.trim().toUpperCase();
  const localeByCurrency: Record<string, string> = {
    CAD: "en-CA",
    USD: "en-US",
    GBP: "en-GB",
    EUR: "de-DE",
    CHF: "de-CH",
    SEK: "sv-SE",
    NOK: "nb-NO",
    DKK: "da-DK",
    AUD: "en-AU",
    NZD: "en-NZ",
    MXN: "es-MX",
    ARS: "es-AR",
    CLP: "es-CL",
    COP: "es-CO",
    BRL: "pt-BR",
  };
  const locale = localeByCurrency[c] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: c,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  }
}
