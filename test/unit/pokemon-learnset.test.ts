import { describe, it, expect } from "vitest";
import {
  getLearnableMovesForSpecies,
  validateAndHydrateSelectedMoves,
  hydrateShowdownMove,
} from "@/lib/pokemon/pokemon-learnset-service";

describe("pokemon-learnset-service", () => {
  describe("getLearnableMovesForSpecies", () => {
    it("returns moves up to current level for Bulbasaur at level 5", async () => {
      const moves = await getLearnableMovesForSpecies("bulbasaur", 5);

      expect(moves.length).toBeGreaterThan(0);
      for (const move of moves) {
        expect(move.learnedAtLevel).toBeLessThanOrEqual(5);
        expect(move.name).toBeDefined();
        expect(move.type).toBeDefined();
        expect(move.category).toBeDefined();
        expect(move.pp).toBeGreaterThan(0);
      }

      // Bulbizarre lvl 5 has tackle (Charge) and growl (Rugissement)
      const ids = moves.map((m) => m.id);
      expect(ids).toContain("tackle");
      expect(ids).toContain("growl");
      // Leech seed is learned at lvl 7, should NOT be available at lvl 5
      expect(ids).not.toContain("leechseed");
    });

    it("includes higher-level moves for Bulbasaur at level 20", async () => {
      const moves = await getLearnableMovesForSpecies("bulbasaur", 20);
      const ids = moves.map((m) => m.id);

      expect(ids).toContain("tackle");
      expect(ids).toContain("growl");
      expect(ids).toContain("leechseed");
      expect(ids).toContain("vinewhip");
      expect(ids).toContain("poisonpowder");
      expect(ids).toContain("sleeppowder");
      expect(ids).toContain("takedown");
      expect(ids).toContain("razorleaf");
    });
  });

  describe("validateAndHydrateSelectedMoves", () => {
    it("validates legitimate move selections (1-4 moves)", async () => {
      const result = await validateAndHydrateSelectedMoves("bulbasaur", 10, [
        "tackle",
        "growl",
        "leechseed",
      ]);

      expect(result.isValid).toBe(true);
      expect(result.moves).toHaveLength(3);
      expect(result.moves![0].id).toBe("tackle");
      expect(result.moves![0].name).toBe("Charge");
    });

    it("rejects empty move selection", async () => {
      const result = await validateAndHydrateSelectedMoves("bulbasaur", 10, []);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("au moins 1 capacité");
    });

    it("rejects more than 4 moves", async () => {
      const result = await validateAndHydrateSelectedMoves("bulbasaur", 20, [
        "tackle",
        "growl",
        "leechseed",
        "vinewhip",
        "poisonpowder",
      ]);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("plus de 4");
    });

    it("rejects duplicate moves", async () => {
      const result = await validateAndHydrateSelectedMoves("bulbasaur", 10, [
        "tackle",
        "tackle",
      ]);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("double");
    });

    it("rejects moves that are not yet learned at current level", async () => {
      const result = await validateAndHydrateSelectedMoves("bulbasaur", 5, [
        "tackle",
        "solarbeam", // Solarbeam is learned much later / TM
      ]);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("hydrateShowdownMove", () => {
    it("hydrates French name and stats for common moves", () => {
      const tackle = hydrateShowdownMove("tackle");
      expect(tackle.name).toBe("Charge");
      expect(tackle.type).toBe("Normal");
      expect(tackle.category).toBe("physical");
      expect(tackle.pp).toBe(35);

      const ember = hydrateShowdownMove("ember");
      expect(ember.name).toBe("Flammèche");
      expect(ember.type).toBe("Fire");
      expect(ember.category).toBe("special");
    });
  });
});
