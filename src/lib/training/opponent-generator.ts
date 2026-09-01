import { Dex } from "@pkmn/sim";
import { loadSpecies } from "../content/loader";
import { TrainerSchema } from "../content/schemas";
import type { Species, Move, PokemonType, TrainerPokemon } from "../content/schemas";

const dex = Dex.forGen(4);

/**
 * Sous-ensemble du contenu éligible comme adversaire d'entraînement.
 * Les légendaires et mythiques sont exclus : un adversaire d'entraînement
 * doit rester représentatif du pool courant, pas un pic de difficulté hors
 * de la portée d'une équipe de joueur classique.
 */
export function getTrainingSpeciesPool(): Species[] {
  return Array.from(loadSpecies().values()).filter(
    (species) => !species.isLegendary && !species.isMythical,
  );
}

/**
 * Reconstruit un move complet depuis le Dex Gen 4 à partir d'un simple ID
 * (`species.defaultMoves` ne stocke que des IDs, pas des objets Move — même
 * pattern que la lecture des logs de combat dans battle-engine.ts).
 * Un move fraîchement généré n'a jamais été utilisé : pp = maxPp.
 */
export function hydrateMove(moveId: string): Move {
  const moveData = dex.moves.get(moveId);
  return {
    id: moveId,
    name: moveData.name,
    type: (moveData.type === "???" ? "Ghost" : moveData.type) as PokemonType,
    category: (moveData.category.toLowerCase() as "physical" | "special" | "status") || "physical",
    power: moveData.basePower || 0,
    accuracy: moveData.accuracy === true ? 100 : (moveData.accuracy as number) || 100,
    pp: moveData.pp,
    maxPp: moveData.pp,
    priority: moveData.priority || 0,
  };
}

export function hydrateMoves(moveIds: string[]): Move[] {
  return moveIds.map(hydrateMove);
}

function pickDistinctSpecies(pool: Species[], count: number, rng: () => number): Species[] {
  // Tirage sans remise (Fisher-Yates partiel) : deux appels successifs
  // donnent des compositions différentes, comme l'exige le critère
  // d'acceptation US-09, sans jamais dupliquer une espèce dans l'équipe.
  const remaining = [...pool];
  const picked: Species[] = [];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const index = Math.floor(rng() * remaining.length);
    picked.push(remaining.splice(index, 1)[0]);
  }
  return picked;
}

/**
 * Génère une équipe adverse d'entraînement : `teamSize` espèces distinctes
 * tirées du pool, toutes au niveau calculé par calculateTrainingOpponentLevel
 * (T-US09-01), avec leur moveset par défaut hydraté depuis le Dex.
 * `rng` est injectable pour des tests déterministes ; Math.random en usage réel.
 */
export function generateTrainingOpponentTeam(
  level: number,
  teamSize: number,
  rng: () => number = Math.random,
): TrainerPokemon[] {
  // Bornes du format de combat, identiques à celles de TrainerSchema.team.
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 6) {
    throw new Error("La taille de l'équipe adverse doit être comprise entre 1 et 6.");
  }

  const selected = pickDistinctSpecies(getTrainingSpeciesPool(), teamSize, rng);
  const team = selected.map((species) => ({
    speciesId: species.id,
    level,
    moves: hydrateMoves(species.defaultMoves),
  }));

  // Défense en profondeur : garantit la légalité même si le contenu évolue.
  return TrainerSchema.shape.team.parse(team);
}
