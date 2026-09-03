import { Dex } from "@pkmn/sim";
import { prisma } from "../prisma";
import { getSpecies } from "../content/loader";
import { getSpeciesFrenchName } from "./species-names-fr";
import { calculateMaxHp } from "../team/team-validator";
import { isPokemonInActiveBattle } from "../combat/battle-session-store";
import { toCollectionEntry, type CollectionEntry } from "../team/collection-entry";
import { getEvolutionOptions, type EvolutionTarget } from "./pokemon-evolution-types";

export { getEvolutionOptions, type EvolutionTarget };

const dex = Dex.forGen(4);

export class PokemonEvolutionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "PokemonEvolutionError";
  }
}

/**
 * Fait évoluer un Pokémon possédé vers une espèce cible éligible.
 */
export async function evolveUserPokemon(
  userId: string,
  pokemonId: string,
  targetSpeciesId: string,
): Promise<{ success: boolean; pokemon: CollectionEntry; previousSpeciesName: string; newSpeciesName: string }> {
  return prisma.$transaction(async (tx) => {
    const pokemon = await tx.userPokemon.findFirst({
      where: { id: pokemonId, userId },
    });

    if (!pokemon) {
      throw new PokemonEvolutionError(
        "Pokémon introuvable dans votre collection.",
        404,
      );
    }

    if (isPokemonInActiveBattle(userId, pokemonId)) {
      throw new PokemonEvolutionError(
        "Ce Pokémon est actuellement engagé dans un combat actif.",
        409,
      );
    }

    const previousSpeciesName = getSpeciesFrenchName(pokemon.speciesId, pokemon.speciesId);

    const evolutionOptions = getEvolutionOptions(pokemon.speciesId, pokemon.level);
    const selectedEvolution = evolutionOptions.find(
      (opt) => opt.targetSpeciesId.toLowerCase() === targetSpeciesId.toLowerCase(),
    );

    if (!selectedEvolution) {
      throw new PokemonEvolutionError(
        `"${targetSpeciesId}" n'est pas une évolution valide pour ${previousSpeciesName}.`,
        400,
      );
    }

    if (!selectedEvolution.canEvolve) {
      throw new PokemonEvolutionError(
        `${previousSpeciesName} requiert le niveau ${selectedEvolution.requiredLevel} pour évoluer en ${selectedEvolution.targetName} (niveau actuel : ${pokemon.level}).`,
        400,
      );
    }

    const targetSpec = getSpecies(targetSpeciesId);
    const targetName = getSpeciesFrenchName(targetSpeciesId, targetSpec?.name || targetSpeciesId);

    // Recalcul des points de vie (PV max)
    const ivsObj = (pokemon.ivs as any) || { hp: 15 };
    const evsObj = (pokemon.evs as any) || { hp: 0 };
    const baseHp = targetSpec?.baseStats?.hp || dex.species.get(targetSpeciesId).baseStats.hp;

    const newMaxHp = calculateMaxHp(
      baseHp,
      pokemon.level,
      ivsObj.hp ?? 15,
      evsObj.hp ?? 0,
    );

    // Ajustement proportionnel des PV actuels
    const hpRatio = pokemon.maxHp > 0 ? pokemon.currentHp / pokemon.maxHp : 1;
    const newCurrentHp = pokemon.currentHp === 0 ? 0 : Math.max(1, Math.round(hpRatio * newMaxHp));

    // Si le surnom était le nom de l'ancienne espèce, on le met à jour avec le nouveau nom
    let updatedNickname = pokemon.nickname;
    if (!pokemon.nickname || pokemon.nickname === previousSpeciesName) {
      updatedNickname = targetName;
    }

    // Mise à jour de la créature
    const updated = await tx.userPokemon.update({
      where: { id: pokemonId, userId },
      data: {
        speciesId: targetSpeciesId.toLowerCase(),
        nickname: updatedNickname,
        maxHp: newMaxHp,
        currentHp: newCurrentHp,
        ability: targetSpec?.possibleAbilities?.[0] || pokemon.ability,
      },
    });

    return {
      success: true,
      pokemon: toCollectionEntry(updated),
      previousSpeciesName,
      newSpeciesName: targetName,
    };
  });
}
