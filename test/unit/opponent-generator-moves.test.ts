import { describe, expect, it } from "vitest";
import { hydrateMove, hydrateMoves } from "@/lib/training/opponent-generator";

describe("Hydratation des moves depuis le Dex Gen 4 (T-US09-02)", () => {
  it("reconstruit un move complet et légal à partir de son ID", () => {
    const move = hydrateMove("tackle");
    expect(move).toMatchObject({
      id: "tackle",
      name: "Tackle",
      type: "Normal",
      category: "physical",
    });
    expect(move.power).toBeGreaterThan(0);
    expect(move.pp).toBe(move.maxPp);
  });

  it("part toujours d'un move non utilisé (pp = maxPp)", () => {
    const move = hydrateMove("thunderbolt");
    expect(move.pp).toBe(move.maxPp);
  });

  it("hydrate une liste complète de moves dans l'ordre fourni", () => {
    const moves = hydrateMoves(["tackle", "growl"]);
    expect(moves.map((m) => m.id)).toEqual(["tackle", "growl"]);
  });

  it("convertit un move de statut sans dégâts (power à 0)", () => {
    const move = hydrateMove("growl");
    expect(move.category).toBe("status");
    expect(move.power).toBe(0);
  });
});
