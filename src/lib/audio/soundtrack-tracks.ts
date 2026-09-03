/**
 * Correspondance écran/monde -> fichier musical (`public/audio/tracks/<id>.mp3`).
 * Un fichier absent est simplement ignoré à la lecture.
 */

/** Musique d'ambiance de chaque menu principal. */
export const MENU_TRACKS = {
  dashboard: "route-1", // Accueil : thème de route
  gacha: "pokemon-center", // Gacha : Centre Pokémon
  team: "pc-box", // Équipe : boîte du PC
  training: "town", // Entraînement : thème de ville
} as const;

/** Musique de la carte de campagne, selon le degré du cursus. */
export const CAMPAIGN_TRACKS: Record<string, string> = {
  BACHELOR: "campaign-bachelor",
  MASTER: "campaign-master",
  DOCTORAT: "campaign-doctorat",
};

export const DEFAULT_CAMPAIGN_TRACK = "campaign-bachelor";

/**
 * Musique de combat propre à chaque boss de campagne. Ces fichiers existent
 * déjà dans `public/audio/tracks/` ; ils n'étaient simplement jamais référencés
 * (tous les dresseurs pointaient sur `battle-theme-1`).
 */
export const BOSS_MUSIC_TRACKS: Record<string, string> = {
  "boss-fouad": "gym-leader-hgss",
  "boss-nastaran": "gym-leader-rse",
  "boss-mosqueron": "gym-leader-dpp",
  "boss-augier": "zinnia-battle-oras",
  "boss-tori": "boss-lysandre-xy",
  "boss-gamba": "boss-giovanni-usum",
  "boss-auberson": "giratina-battle-pla",
  "boss-doc-tiago": "champion-diantha-xy",
  "boss-doc-mo": "champion-alder-bw",
  "boss-doc-ismael": "champion-cynthia-dpp",
  "boss-doc-evan": "chairman-rose-swsh",
  "boss-doc-donini": "hooh-battle-hgss",
  "boss-doc-heche": "n-final-battle-bw",
};

export const DEFAULT_BATTLE_TRACK = "battle-theme-1";
