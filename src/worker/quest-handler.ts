import { registerEventHandler } from "./event-dispatcher";
import { handleBattleCompletedEventForQuests } from "@/lib/quests/quest-progress-service";
import type { BattleCompletedPayload, TrainingCompletedPayload } from "@/lib/events/contracts";
import { logger } from "@/lib/logger";

let isRegistered = false;

/**
 * Enregistre les écouteurs d'événements de combat pour le traitement automatique des quêtes.
 */
export function registerQuestEventHandlers(): void {
  if (isRegistered) return;
  isRegistered = true;

  registerEventHandler<BattleCompletedPayload>("battle.completed", async (envelope) => {
    try {
      await handleBattleCompletedEventForQuests(envelope.eventId, envelope.payload);
    } catch (err) {
      logger.error("Échec de mise à jour des quêtes après un combat", {
        eventId: envelope.eventId,
        action: "quest.handle-battle-completed",
      }, err);
      throw err;
    }
  });

  registerEventHandler<TrainingCompletedPayload>("training.completed", async (envelope) => {
    try {
      await handleBattleCompletedEventForQuests(envelope.eventId, envelope.payload);
    } catch (err) {
      logger.error("Échec de mise à jour des quêtes après un entraînement", {
        eventId: envelope.eventId,
        action: "quest.handle-training-completed",
      }, err);
      throw err;
    }
  });
}
