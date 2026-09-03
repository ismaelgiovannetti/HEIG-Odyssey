// Bornes du niveau d'entraînement : 5 est le niveau du starter (plancher du
// jeu), 100 le plafond Gen 4 déjà appliqué au reste du contenu (voir
// TrainerPokemonSchema dans src/lib/content/schemas.ts).
export const TRAINING_MIN_LEVEL = 5;
export const TRAINING_MAX_LEVEL = 100;

export interface TrainingLevelResult {
  /** Moyenne arrondie des niveaux de l'équipe, avant application des bornes. */
  referenceLevel: number;
  /** Niveau à utiliser pour générer l'adversaire, une fois ramené dans les bornes. */
  opponentLevel: number;
  /** true si le niveau de référence a dû être ramené dans les bornes. */
  wasClamped: boolean;
}

/**
 * Calcule le niveau de l'adversaire d'entraînement à partir des niveaux de
 * l'équipe active (une équipe incomplète, de 1 à 5 membres, est traitée
 * comme n'importe quelle autre : la moyenne porte sur les membres présents).
 */
export function calculateTrainingOpponentLevel(
  teamLevels: number[],
): TrainingLevelResult {
  if (teamLevels.length === 0) {
    throw new Error(
      "Impossible de calculer un niveau d'entraînement sans équipe active.",
    );
  }

  const average =
    teamLevels.reduce((sum, level) => sum + level, 0) / teamLevels.length;
  const referenceLevel = Math.round(average);
  const opponentLevel = Math.min(
    TRAINING_MAX_LEVEL,
    Math.max(TRAINING_MIN_LEVEL, referenceLevel),
  );

  return {
    referenceLevel,
    opponentLevel,
    wasClamped: opponentLevel !== referenceLevel,
  };
}
