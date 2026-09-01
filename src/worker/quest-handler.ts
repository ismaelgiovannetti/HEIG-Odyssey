import { registerEventHandler } from "./event-dispatcher";
import { handleBattleCompletedForQuests } from "@/lib/quests/quest-progress-service";
import type { BattleCompletedPayload, TrainingCompletedPayload } from "@/lib/events/contracts";

let isRegistered = false;

/**
 * Enregistre les écouteurs d'événements de combat pour le traitement automatique des quêtes.
 */
export function registerQuestEventHandlers(): void {
  if (isRegistered) return;
  isRegistered = true;

  registerEventHandler<BattleCompletedPayload>("battle.completed", async (envelope) => {
    try {
      await handleBattleCompletedForQuests(envelope.payload);
    } catch (err) {
      console.error(
        `[QuestHandler] Erreur lors du traitement de battle.completed pour l'événement ${envelope.eventId}:`,
        err
      );
      throw err;
    }
  });

  registerEventHandler<TrainingCompletedPayload>("training.completed", async (envelope) => {
    try {
      await handleBattleCompletedForQuests(envelope.payload);
    } catch (err) {
      console.error(
        `[QuestHandler] Erreur lors du traitement de training.completed pour l'événement ${envelope.eventId}:`,
        err
      );
      throw err;
    }
  });
}
