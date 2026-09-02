import { Dex } from "@pkmn/sim";
import { prisma } from "../prisma";
import { getSpecies } from "../content/loader";
import { getSpeciesFrenchName } from "./species-names-fr";
import { calculateMaxHp } from "../team/team-validator";
import { isPokemonInActiveBattle } from "../combat/battle-session-store";
import { toCollectionEntry, type CollectionEntry } from "../team/collection-entry";

const dex = Dex.forGen(4);

export interface EvolutionTarget {
  targetSpeciesId: string;
  targetName: string;
  requiredLevel: number;
  canEvolve: boolean;
  evolutionMethod: string;
}

/**
 * Détermine le niveau requis pour les évolutions spéciales (Pierres, Échange, Bonheur).
 */
function getRequiredLevelForEvolution(targetData: any): number {
  if (targetData.evoLevel && typeof targetData.evoLevel === "number") {
    return targetData.evoLevel;
  }

  // Pour les évolutions par objet, pierre, échange ou amitié dans le cadre du MVP web :
  if (targetData.evoType === "trade") return 30;
  if (targetData.evoType === "useItem") return 25;
  if (targetData.evoType === "levelFriendship" || targetData.evoType === "levelHold") return 20;
  if (targetData.evoType === "levelMove") return targetData.evoLevel || 25;

  return 20; // Seuil par défaut
}

/**
 * Récupère les options d'évolution disponibles pour une espèce à un niveau donné.
 */
export function getEvolutionOptions(
  speciesId: string,
  currentLevel: number,
): EvolutionTarget[] {
  const normalizedSpecies = speciesId.toLowerCase().replace(/[^a-z0-9]/g, "");
  const speciesData = dex.species.get(normalizedSpecies);

  if (!speciesData || !speciesData.evos || speciesData.evos.length === 0) {
    return [];
  }

  const options: EvolutionTarget[] = [];

  for (const evoId of speciesData.evos) {
    const targetData = dex.species.get(evoId);
    const targetName = getSpeciesFrenchName(evoId, targetData.name || evoId);

    const requiredLevel = getRequiredLevelForEvolution(targetData);
    const canEvolve = currentLevel >= requiredLevel;

    options.push({
      targetSpeciesId: evoId.toLowerCase(),
      targetName,
      requiredLevel,
      canEvolve,
      evolutionMethod: targetData.evoType || "level",
    });
  }

  return options;
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
      throw new Error("Pokémon introuvable dans votre collection.");
    }

    if (isPokemonInActiveBattle(userId, pokemonId)) {
      throw new Error("Ce Pokémon est actuellement engagé dans un combat actif.");
    }

    const previousSpeciesName = getSpeciesFrenchName(pokemon.speciesId, pokemon.speciesId);

    const evolutionOptions = getEvolutionOptions(pokemon.speciesId, pokemon.level);
    const selectedEvolution = evolutionOptions.find(
      (opt) => opt.targetSpeciesId.toLowerCase() === targetSpeciesId.toLowerCase(),
    );

    if (!selectedEvolution) {
      throw new Error(
        `"${targetSpeciesId}" n'est pas une évolution valide pour ${previousSpeciesName}.`,
      );
    }

    if (!selectedEvolution.canEvolve) {
      throw new Error(
        `${previousSpeciesName} requiert le niveau ${selectedEvolution.requiredLevel} pour évoluer en ${selectedEvolution.targetName} (niveau actuel : ${pokemon.level}).`,
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
      where: { id: pokemonId },
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
