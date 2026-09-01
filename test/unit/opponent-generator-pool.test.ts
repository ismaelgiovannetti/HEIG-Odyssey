import { describe, expect, it } from "vitest";
import { getTrainingSpeciesPool } from "@/lib/training/opponent-generator";

describe("Pool d'espèces pour l'entraînement (T-US09-02)", () => {
  it("exclut toutes les espèces légendaires et mythiques", () => {
    const pool = getTrainingSpeciesPool();
    expect(pool.every((species) => !species.isLegendary && !species.isMythical)).toBe(true);
  });

  it("conserve un pool non vide et strictement plus petit que le contenu total", () => {
    const pool = getTrainingSpeciesPool();
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.length).toBeLessThan(493);
  });

  it("ne contient aucun doublon d'identifiant", () => {
    const pool = getTrainingSpeciesPool();
    expect(new Set(pool.map((species) => species.id)).size).toBe(pool.length);
  });
});
