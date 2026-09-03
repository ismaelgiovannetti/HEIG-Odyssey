import { describe, expect, it } from "vitest";
import { formatGameInteger } from "@/lib/format-number";

describe("formatage déterministe des nombres du jeu", () => {
  it("utilise toujours une espace fine insécable pour les milliers", () => {
    expect(formatGameInteger(40)).toBe("40");
    expect(formatGameInteger(99_750)).toBe("99\u202F750");
    expect(formatGameInteger(1_000_000)).toBe("1\u202F000\u202F000");
  });

  it("gère les valeurs négatives et neutralise les valeurs non finies", () => {
    expect(formatGameInteger(-1_250)).toBe("-1\u202F250");
    expect(formatGameInteger(Number.NaN)).toBe("0");
  });
});
