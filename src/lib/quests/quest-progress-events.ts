export const QUEST_PROGRESS_INVALIDATED_EVENT =
  "heig-odyssey:quest-progress-invalidated";

export interface QuestProgressInvalidatedEventDetail {
  battleId: string;
}

/**
 * Signale au shell qu'un combat persisté vient de se terminer. La progression
 * des quêtes est asynchrone : le panneau utilise cet identifiant uniquement
 * pour attendre le reçu du worker, sans jamais faire confiance au navigateur.
 */
export function publishQuestProgressInvalidated(battleId: string): void {
  const normalizedBattleId = battleId.trim();
  if (
    typeof window === "undefined" ||
    normalizedBattleId.length === 0 ||
    normalizedBattleId.length > 128
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<QuestProgressInvalidatedEventDetail>(
      QUEST_PROGRESS_INVALIDATED_EVENT,
      { detail: { battleId: normalizedBattleId } },
    ),
  );
}
