import { Dex } from "@pkmn/sim";
import type { Move, PokemonType } from "./schemas";

const dex = Dex.forGen(4);

/** Reconstruit une capacité complète du jeu à partir de son identifiant. */
export function hydrateMove(moveId: string): Move {
  const moveData = dex.moves.get(moveId);
  return {
    id: moveId,
    name: moveData.name,
    type: (moveData.type === "???" ? "Ghost" : moveData.type) as PokemonType,
    category:
      (moveData.category.toLowerCase() as Move["category"]) || "physical",
    power: moveData.basePower || 0,
    accuracy:
      moveData.accuracy === true
        ? 100
        : (moveData.accuracy as number) || 100,
    pp: moveData.pp,
    maxPp: moveData.pp,
    priority: moveData.priority || 0,
  };
}

export function hydrateMoves(moveIds: string[]): Move[] {
  return moveIds.map(hydrateMove);
}
