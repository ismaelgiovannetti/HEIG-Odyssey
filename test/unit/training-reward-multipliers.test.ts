import { describe, expect, it } from "vitest";
import {
  calculateTrainingReward,
  DIFFICULTY_REWARD_MULTIPLIERS,
  TRAINING_BASE_REWARD,
} from "@/lib/rewards/reward-service";

describe("Multiplicateurs de récompense d'entraînement (T-US10-04)", () => {
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

  it("ne duplique pas la configuration : un seul multiplicateur par difficulté et par ressource", () => {
    // Une difficulté = exactement une entrée dans la table, jamais recalculée ailleurs.
    expect(Object.keys(DIFFICULTY_REWARD_MULTIPLIERS)).toEqual(["easy", "normal", "hard"]);
  });
});
