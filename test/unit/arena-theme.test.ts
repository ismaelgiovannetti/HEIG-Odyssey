import { describe, it, expect } from "vitest";
import { arenaThemeForStage, ARENA_THEMES } from "@/lib/campaign/arena-theme";

describe("arena-theme", () => {
  it("déduit le thème d'une étape depuis son monde", () => {
    expect(arenaThemeForStage("bachelor-1-stage-1")).toBe("normal");
    expect(arenaThemeForStage("bachelor-2-stage-7")).toBe("grass");
    expect(arenaThemeForStage("bachelor-3-stage-3")).toBe("electric");
    expect(arenaThemeForStage("bachelor-4-stage-9")).toBe("steel");
    expect(arenaThemeForStage("bachelor-5-stage-10")).toBe("psychic");
    expect(arenaThemeForStage("master-1-stage-11")).toBe("poison");
    expect(arenaThemeForStage("master-2-stage-12")).toBe("dragon");
    expect(arenaThemeForStage("doctorat-stage-6")).toBe("neutral");
  });

  it("retombe sur « neutral » pour un monde inconnu ou une valeur vide", () => {
    expect(arenaThemeForStage("mystere-stage-1")).toBe("neutral");
    expect(arenaThemeForStage(undefined)).toBe("neutral");
    expect(arenaThemeForStage(null)).toBe("neutral");
    expect(arenaThemeForStage("")).toBe("neutral");
  });

  it("chaque thème renvoyé fait partie de la liste connue", () => {
    for (const id of ["bachelor-1", "master-2", "doctorat", "x"].map(
      (w) => `${w}-stage-1`,
    )) {
      expect(ARENA_THEMES).toContain(arenaThemeForStage(id));
    }
  });
});
