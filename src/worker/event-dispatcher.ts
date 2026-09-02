import type { DomainEventEnvelope, DomainEventType } from "@/lib/events/contracts";
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
  errors: Error[];
}> {
  const handlers = eventHandlersMap.get(event.eventType);
  if (!handlers || handlers.size === 0) {
    return { success: true, errors: [] };
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
    errors,
  };
}
