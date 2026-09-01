import { loadSpecies } from "../content/loader";
import type { Species, Trainer, TrainerPokemon, Move, AIProfile } from "../content/schemas";


export type TrainingDifficulty = "easy" | "normal" | "hard";

/**
 * Calcule le niveau moyen de l'équipe du joueur, borné entre 5 et 100.
 */
export function computeAverageTeamLevel(team: Array<{ level: number }>): number {
  if (!team || team.length === 0) return 5;
  const total = team.reduce((acc, curr) => acc + curr.level, 0);
  const avg = Math.round(total / team.length);
  return Math.min(100, Math.max(5, avg));
}

/**
 * Associe la difficulté d'entraînement au profil d'intelligence artificielle correspondant.
 */
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

const DEFAULT_FALLBACK_MOVES: Record<string, Move[]> = {
  Normal: [
    { id: "tackle", name: "Charge", type: "Normal", category: "physical", power: 40, accuracy: 100, pp: 35, maxPp: 35, priority: 0 },
    { id: "quickattack", name: "Vive-Attaque", type: "Normal", category: "physical", power: 40, accuracy: 100, pp: 30, maxPp: 30, priority: 1 },
  ],
  Grass: [
    { id: "razorleaf", name: "Tranch'Herbe", type: "Grass", category: "physical", power: 55, accuracy: 95, pp: 25, maxPp: 25, priority: 0 },
    { id: "energyball", name: "Éco-Sphère", type: "Grass", category: "special", power: 90, accuracy: 100, pp: 10, maxPp: 10, priority: 0 },
  ],
  Fire: [
    { id: "ember", name: "Flammèche", type: "Fire", category: "special", power: 40, accuracy: 100, pp: 25, maxPp: 25, priority: 0 },
    { id: "flamethrower", name: "Lance-Flammes", type: "Fire", category: "special", power: 90, accuracy: 100, pp: 15, maxPp: 15, priority: 0 },
  ],
  Water: [
    { id: "watergun", name: "Pistolet à O", type: "Water", category: "special", power: 40, accuracy: 100, pp: 25, maxPp: 25, priority: 0 },
    { id: "surf", name: "Surf", type: "Water", category: "special", power: 90, accuracy: 100, pp: 15, maxPp: 15, priority: 0 },
  ],
  Electric: [
    { id: "thundershock", name: "Éclair", type: "Electric", category: "special", power: 40, accuracy: 100, pp: 30, maxPp: 30, priority: 0 },
    { id: "thunderbolt", name: "Tonnerre", type: "Electric", category: "special", power: 90, accuracy: 100, pp: 15, maxPp: 15, priority: 0 },
  ],
};

function getMovesForSpecies(species: Species, level: number): Move[] {
  const primaryType = species.types[0] || "Normal";
  const typeMoves = DEFAULT_FALLBACK_MOVES[primaryType] || DEFAULT_FALLBACK_MOVES.Normal;

  // À haut niveau, on privilégie l'attaque la plus puissante
  if (level >= 30 && typeMoves.length > 1) {
    return [typeMoves[1], typeMoves[0]];
  }
  return [typeMoves[0]];
}

const CANDIDATE_TRAINING_SPECIES = [
  "turtwig", "chimchar", "piplup", "starly", "shinx",
  "bidoof", "buizel", "cranidos", "gible", "riolu"
];

/**
 * Génère un dresseur virtuel et une équipe adverse adaptée pour le mode entraînement (T-US09-03).
 */
export function generateTrainingOpponent(params: {
  averageLevel: number;
  difficulty: TrainingDifficulty;
  teamSize?: number;
}): Trainer {
  const { averageLevel, difficulty, teamSize = 1 } = params;
  const aiProfile = difficultyToAIProfile(difficulty);
  const speciesMap = loadSpecies();

  const count = Math.min(6, Math.max(1, teamSize));
  const team: TrainerPokemon[] = [];

  for (let i = 0; i < count; i++) {
    const speciesId = CANDIDATE_TRAINING_SPECIES[i % CANDIDATE_TRAINING_SPECIES.length];
    const species = speciesMap.get(speciesId) || {
      id: speciesId,
      name: speciesId,
      types: ["Normal"],
    } as any;

    const moves = getMovesForSpecies(species, averageLevel);

    team.push({
      speciesId,
      nickname: `Adversaire ${i + 1}`,
      level: averageLevel,
      moves,
      ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
      nature: "Hardy",
      isShiny: false,
    });
  }

  const difficultyNames = {
    easy: "Facile (Aléatoire)",
    normal: "Normal (Heuristique)",
    hard: "Difficile (Expectiminimax)",
  };

  return {
    id: `training-${difficulty}`,
    name: `IA d'Entraînement`,
    title: `Niveau ${difficultyNames[difficulty]}`,
    aiProfile,
    sprite: "trainer-champion-front",
    introCatchline: "Début de la simulation d'entraînement.",
    victoryCatchline: "Simulation terminée. Bravo pour votre victoire !",
    defeatCatchline: "Simulation terminée. Réessayez pour parfaire votre stratégie.",
    musicTrack: "battle-theme-1",
    team,
  };
}
