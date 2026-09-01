import { prisma } from "../prisma";
import { getRedisClient } from "./redis-client";
import { OutboxStatus } from "@prisma/client";
import type Redis from "ioredis";
import type { DomainEventEnvelope } from "./contracts";

export const EVENTS_STREAM_KEY = "heig-odyssey:events";

export interface PublishPendingResult {
  publishedCount: number;
  failedCount: number;
}

/**
 * Publie un événement directement dans le flux Redis Streams via XADD.
 * Renvoie l'ID généré par Redis pour le message.
 */
export async function publishDomainEvent(
  event: DomainEventEnvelope,
  client?: Redis
): Promise<string> {
  const redis = client ?? getRedisClient();

  const messageId = await redis.xadd(
    EVENTS_STREAM_KEY,
    "*",
    "eventId",
    event.eventId,
    "eventType",
    event.eventType,
    "aggregateType",
    event.aggregateType,
    "aggregateId",
    event.aggregateId,
    "version",
    String(event.version),
    "occurredAt",
    event.occurredAt,
    "payload",
    JSON.stringify(event.payload)
  );

  return messageId as string;
}

/**
 * Parcourt les événements en attente (Outbox) et les publie dans Redis Streams.
 * En cas de succès, marque l'événement comme PUBLISHED.
 * En cas d'échec, incrémente le compteur de retry et enregistre l'erreur.
 */
export async function publishPendingOutboxEvents(options: {
  batchSize?: number;
  maxRetries?: number;
  client?: Redis;
} = {}): Promise<PublishPendingResult> {
  const batchSize = options.batchSize ?? 50;
  const maxRetries = options.maxRetries ?? 5;
  const redis = options.client ?? getRedisClient();

  const pendingEvents = await prisma.outboxEvent.findMany({
    where: {
      status: OutboxStatus.PENDING,
      retryCount: { lt: maxRetries },
    },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });

  let publishedCount = 0;
  let failedCount = 0;

  for (const outboxItem of pendingEvents) {
    try {
      const envelope: DomainEventEnvelope = {
        eventId: outboxItem.eventId,
        eventType: outboxItem.eventType as DomainEventEnvelope["eventType"],
        aggregateType: outboxItem.aggregateType as DomainEventEnvelope["aggregateType"],
        aggregateId: outboxItem.aggregateId,
        version: 1,
        occurredAt: outboxItem.createdAt.toISOString(),
        payload: outboxItem.payload,
      };

      await publishDomainEvent(envelope, redis);

      await prisma.outboxEvent.update({
        where: { id: outboxItem.id },
        data: {
          status: OutboxStatus.PUBLISHED,
          publishedAt: new Date(),
          lastError: null,
        },
      });

      publishedCount++;
    } catch (error) {
      failedCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isLastRetry = outboxItem.retryCount + 1 >= maxRetries;

      await prisma.outboxEvent.update({
        where: { id: outboxItem.id },
        data: {
          retryCount: { increment: 1 },
          lastError: errorMessage,
          status: isLastRetry ? OutboxStatus.FAILED : OutboxStatus.PENDING,
        },
      }).catch(() => {});
    }
  }

  return { publishedCount, failedCount };
}

/**
 * Déclenchement non-bloquant du vidage de l'Outbox.
 */
export function triggerOutboxFlush(): void {
  // Exécution asynchrone sans bloquer la requête HTTP
  setImmediate(() => {
    publishPendingOutboxEvents().catch((err) => {
      console.error("[Outbox Publisher] Échec du vidage en arrière-plan :", err);
    });
  });
}
