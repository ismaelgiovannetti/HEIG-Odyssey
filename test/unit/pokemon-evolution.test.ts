import { describe, it, expect } from "vitest";
import { getEvolutionOptions } from "@/lib/pokemon/pokemon-evolution-service";

describe("pokemon-evolution-service", () => {
  describe("getEvolutionOptions", () => {
    it("returns Ivysaur for Bulbasaur with required level 16", () => {
      const optionsLvl5 = getEvolutionOptions("bulbasaur", 5);
      expect(optionsLvl5).toHaveLength(1);
      expect(optionsLvl5[0].targetSpeciesId).toBe("ivysaur");
      expect(optionsLvl5[0].targetName).toBe("Herbizarre");
      expect(optionsLvl5[0].requiredLevel).toBe(16);
      expect(optionsLvl5[0].canEvolve).toBe(false);

      const optionsLvl16 = getEvolutionOptions("bulbasaur", 16);
      expect(optionsLvl16[0].canEvolve).toBe(true);
    });

    it("returns Venusaur for Ivysaur with required level 32", () => {
      const optionsLvl20 = getEvolutionOptions("ivysaur", 20);
      expect(optionsLvl20).toHaveLength(1);
      expect(optionsLvl20[0].targetSpeciesId).toBe("venusaur");
      expect(optionsLvl20[0].targetName).toBe("Florizarre");
      expect(optionsLvl20[0].requiredLevel).toBe(32);
      expect(optionsLvl20[0].canEvolve).toBe(false);

      const optionsLvl32 = getEvolutionOptions("ivysaur", 32);
      expect(optionsLvl32[0].canEvolve).toBe(true);
    });

    it("returns empty array for final stage Pokemon (Venusaur)", () => {
      const options = getEvolutionOptions("venusaur", 50);
      expect(options).toHaveLength(0);
    });

    it("returns exactly the 7 Gen 1-4 evolutions for Eevee and excludes Gen 6+ (Sylveon)", () => {
      const options = getEvolutionOptions("eevee", 25);
      expect(options).toHaveLength(7);

      const evoIds = options.map((o) => o.targetSpeciesId);
      expect(evoIds).toContain("vaporeon");
      expect(evoIds).toContain("jolteon");
      expect(evoIds).toContain("flareon");
      expect(evoIds).toContain("espeon");
      expect(evoIds).toContain("umbreon");
      expect(evoIds).toContain("leafeon");
      expect(evoIds).toContain("glaceon");
      // Sylveon (Gen 6) must NOT be present
      expect(evoIds).not.toContain("sylveon");
    });

    it("excludes Gen 9 cross-gen evolutions (e.g. Primeape -> Annihilape)", () => {
      const options = getEvolutionOptions("primeape", 50);
      expect(options).toHaveLength(0);
    });
  });
});
