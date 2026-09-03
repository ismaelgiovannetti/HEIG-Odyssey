/**
 * Thème visuel de l'arène de combat. Il détermine le décor procédural (CSS)
 * affiché derrière les combattants.
 */
export type ArenaTheme =
  | "normal"
  | "grass"
  | "electric"
  | "steel"
  | "psychic"
  | "poison"
  | "dragon"
  | "fire"
  | "water"
  | "ice"
  | "fighting"
  | "ground"
  | "flying"
  | "bug"
  | "rock"
  | "ghost"
  | "dark"
  | "neutral"
  | "training";

export const ARENA_THEMES: readonly ArenaTheme[] = [
  "normal",
  "grass",
  "electric",
  "steel",
  "psychic",
  "poison",
  "dragon",
  "fire",
  "water",
  "ice",
  "fighting",
  "ground",
  "flying",
  "bug",
  "rock",
  "ghost",
  "dark",
  "neutral",
  "training",
];

// Type dominant de chaque monde de campagne (déduit du contenu, codé en dur).
const WORLD_ARENA_THEME: Record<string, ArenaTheme> = {
  "bachelor-1": "normal", // Type Normal
  "bachelor-2": "grass", // Type Plante
  "bachelor-3": "electric", // Type Électrik
  "bachelor-4": "steel", // Type Acier
  "bachelor-5": "psychic", // Type Psy
  "master-1": "poison", // Poison / Ténèbres
  "master-2": "dragon", // Dragon / Glace
  doctorat: "neutral", // Épreuve finale, types mêlés
};

/** Thème d'arène d'une étape de campagne, déduit de l'identifiant du monde. */
export function arenaThemeForStage(
  stageId: string | undefined | null,
): ArenaTheme {
  if (!stageId) return "neutral";
  const worldId = stageId.replace(/-stage-\d+$/, "");
  return WORLD_ARENA_THEME[worldId] ?? "neutral";
}
