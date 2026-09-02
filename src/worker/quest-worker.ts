import type Redis from "ioredis";
import {
  DomainEventEnvelopeSchema,
  type DomainEventEnvelope,
} from "@/lib/events/contracts";
import { dispatchDomainEvent } from "./event-dispatcher";
import { EVENTS_STREAM_KEY } from "@/lib/events/publisher";
import { logger } from "@/lib/logger";

export const DEFAULT_GROUP_NAME = "quest-workers";

export interface QuestWorkerOptions {
  streamKey?: string;
  groupName?: string;
  consumerName?: string;
  blockTimeoutMs?: number;
  claimMinIdleMs?: number;
  pollIntervalMs?: number;
}

/**
 * Reconstruit un objet typé à partir du tableau clé-valeur renvoyé par Redis Streams.
 */
export function parseStreamFields(rawFields: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < rawFields.length; i += 2) {
    result[rawFields[i]] = rawFields[i + 1];
  }
  return result;
}

/**
 * Désérialise et valide l'enveloppe d'événement depuis un message Redis Stream.
 */
export function parseStreamEnvelope(
  messageId: string,
  rawFields: string[]
): DomainEventEnvelope | null {
  try {
    const fields = parseStreamFields(rawFields);
    if (!fields.eventId || !fields.eventType || !fields.payload) {
      logger.warn("Message Redis incomplet ignoré", {
        eventId: logger.generateEventId(),
        action: "quest-worker.parse",
        messageId,
      });
      return null;
    }

    const rawPayload = JSON.parse(fields.payload);

    const parsed = DomainEventEnvelopeSchema.safeParse({
      eventId: fields.eventId,
      eventType: fields.eventType,
      aggregateType: fields.aggregateType,
      aggregateId: fields.aggregateId,
      version: fields.version ? parseInt(fields.version, 10) : 1,
      occurredAt: fields.occurredAt || new Date().toISOString(),
      payload: rawPayload,
    });

    if (!parsed.success) {
      logger.error("Schéma d'événement Redis invalide", {
        eventId: fields.eventId,
        action: "quest-worker.validate",
        messageId,
        issues: parsed.error.issues,
      });
      return null;
    }

    return parsed.data as DomainEventEnvelope;
  } catch (err) {
    logger.error("Impossible de désérialiser un événement Redis", {
      eventId: logger.generateEventId(),
      action: "quest-worker.parse",
      messageId,
    }, err);
    return null;
  }
}

/**
 * Crée de manière idempotente le Consumer Group sur le stream.
 */
export async function initConsumerGroup(
  redis: Redis,
  streamKey: string = EVENTS_STREAM_KEY,
  groupName: string = DEFAULT_GROUP_NAME
): Promise<void> {
  try {
    // 0 signifie que le groupe démarre depuis le début du stream s'il est nouveau
    // MKSTREAM crée automatiquement le stream s'il n'existe pas encore
    await redis.xgroup("CREATE", streamKey, groupName, "0", "MKSTREAM");
  } catch (err: any) {
    // BUSYGROUP signifie que le groupe existe déjà, ce qui est attendu
    if (err?.message && err.message.includes("BUSYGROUP")) {
      return;
    }
    throw err;
  }
}

/**
 * Traite un message du stream : validation, exécution des handlers et acquittement (XACK).
 */
export async function processAndAckStreamMessage(
  redis: Redis,
  streamKey: string,
  groupName: string,
  messageId: string,
  rawFields: string[]
): Promise<boolean> {
  const envelope = parseStreamEnvelope(messageId, rawFields);

  // Si le message est corrompu ou invalide, on l'acquitte pour ne pas bloquer la file
  if (!envelope) {
    await redis.xack(streamKey, groupName, messageId);
    return false;
  }

  const dispatchResult = await dispatchDomainEvent(envelope);

  if (dispatchResult.success) {
    // Acquittement immédiat dans Redis
    await redis.xack(streamKey, groupName, messageId);
    return true;
  } else {
    // En cas d'erreur de traitement, le message reste non acquitté dans le PEL (Pending Entry List)
    logger.error("Échec du dispatch d'un événement Redis", {
      eventId: envelope.eventId,
      action: "quest-worker.dispatch",
      eventType: envelope.eventType,
      messageId,
    });
    return false;
  }
}

/**
 * Récupère et traite les messages abandonnés par d'anciens workers crashés (XAUTOCLAIM).
 */
export async function claimAndProcessStaleMessages(
  redis: Redis,
  streamKey: string = EVENTS_STREAM_KEY,
  groupName: string = DEFAULT_GROUP_NAME,
  consumerName: string,
  minIdleMs: number = 60000
): Promise<number> {
  let processedCount = 0;
  try {
    // XAUTOCLAIM stream group consumer min-idle-time start [COUNT count]
    const claimResult = (await redis.xautoclaim(
      streamKey,
      groupName,
      consumerName,
      minIdleMs,
      "0-0",
      "COUNT",
      20
    )) as [string, Array<[string, string[]]>];

    if (claimResult && Array.isArray(claimResult[1])) {
      const messages = claimResult[1];
      for (const [msgId, fields] of messages) {
        if (fields && fields.length > 0) {
          const success = await processAndAckStreamMessage(
            redis,
            streamKey,
            groupName,
            msgId,
            fields
          );
          if (success) processedCount++;
        }
      }
    }
  } catch (err) {
    logger.error("Échec de récupération des événements Redis abandonnés", {
      eventId: logger.generateEventId(),
      action: "quest-worker.claim-stale",
      streamKey,
      groupName,
      consumerName,
    }, err);
  }

  return processedCount;
}

/**
 * Worker autonome avec boucle de consommation Redis Streams.
 */
export class QuestWorker {
  private isRunning = false;
  private shouldStop = false;
  private readonly redis: Redis;
  private readonly streamKey: string;
  private readonly groupName: string;
  private readonly consumerName: string;
  private readonly blockTimeoutMs: number;
  private readonly claimMinIdleMs: number;
  private readonly pollIntervalMs: number;

  constructor(redis: Redis, options: QuestWorkerOptions = {}) {
    this.redis = redis;
    this.streamKey = options.streamKey || EVENTS_STREAM_KEY;
    this.groupName = options.groupName || DEFAULT_GROUP_NAME;
    this.consumerName =
      options.consumerName ||
      `worker_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;
    this.blockTimeoutMs = options.blockTimeoutMs ?? 2000;
    this.claimMinIdleMs = options.claimMinIdleMs ?? 60000;
    this.pollIntervalMs = options.pollIntervalMs ?? 100;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.shouldStop = false;

    logger.info("Démarrage du worker de quêtes", {
      eventId: logger.generateEventId(),
      action: "quest-worker.start",
      consumerName: this.consumerName,
      groupName: this.groupName,
    });

    await initConsumerGroup(this.redis, this.streamKey, this.groupName);

    let lastClaimCheck = Date.now();

    while (!this.shouldStop) {
      try {
        // Périodiquement, vérifier s'il y a des messages abandonnés à réclamer
        if (Date.now() - lastClaimCheck > 30000) {
          lastClaimCheck = Date.now();
          await claimAndProcessStaleMessages(
            this.redis,
            this.streamKey,
            this.groupName,
            this.consumerName,
            this.claimMinIdleMs
          );
        }

        // Lecture des nouveaux messages avec XREADGROUP BLOCK
        // '>' signifie uniquement les messages qui n'ont jamais été livrés à aucun consommateur
        const response = (await this.redis.xreadgroup(
          "GROUP",
          this.groupName,
          this.consumerName,
          "COUNT",
          10,
          "BLOCK",
          this.blockTimeoutMs,
          "STREAMS",
          this.streamKey,
          ">"
        )) as Array<[string, Array<[string, string[]]>]> | null;


        if (response && response.length > 0) {
          for (const [, messages] of response) {
            for (const [messageId, rawFields] of messages) {
              await processAndAckStreamMessage(
                this.redis,
                this.streamKey,
                this.groupName,
                messageId,
                rawFields
              );
            }
          }
        }
      } catch (error: any) {
        if (!this.shouldStop) {
          logger.error("Erreur dans la boucle du worker de quêtes", {
            eventId: logger.generateEventId(),
            action: "quest-worker.consume",
            consumerName: this.consumerName,
            groupName: this.groupName,
          }, error);
          await new Promise((res) => setTimeout(res, this.pollIntervalMs));
        }
      }
    }

    this.isRunning = false;
    logger.info("Arrêt du worker de quêtes", {
      eventId: logger.generateEventId(),
      action: "quest-worker.stop",
      consumerName: this.consumerName,
      groupName: this.groupName,
    });
  }

  public stop(): void {
    this.shouldStop = true;
  }

  public getStatus(): { isRunning: boolean; consumerName: string; groupName: string } {
    return {
      isRunning: this.isRunning,
      consumerName: this.consumerName,
      groupName: this.groupName,
    };
  }
}
