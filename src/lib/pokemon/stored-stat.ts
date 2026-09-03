export type StoredStatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

/** Lit une statistique numérique dans une colonne JSON Prisma sans lui faire confiance. */
export function readStoredStat(
  value: unknown,
  key: StoredStatKey,
  fallback: number,
): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const stat = (value as Record<string, unknown>)[key];
  return typeof stat === "number" && Number.isFinite(stat) ? stat : fallback;
}
