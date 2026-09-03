import type { DomainEventEnvelope, DomainEventType } from "@/lib/events/contracts";
import { isPermanentDomainEventError } from "@/lib/events/errors";
import { logger } from "@/lib/logger";

export type EventHandler<T = any> = (event: DomainEventEnvelope<T>) => Promise<void>;

const eventHandlersMap = new Map<DomainEventType, Set<EventHandler>>();

/**
 * Enregistre un handler pour un type d'événement donné.
 */
export function registerEventHandler<T = any>(
  eventType: DomainEventType,
  handler: EventHandler<T>
): () => void {
  let handlers = eventHandlersMap.get(eventType);
  if (!handlers) {
    handlers = new Set();
    eventHandlersMap.set(eventType, handlers);
  }
  handlers.add(handler);

  // Fonction de désinscription
  return () => {
    handlers?.delete(handler);
  };
}

/**
 * Supprime tous les handlers enregistrés (utile pour les tests).
 */
export function clearEventHandlers(): void {
  eventHandlersMap.clear();
}

/**
 * Distribue un événement à tous ses handlers enregistrés.
 */
export async function dispatchDomainEvent(event: DomainEventEnvelope): Promise<{
  success: boolean;
  retryable: boolean;
  errors: Error[];
}> {
  const handlers = eventHandlersMap.get(event.eventType);
  if (!handlers || handlers.size === 0) {
    return { success: true, retryable: false, errors: [] };
  }

  const errors: Error[] = [];

  for (const handler of handlers) {
    try {
      await handler(event);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("Échec du traitement d'un événement", {
        eventId: event.eventId,
        action: "event.dispatch",
        eventType: event.eventType,
      }, error);
      errors.push(error);
    }
  }

  return {
    success: errors.length === 0,
    // Une erreur inconnue est transitoire par défaut. On ne met en quarantaine
    // que les événements dont tous les échecs sont explicitement permanents.
    retryable: errors.some((error) => !isPermanentDomainEventError(error)),
    errors,
  };
}
