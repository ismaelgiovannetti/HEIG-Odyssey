import { Dex } from "@pkmn/sim";
import { loadSpecies } from "../content/loader";
import type { Species, Move, PokemonType } from "../content/schemas";

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
