const THOUSANDS_SEPARATOR = "\u202F";

/**
 * Formate un entier de manière identique dans Node et dans le navigateur.
 * `Intl.NumberFormat` dépend des données ICU installées et peut produire une
 * apostrophe côté client mais une espace insécable pendant le rendu serveur.
 */
export function formatGameInteger(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
}
