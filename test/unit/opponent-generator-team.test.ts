import { describe, expect, it } from "vitest";
import { generateTrainingOpponentTeam } from "@/lib/training/opponent-generator";
import { createSeededRng } from "../helpers/deterministic-rng";

// RNG déterministe : consomme une séquence fixe de valeurs [0,1) fournie au test.
function fakeRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("Génération de l'équipe adverse d'entraînement (T-US09-02)", () => {
  it("produit une équipe de la taille demandée, toutes au niveau calculé", () => {
    const team = generateTrainingOpponentTeam(42, 3, fakeRng([0, 0.5, 0.9]));
    expect(team).toHaveLength(3);
    expect(team.every((member) => member.level === 42)).toBe(true);
  });

  it("ne contient jamais deux fois la même espèce", () => {
    const team = generateTrainingOpponentTeam(
      30,
      6,
      createSeededRng(0x1badb002),
    );
    expect(new Set(team.map((member) => member.speciesId)).size).toBe(6);
  });

  it("donne à chaque membre au moins un move légal (1 à 4)", () => {
    const team = generateTrainingOpponentTeam(30, 4, createSeededRng(0xc0ffee));
    for (const member of team) {
      expect(member.moves.length).toBeGreaterThanOrEqual(1);
      expect(member.moves.length).toBeLessThanOrEqual(4);
    }
  });

  it("refuse une taille d'équipe hors des bornes du format de combat", () => {
    expect(() => generateTrainingOpponentTeam(30, 0)).toThrow();
    expect(() => generateTrainingOpponentTeam(30, 7)).toThrow();
  });

  it("reproduit une graine et distingue deux séquences différentes", () => {
    const first = generateTrainingOpponentTeam(
      50,
      6,
      createSeededRng(0x12345678),
    );
    const replay = generateTrainingOpponentTeam(
      50,
      6,
      createSeededRng(0x12345678),
    );
    const second = generateTrainingOpponentTeam(
      50,
      6,
      createSeededRng(0xdeadbeef),
    );
    const speciesIds = (team: typeof first) =>
      team.map((member) => member.speciesId);

    expect(speciesIds(replay)).toEqual(speciesIds(first));
    expect(speciesIds(second)).not.toEqual(speciesIds(first));
  });

  it("respecte les mêmes bornes de niveau que T-US09-01 (5 à 100)", () => {
    const low = generateTrainingOpponentTeam(5, 1, createSeededRng(0xabc));
    const high = generateTrainingOpponentTeam(100, 1, createSeededRng(0xdef));
    expect(low[0].level).toBe(5);
    expect(high[0].level).toBe(100);
  });
});
