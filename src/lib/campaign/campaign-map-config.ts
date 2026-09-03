/** Coordonnée en pourcentage d'une plateforme peinte sur une carte. */
export interface CampaignMapPoint {
  left: number;
  top: number;
}

/** Les cartes sont des ressources locales validées, communes à la campagne et au dashboard. */
export const CAMPAIGN_WORLD_MAPS: Readonly<Record<string, string>> =
  Object.fromEntries(
    [
      "bachelor-1",
      "bachelor-2",
      "bachelor-3",
      "bachelor-4",
      "bachelor-5",
      "master-1",
      "master-2",
      "doctorat",
    ].map((id) => [id, `/campaign/maps/${id}.png`]),
  );

/**
 * Garantit une image locale même si la configuration d'un monde est
 * temporairement incomplète.
 */
export function getCampaignWorldMap(worldId: string): string {
  return CAMPAIGN_WORLD_MAPS[worldId] ?? "/campaign/maps/bachelor-1.png";
}

const points = (pairs: readonly (readonly [number, number])[]) =>
  pairs.map(([left, top]) => ({ left, top }));

/**
 * Coordonnées relevées sur les plateformes des images de campagne. Le dernier
 * point de chaque monde correspond toujours à l'arène de son boss.
 */
const CAMPAIGN_WORLD_POINTS: Readonly<
  Record<string, readonly CampaignMapPoint[]>
> = {
  "bachelor-1": points([
    [14.5, 82.5],
    [26.7, 70.3],
    [38.6, 59.1],
    [51.8, 49.1],
    [63.9, 38.1],
    [86.7, 18.9],
  ]),
  "bachelor-2": points([
    [12.1, 78.7],
    [24, 69.4],
    [35.2, 61],
    [46.3, 52.1],
    [56.2, 43.6],
    [66.4, 35.4],
    [81.9, 22.8],
  ]),
  "bachelor-3": points([
    [11.5, 89],
    [21.5, 80.9],
    [32.5, 71.6],
    [41.9, 61.9],
    [50.5, 52],
    [59.8, 41.9],
    [67.2, 30.9],
    [83.4, 15.6],
  ]),
  "bachelor-4": points([
    [8.4, 87.1],
    [21.6, 77.9],
    [32.6, 72.6],
    [46.8, 62.8],
    [38, 51.4],
    [48.3, 41.5],
    [59, 32],
    [70.2, 23.5],
    [85.5, 13.8],
  ]),
  "bachelor-5": points([
    [16, 80],
    [21.9, 67.7],
    [30.7, 58.3],
    [40.8, 53.3],
    [50.2, 61.5],
    [59.7, 57.2],
    [54.1, 45.6],
    [58.7, 34.9],
    [67.6, 28.4],
    [85.5, 18.5],
  ]),
  "master-1": points([
    [6.4, 85.9],
    [13.4, 78.4],
    [21.1, 70.6],
    [28.5, 63.2],
    [36, 56.2],
    [43.2, 50.3],
    [50.4, 44.4],
    [57.8, 38.3],
    [65.4, 32.2],
    [73.1, 26.4],
    [86.4, 16.7],
  ]),
  "master-2": points([
    [4.8, 92.7],
    [10.5, 83.5],
    [17.5, 75.4],
    [24.2, 67.8],
    [31.6, 61.1],
    [38.9, 55.3],
    [46.6, 50],
    [53.9, 44.5],
    [61.1, 38.2],
    [67.4, 31.7],
    [75, 27.1],
    [85.2, 14.6],
  ]),
  doctorat: points([
    [18.5, 80],
    [34.8, 65.5],
    [48.8, 53.2],
    [61.2, 42.2],
    [74.6, 32],
    [86.8, 20],
  ]),
};

/**
 * Renvoie la position de l'étape demandée. Le calcul de repli préserve une
 * carte exploitable si un nouveau monde est ajouté avant ses coordonnées.
 */
export function getCampaignStagePoint(
  worldId: string,
  stageIndex: number,
  totalStages: number,
): CampaignMapPoint {
  const worldPoints =
    CAMPAIGN_WORLD_POINTS[worldId] ?? CAMPAIGN_WORLD_POINTS["bachelor-1"];

  if (stageIndex === totalStages - 1) {
    return worldPoints.at(-1) ?? { left: 50, top: 50 };
  }

  return (
    worldPoints[stageIndex] ?? {
      left: 10 + stageIndex * (80 / Math.max(1, totalStages - 1)),
      top: 70,
    }
  );
}
