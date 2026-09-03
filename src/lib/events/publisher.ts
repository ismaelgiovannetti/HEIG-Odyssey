import "server-only";

import { prisma } from "../prisma";
import { getRedisClient } from "./redis-client";
import { OutboxStatus } from "@prisma/client";
import type Redis from "ioredis";
import type { DomainEventEnvelope } from "./contracts";
import { logger, sanitizeLogData } from "../logger";

export const EVENTS_STREAM_KEY = "heig-odyssey:events";
export const EVENTS_DEAD_LETTER_STREAM_KEY = `${EVENTS_STREAM_KEY}:dead-letter`;

export interface PublishPendingResult {
  publishedCount: number;
  failedCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Les anciennes lignes Outbox contenaient par erreur l'enveloppe complète.
 * Ce déballage maintient leur compatibilité pendant le déploiement de la correction.
 */
function unwrapLegacyOutboxPayload(
  payload: unknown,
  eventId: string,
  eventType: string,
): unknown {
  if (
    isRecord(payload) &&
    payload.eventId === eventId &&
    payload.eventType === eventType &&
    "payload" in payload
  ) {
    return payload.payload;
  }

  return payload;
}

/**
 * Publie un événement directement dans le flux Redis Streams via XADD.
 * Renvoie l'ID généré par Redis pour le message.
 */
export async function publishDomainEvent(
  event: DomainEventEnvelope,
  client?: Redis,
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
    JSON.stringify(event.payload),
  );

  logger.info("Événement publié dans Redis Streams", {
    eventId: event.eventId,
    action: "event.publish",
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    messageId,
  });

  return messageId as string;
}

/**
 * Parcourt les événements en attente (Outbox) et les publie dans Redis Streams.
 * En cas de succès, marque l'événement comme PUBLISHED.
 * En cas d'échec, incrémente le compteur de retry et enregistre l'erreur.
 */
export async function publishPendingOutboxEvents(
  options: {
    batchSize?: number;
    maxRetries?: number;
    client?: Redis;
    continuousRecovery?: boolean;
  } = {},
): Promise<PublishPendingResult> {
  const batchSize = options.batchSize ?? 50;
  const maxRetries = options.maxRetries ?? 5;
  const redis = options.client ?? getRedisClient();
  const continuousRecovery = options.continuousRecovery === true;

  const pendingEvents = await prisma.outboxEvent.findMany({
    where: {
      status: continuousRecovery
        ? { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] }
        : OutboxStatus.PENDING,
      ...(continuousRecovery ? {} : { retryCount: { lt: maxRetries } }),
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
        aggregateType:
          outboxItem.aggregateType as DomainEventEnvelope["aggregateType"],
        aggregateId: outboxItem.aggregateId,
        version: 1,
        occurredAt: outboxItem.createdAt.toISOString(),
        payload: unwrapLegacyOutboxPayload(
          outboxItem.payload,
          outboxItem.eventId,
          outboxItem.eventType,
        ),
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
      const errorMessage = String(
        sanitizeLogData(error instanceof Error ? error.message : String(error)),
      );
      const isLastRetry =
        !continuousRecovery && outboxItem.retryCount + 1 >= maxRetries;

      logger.error(
        "Échec de publication d'un événement Outbox",
        {
          eventId: outboxItem.eventId,
          action: "event.publish.retry",
          eventType: outboxItem.eventType,
          retryCount: outboxItem.retryCount + 1,
          terminal: isLastRetry,
        },
        error,
      );

      await prisma.outboxEvent
        .update({
          where: { id: outboxItem.id },
          data: {
            retryCount: { increment: 1 },
            lastError: errorMessage,
            status: isLastRetry ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          },
        })
        .catch(() => {});
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
      logger.error(
        "Échec du vidage de l'Outbox en arrière-plan",
        {
          eventId: logger.generateEventId(),
          action: "outbox.flush",
        },
        err,
      );
    });
  });
}
