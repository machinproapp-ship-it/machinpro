import { describe, expect, it } from "vitest";
import { passwordProblem } from "@/lib/passwordPolicy";
import { userFacingErrorMessage } from "@/lib/userFacingError";

describe("passwordPolicy", () => {
  it("pide 8 caracteres con minúscula, mayúscula y número (como Supabase)", () => {
    expect(passwordProblem("Ab1")).toBe("too_short");
    expect(passwordProblem("abcdefgh1")).toBe("needs_mix");
    expect(passwordProblem("ABCDEFGH1")).toBe("needs_mix");
    expect(passwordProblem("Abcdefghi")).toBe("needs_mix");
    expect(passwordProblem("Obra2026x")).toBeNull();
    expect(passwordProblem("Obra2026x", 10)).toBe("too_short");
  });
  it("traduce el error de Supabase en vez de 'algo ha salido mal'", () => {
    const msg = userFacingErrorMessage(
      { password_rule_mix: "MIX" },
      { message: "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz..." },
      true
    );
    expect(msg).toBe("MIX");
  });
});
