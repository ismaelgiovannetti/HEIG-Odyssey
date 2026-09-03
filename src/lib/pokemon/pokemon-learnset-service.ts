import { Dex } from "@pkmn/sim";
import type { Move, PokemonType } from "../content/schemas";
import { getMoveFrenchName } from "./move-names-fr";

const dex = Dex.forGen(4);

export interface LearnableMove extends Move {
  learnedAtLevel: number;
}

/**
 * Hydrate une capacité avec ses données Showdown Gen 4 et son libellé français.
 */
export function hydrateShowdownMove(moveId: string): Move {
  const data = dex.moves.get(moveId);
  const frenchName = getMoveFrenchName(moveId, data.name || moveId);

  return {
    id: moveId.toLowerCase(),
    name: frenchName,
    type: (data.type === "???" ? "Ghost" : data.type) as PokemonType,
    category: (data.category?.toLowerCase() as Move["category"]) || "physical",
    power: data.basePower || 0,
    accuracy: data.accuracy === true ? 100 : (data.accuracy as number) || 100,
    pp: data.pp || 35,
    maxPp: data.pp || 35,
    priority: data.priority || 0,
    description: data.shortDesc || data.desc || undefined,
  };
}

/**
 * Récupère toutes les capacités apprenables par un Pokémon jusqu'à son niveau actuel.
 */
export async function getLearnableMovesForSpecies(
  speciesId: string,
  level: number,
): Promise<LearnableMove[]> {
  const normalizedSpecies = speciesId.toLowerCase().replace(/[^a-z0-9]/g, "");
  const lData = await dex.learnsets.get(normalizedSpecies);

  const movesMap = new Map<string, number>();

  if (lData && lData.learnset) {
    for (const [mId, learnInfo] of Object.entries(lData.learnset)) {
      let minLevel = Infinity;

      for (const entry of learnInfo) {
        // Ex: "4L1", "4L16", "3L22", "1L1" (Appris par niveau)
        const match = entry.match(/^[1-4]L(\d+)$/);
        if (match) {
          const lvl = parseInt(match[1], 10);
          if (lvl < minLevel) {
            minLevel = lvl;
          }
        }
      }

      // Si l'attaque est apprise à ce niveau ou avant
      if (minLevel <= level) {
        movesMap.set(mId, minLevel);
      }
    }
  }

  // Si le learnset est vide (cas rare), ajouter Charge par défaut
  if (movesMap.size === 0) {
    movesMap.set("tackle", 1);
  }

  const result: LearnableMove[] = [];

  for (const [mId, learnedLevel] of movesMap.entries()) {
    const moveData = dex.moves.get(mId);

    // Filtrer strictement les capacités des Générations 1 à 4
    if (
      !moveData ||
      !moveData.exists ||
      (moveData.gen && moveData.gen > 4) ||
      moveData.isNonstandard
    ) {
      continue;
    }

    const hydrated = hydrateShowdownMove(mId);
    result.push({
      ...hydrated,
      learnedAtLevel: learnedLevel,
    });
  }

  // Trier par niveau d'apprentissage décroissant (les attaques les plus récentes en premier), puis par nom
  result.sort((a, b) => {
    if (b.learnedAtLevel !== a.learnedAtLevel) {
      return b.learnedAtLevel - a.learnedAtLevel;
    }
    return a.name.localeCompare(b.name);
  });

  return result;
}

/**
 * Valide et hydrate une liste de capacités choisies (1 à 4) pour un Pokémon et son niveau.
 */
export async function validateAndHydrateSelectedMoves(
  speciesId: string,
  level: number,
  selectedMoveIds: string[],
): Promise<{ isValid: boolean; moves?: Move[]; error?: string }> {
  if (!Array.isArray(selectedMoveIds) || selectedMoveIds.length === 0) {
    return { isValid: false, error: "Vous devez sélectionner au moins 1 capacité." };
  }

  if (selectedMoveIds.length > 4) {
    return { isValid: false, error: "Un Pokémon ne peut pas avoir plus de 4 capacités." };
  }

  const uniqueMoveIds = new Set(selectedMoveIds.map((id) => id.toLowerCase()));
  if (uniqueMoveIds.size !== selectedMoveIds.length) {
    return { isValid: false, error: "Une même capacité ne peut pas être équipée en double." };
  }

  const learnableMoves = await getLearnableMovesForSpecies(speciesId, level);
  const learnableIds = new Set(learnableMoves.map((m) => m.id));

  for (const moveId of uniqueMoveIds) {
    if (!learnableIds.has(moveId)) {
      return {
        isValid: false,
        error: `La capacité "${moveId}" n'est pas encore disponible ou n'est pas apprise par ce Pokémon au niveau ${level}.`,
      };
    }
  }

  const hydratedMoves = selectedMoveIds.map(hydrateShowdownMove);
  return { isValid: true, moves: hydratedMoves };
}
