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

// Récompense de référence pour la difficulté la plus faible. Les autres
// valeurs sont calculées à partir de multiplicateurs communs au serveur et à
// l'interface, ce qui empêche l'affichage de gains obsolètes.
export const TRAINING_BASE_REWARD = { money: 50, xp: 100 } as const;

export const DIFFICULTY_REWARD_MULTIPLIERS: Record<
  TrainingDifficulty,
  { money: number; xp: number }
> = {
  easy: { money: 1, xp: 1 },
  normal: { money: 1.6, xp: 1.8 },
  hard: { money: 2.6, xp: 3.2 },
};

/** Calcule l'aperçu avec les mêmes constantes que l'attribution serveur. */
export function calculateTrainingReward(difficulty: TrainingDifficulty) {
  const multiplier = DIFFICULTY_REWARD_MULTIPLIERS[difficulty];
  return {
    money: Math.round(TRAINING_BASE_REWARD.money * multiplier.money),
    xp: Math.round(TRAINING_BASE_REWARD.xp * multiplier.xp),
  };
}
