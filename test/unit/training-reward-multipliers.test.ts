import { describe, expect, it } from "vitest";
import {
  calculateDefeatedPokemonXp,
  calculateTrainingBaseXp,
  calculateTrainingReward,
  DIFFICULTY_REWARD_MULTIPLIERS,
  DIFFICULTY_XP_MULTIPLIERS,
  TRAINING_BASE_REWARD,
} from "@/lib/rewards/reward-service";

describe("Multiplicateurs de récompense d'entraînement (T-US10-04)", () => {
  it("définit les multiplicateurs d'XP conformes aux exigences (x1, x1.5, x3)", () => {
    expect(DIFFICULTY_REWARD_MULTIPLIERS.easy.xp).toBe(1);
    expect(DIFFICULTY_REWARD_MULTIPLIERS.normal.xp).toBe(1.5);
    expect(DIFFICULTY_REWARD_MULTIPLIERS.hard.xp).toBe(3);

    expect(DIFFICULTY_XP_MULTIPLIERS).toEqual({
      easy: 1,
      normal: 1.5,
      hard: 3,
    });
  });

  it("applique le multiplicateur 1 pour la difficulté facile (référence)", () => {
    expect(calculateTrainingReward("easy")).toEqual({
      money: TRAINING_BASE_REWARD.money,
      xp: TRAINING_BASE_REWARD.xp,
    });
  });

  it("dérive chaque récompense de la base et de son multiplicateur configuré", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      const multiplier = DIFFICULTY_REWARD_MULTIPLIERS[difficulty];
      expect(calculateTrainingReward(difficulty)).toEqual({
        money: Math.round(TRAINING_BASE_REWARD.money * multiplier.money),
        xp: Math.round(TRAINING_BASE_REWARD.xp * multiplier.xp),
      });
    }
  });

  it("augmente strictement la monnaie et l'XP à mesure que la difficulté monte", () => {
    const easy = calculateTrainingReward("easy");
    const normal = calculateTrainingReward("normal");
    const hard = calculateTrainingReward("hard");

    expect(normal.money).toBeGreaterThan(easy.money);
    expect(hard.money).toBeGreaterThan(normal.money);
    expect(normal.xp).toBeGreaterThan(easy.xp);
    expect(hard.xp).toBeGreaterThan(normal.xp);
  });

  it("calcule l'XP par Pokémon selon la formule de combat de dresseur (Gen 4)", () => {
    // floor((baseExp * level * 1.5) / 7)
    // Au niveau 5 (starter), avec baseExp 100 : floor((100 * 5 * 1.5) / 7) = floor(750 / 7) = 107
    expect(calculateDefeatedPokemonXp({ level: 5 })).toBe(107);
    // Au niveau 20, avec baseExp 100 : floor((100 * 20 * 1.5) / 7) = floor(3000 / 7) = 428
    expect(calculateDefeatedPokemonXp({ level: 20 })).toBe(428);
    // Au niveau 50, avec baseExp 100 : floor((100 * 50 * 1.5) / 7) = floor(7500 / 7) = 1071
    expect(calculateDefeatedPokemonXp({ level: 50 })).toBe(1071);
  });

  it("ne récompense pas de manière fixe : l'XP s'adapte au niveau de l'adversaire et aux Pokémon vaincus", () => {
    const lowLevelReward = calculateTrainingReward("easy", {
      opponentAverageLevel: 5,
      teamSize: 1,
    });
    const midLevelReward = calculateTrainingReward("easy", {
      opponentAverageLevel: 25,
      teamSize: 1,
    });
    const highLevelReward = calculateTrainingReward("easy", {
      opponentAverageLevel: 50,
      teamSize: 1,
    });

    expect(midLevelReward.xp).toBeGreaterThan(lowLevelReward.xp);
    expect(highLevelReward.xp).toBeGreaterThan(midLevelReward.xp);

    // Une équipe plus nombreuse rapporte davantage d'XP
    const threePokemonReward = calculateTrainingReward("easy", {
      opponentAverageLevel: 25,
      teamSize: 3,
    });
    expect(threePokemonReward.xp).toBe(midLevelReward.xp * 3);
  });

  it("applique les multiplicateurs (x1, x1.5, x3) sur l'XP de combat calculée", () => {
    const options = { opponentAverageLevel: 20, teamSize: 2 };
    const baseXp = calculateTrainingBaseXp(options);

    const easy = calculateTrainingReward("easy", options);
    const normal = calculateTrainingReward("normal", options);
    const hard = calculateTrainingReward("hard", options);

    expect(easy.xp).toBe(Math.round(baseXp * 1));
    expect(normal.xp).toBe(Math.round(baseXp * 1.5));
    expect(hard.xp).toBe(Math.round(baseXp * 3));
  });

  it("ne duplique pas la configuration : un seul multiplicateur par difficulté et par ressource", () => {
    expect(Object.keys(DIFFICULTY_REWARD_MULTIPLIERS)).toEqual([
      "easy",
      "normal",
      "hard",
    ]);
  });
});
