import { Dex } from "@pkmn/sim";
import { getSpeciesFrenchName } from "./species-names-fr";

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
export function getRequiredLevelForEvolution(targetData: any): number {
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
 * Récupère les options d'évolution disponibles pour une espèce à un niveau donné (Client & Server safe).
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
