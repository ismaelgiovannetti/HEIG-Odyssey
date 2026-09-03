import { TRAINING_MIN_LEVEL, calculateTrainingOpponentLevel } from "../training/level-algorithm";
import { generateTrainingOpponentTeam } from "../training/opponent-generator";
import type { TrainingDifficulty } from "../training/difficulty";
import type { Trainer, AIProfile } from "../content/schemas";

export type { TrainingDifficulty } from "../training/difficulty";

/**
 * Niveau moyen de l'équipe du joueur, borné [5, 100] (T-US09-01). Une équipe
 * vide retombe sur le plancher plutôt que de lever une erreur : ce chemin
 * n'est atteint qu'en dehors du flux HTTP normal, qui exige déjà 1 à 6
 * membres via validateTeamComposition avant d'arriver ici.
 */
export function computeAverageTeamLevel(team: Array<{ level: number }>): number {
  if (!team || team.length === 0) return TRAINING_MIN_LEVEL;
  return calculateTrainingOpponentLevel(team.map((pokemon) => pokemon.level)).opponentLevel;
}

/** Associe la difficulté d'entraînement au profil d'intelligence artificielle correspondant. */
export function difficultyToAIProfile(difficulty: TrainingDifficulty): AIProfile {
  switch (difficulty) {
    case "easy":
      return "random";
    case "normal":
      return "heuristic";
    case "hard":
      return "expectiminimax";
    default:
      return "random";
  }
}

const DIFFICULTY_TECHNICAL_NAMES: Record<TrainingDifficulty, string> = {
  easy: "Facile (Aléatoire)",
  normal: "Normal (Heuristique)",
  hard: "Difficile (Expectiminimax)",
};

/**
 * Construit le dresseur virtuel d'entraînement : équipe tirée du pool de
 * contenu complet (T-US09-02, pas d'un pool figé), au niveau déjà calculé
 * par l'appelant.
 */
export function generateTrainingOpponent(params: {
  averageLevel: number;
  difficulty: TrainingDifficulty;
  teamSize?: number;
}): Trainer {
  const { averageLevel, difficulty, teamSize = 1 } = params;

  return {
    id: `training-${difficulty}`,
    name: "IA d'Entraînement",
    title: `Niveau ${DIFFICULTY_TECHNICAL_NAMES[difficulty]}`,
    aiProfile: difficultyToAIProfile(difficulty),
    sprite: "trainer-champion-front",
    introCatchline: "Début de la simulation d'entraînement.",
    // Les conclusions suivent le point de vue du joueur, comme les libellés :
    // `victoryCatchline` s'affiche quand le joueur gagne, `defeatCatchline` quand
    // il perd. Contrat commun avec les dresseurs de campagne.
    victoryCatchline: "Simulation terminée. Bravo pour votre victoire !",
    defeatCatchline: "Simulation terminée. Réessayez pour parfaire votre stratégie.",
    musicTrack: "battle-theme-1",
    team: generateTrainingOpponentTeam(averageLevel, teamSize),
  };
}
