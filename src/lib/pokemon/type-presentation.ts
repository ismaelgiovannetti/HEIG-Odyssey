import type { PokemonType } from "@/lib/content/schemas";

/** Libellés français partagés par toutes les interfaces Pokémon. */
export const POKEMON_TYPE_LABELS_FR: Readonly<Record<PokemonType, string>> = {
  Normal: "Normal",
  Fire: "Feu",
  Water: "Eau",
  Grass: "Plante",
  Electric: "Électrik",
  Ice: "Glace",
  Fighting: "Combat",
  Poison: "Poison",
  Ground: "Sol",
  Flying: "Vol",
  Psychic: "Psy",
  Bug: "Insecte",
  Rock: "Roche",
  Ghost: "Spectre",
  Dragon: "Dragon",
  Steel: "Acier",
  Dark: "Ténèbres",
};

/** Couleurs de type communes aux badges et aux aperçus. */
export const POKEMON_TYPE_COLORS: Readonly<Record<PokemonType, string>> = {
  Normal: "#8f8f84",
  Fire: "#d95b32",
  Water: "#3c78c5",
  Grass: "#4f9a51",
  Electric: "#c49a12",
  Ice: "#4fa5b3",
  Fighting: "#ad3d35",
  Poison: "#8f4c9d",
  Ground: "#a77a3e",
  Flying: "#6c82ba",
  Psychic: "#c64f78",
  Bug: "#7c9130",
  Rock: "#8d7d43",
  Ghost: "#65547f",
  Dragon: "#6352b3",
  Steel: "#6f8793",
  Dark: "#60554e",
};

export function getPokemonTypeLabel(type: PokemonType | string): string {
  return POKEMON_TYPE_LABELS_FR[type as PokemonType] ?? type;
}

export function getPokemonTypeColor(type: PokemonType | string): string {
  return POKEMON_TYPE_COLORS[type as PokemonType] ?? "#6b7280";
}
