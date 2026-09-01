import { loadSpecies } from "../content/loader";
import type { Species } from "../content/schemas";

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
