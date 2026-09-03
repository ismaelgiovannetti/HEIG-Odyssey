import { describe, expect, it } from "vitest";
import {
  calculateTrainingOpponentLevel,
  TRAINING_MIN_LEVEL,
  TRAINING_MAX_LEVEL,
} from "@/lib/training/level-algorithm";

describe("Algorithme de niveau moyen d'entraînement (T-US09-01)", () => {
  it("calcule la moyenne d'une équipe homogène sans clamp", () => {
    const result = calculateTrainingOpponentLevel([20, 20, 20]);
    expect(result).toEqual({
      referenceLevel: 20,
      opponentLevel: 20,
      wasClamped: false,
    });
  });

  it("arrondit la moyenne à l'entier le plus proche (moitié vers le haut)", () => {
    expect(calculateTrainingOpponentLevel([5, 6]).referenceLevel).toBe(6); // 5.5 -> 6
    expect(calculateTrainingOpponentLevel([5, 5, 6]).referenceLevel).toBe(5); // 5.33 -> 5
  });

  it("traite une équipe incomplète (1 membre) comme n'importe quelle autre", () => {
    const result = calculateTrainingOpponentLevel([42]);
    expect(result).toEqual({
      referenceLevel: 42,
      opponentLevel: 42,
      wasClamped: false,
    });
  });

  it("ne clampe pas une équipe faible mais valide (niveau starter)", () => {
    const result = calculateTrainingOpponentLevel([5, 5]);
    expect(result).toEqual({
      referenceLevel: 5,
      opponentLevel: 5,
      wasClamped: false,
    });
  });

  it("ne clampe pas une équipe au niveau maximal Gen 4", () => {
    const result = calculateTrainingOpponentLevel([100, 100, 100]);
    expect(result).toEqual({
      referenceLevel: 100,
      opponentLevel: 100,
      wasClamped: false,
    });
  });

  it("ramène au plancher un niveau de référence sous la borne minimale", () => {
    const result = calculateTrainingOpponentLevel([1, 1]);
    expect(result).toEqual({
      referenceLevel: 1,
      opponentLevel: TRAINING_MIN_LEVEL,
      wasClamped: true,
    });
  });

  it("plafonne un niveau de référence au-dessus de la borne maximale", () => {
    const result = calculateTrainingOpponentLevel([150]);
    expect(result).toEqual({
      referenceLevel: 150,
      opponentLevel: TRAINING_MAX_LEVEL,
      wasClamped: true,
    });
  });

  it("gère une équipe mixte faible/fort sans dépasser les bornes", () => {
    const result = calculateTrainingOpponentLevel([5, 100]);
    expect(result.referenceLevel).toBe(53); // (5+100)/2 = 52.5 -> 53
    expect(result.opponentLevel).toBe(53);
    expect(result.wasClamped).toBe(false);
  });

  it("refuse une équipe vide avec une erreur explicite", () => {
    expect(() => calculateTrainingOpponentLevel([])).toThrow(
      "Impossible de calculer un niveau d'entraînement sans équipe active.",
    );
  });
});
