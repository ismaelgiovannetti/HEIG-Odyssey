import { loadSpecies } from "../content/loader";
import { hydrateMoves } from "../content/moves";
import { TrainerSchema } from "../content/schemas";
import type { Species, TrainerPokemon } from "../content/schemas";

// Compatibilité des imports existants pendant que l'hydratation vit désormais
// dans le module de contenu commun aux combats et au recrutement.
export { hydrateMove, hydrateMoves } from "../content/moves";

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
