import { describe, expect, it } from "vitest";
import { buildOnboardingEmail } from "@/lib/onboardingEmails";
import { helpGuideHref } from "@/lib/helpGuides";

describe("onboarding emails", () => {
  it("builds the day-2 email in Spanish with guide links", () => {
    const { subject, html } = buildOnboardingEmail({ kind: "day2", lang: "es", userName: "Ana", companyName: "Reformas Sol" });
    expect(subject).toBe("Pon a tu equipo en marcha con MachinPro");
    expect(html).toContain("Hola Ana");
    expect(html).toContain("Reformas Sol");
    expect(html).toContain("https://machin.pro/help?lang=es#guide_clock");
    expect(html).toContain("Fichaje y registro de jornada");
  });
  it("builds every language and kind", () => {
    for (const lang of ["es", "en", "fr", "de", "it", "pt"] as const)
      for (const kind of ["day2", "day5"] as const) {
        const { subject, html } = buildOnboardingEmail({ kind, lang, userName: "X", companyName: "Y" });
        expect(subject.length).toBeGreaterThan(5);
        expect(html).not.toContain("{name}");
        expect(html).not.toContain("guide_daily_title");
      }
  });
  it("falls back to English for languages without guides", () => {
    expect(helpGuideHref("pl", "guide_tools")).toBe("/help?lang=en#guide_tools");
  });
});
