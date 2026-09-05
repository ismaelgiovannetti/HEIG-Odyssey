export type TrainingDifficulty = "easy" | "normal" | "hard";

export interface TrainingDifficultyDetails {
  label: string;
  shortDescription: string;
  behavior: string;
}

// Ces textes décrivent le comportement sans exposer les noms techniques des
// algorithmes. Le profil réellement exécuté reste choisi côté serveur.
export const TRAINING_DIFFICULTIES: Record<
  TrainingDifficulty,
  TrainingDifficultyDetails
> = {
  easy: {
    label: "Facile",
    shortDescription:
      "Pour découvrir une équipe ou essayer de nouvelles capacités.",
    behavior: "L’adversaire varie ses actions sans chercher le meilleur coup.",
  },
  normal: {
    label: "Normal",
    shortDescription: "Un duel équilibré pour progresser régulièrement.",
    behavior: "L’adversaire privilégie les actions immédiatement avantageuses.",
  },
  hard: {
    label: "Difficile",
    shortDescription: "Une opposition exigeante pour les équipes préparées.",
    behavior: "L’adversaire anticipe plusieurs possibilités avant de jouer.",
  },
};

// Récompense de référence pour la monnaie et XP par défaut.
export const TRAINING_BASE_REWARD = { money: 50, xp: 100 } as const;

export const DIFFICULTY_REWARD_MULTIPLIERS: Record<
  TrainingDifficulty,
  { money: number; xp: number }
> = {
  easy: { money: 1, xp: 1 },
  normal: { money: 1.6, xp: 1.5 },
  hard: { money: 2.6, xp: 3 },
};

export const DIFFICULTY_XP_MULTIPLIERS: Record<TrainingDifficulty, number> = {
  easy: 1,
  normal: 1.5,
  hard: 3,
};

/** Rendement de base moyen (Gen 4) par défaut ou selon le stade d'évolution. */
export const DEFAULT_BASE_EXP_YIELD = 100;

export function resolveBaseExpYield(options?: {
  stage?: number;
  baseStatTotal?: number;
  baseExp?: number;
}): number {
  if (options?.baseExp && options.baseExp > 0) {
    return options.baseExp;
  }
  if (options?.stage) {
    if (options.stage === 1) return 65;
    if (options.stage === 2) return 140;
    if (options.stage >= 3) return 220;
  }
  if (options?.baseStatTotal && options.baseStatTotal > 0) {
    return Math.max(30, Math.round(options.baseStatTotal / 3));
  }
  return DEFAULT_BASE_EXP_YIELD;
}

/**
 * Calcule l'expérience générée par la mise K.O. d'un Pokémon adverse selon
 * la formule des combats de dresseurs de la 4e génération :
 * floor( (baseExp * level * 1.5) / 7 )
 */
export function calculateDefeatedPokemonXp(params: {
  level: number;
  stage?: number;
  baseStatTotal?: number;
  baseExp?: number;
}): number {
  const level = Math.max(1, Math.min(100, Math.round(params.level)));
  const baseYield = resolveBaseExpYield(params);
  return Math.max(1, Math.floor((baseYield * level * 1.5) / 7));
}

export interface CalculateTrainingBaseXpParams {
  opponentTeam?: Array<{
    level: number;
    stage?: number;
    baseStatTotal?: number;
    baseExp?: number;
    isFainted?: boolean;
  }>;
  opponentAverageLevel?: number;
  teamSize?: number;
}

/**
 * Calcule l'XP de base issue d'un combat d'entraînement.
 * Si une équipe adverse est fournie, somme l'XP des Pokémon vaincus (ou de toute l'équipe si victorieux).
 * Sinon, se base sur le niveau moyen et le nombre de Pokémon adverses.
 */
export function calculateTrainingBaseXp(
  params?: CalculateTrainingBaseXpParams,
): number {
  if (params?.opponentTeam && params.opponentTeam.length > 0) {
    const targets = params.opponentTeam.some((p) => p.isFainted)
      ? params.opponentTeam.filter((p) => p.isFainted)
      : params.opponentTeam;
    return targets.reduce((sum, p) => sum + calculateDefeatedPokemonXp(p), 0);
  }

  const avgLevel = params?.opponentAverageLevel ?? 5;
  const size = Math.max(1, params?.teamSize ?? 1);
  const perPokemon = calculateDefeatedPokemonXp({ level: avgLevel });
  return perPokemon * size;
}

export interface CalculateTrainingRewardOptions extends CalculateTrainingBaseXpParams {
  baseXp?: number;
}

/**
 * Calcule les gains d'entraînement en appliquant le multiplicateur de difficulté (x1, x1.5, x3)
 * sur l'XP de base du combat (dérivée des Pokémon vaincus ou du niveau moyen adverse).
 */
export function calculateTrainingReward(
  difficulty: TrainingDifficulty,
  options?: CalculateTrainingRewardOptions,
) {
  const multiplier = DIFFICULTY_REWARD_MULTIPLIERS[difficulty];
  const baseXp =
    options?.baseXp ??
    (options?.opponentTeam || options?.opponentAverageLevel || options?.teamSize
      ? calculateTrainingBaseXp(options)
      : TRAINING_BASE_REWARD.xp);

  return {
    money: Math.round(TRAINING_BASE_REWARD.money * multiplier.money),
    xp: Math.round(baseXp * multiplier.xp),
  };
}
