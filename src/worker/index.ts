import "server-only";

import type Redis from "ioredis";
import { createRedisClient } from "@/lib/events/redis-client";
import { publishPendingOutboxEvents } from "@/lib/events/publisher";
import { prisma } from "@/lib/prisma";
import { QuestWorker } from "./quest-worker";
import { registerQuestEventHandlers } from "./quest-handler";
import { logger } from "@/lib/logger";

const OUTBOX_BATCH_SIZE = 50;
const OUTBOX_MAX_BATCHES_PER_FLUSH = 20;
const OUTBOX_FLUSH_INTERVAL_MS = 10_000;

/**
 * Vide l'Outbox par lots bornés. La borne empêche un historique très important
 * de retarder indéfiniment le démarrage de la consommation Redis Streams.
 */
async function drainPendingOutbox(redis: Redis): Promise<number> {
  let publishedTotal = 0;

  for (let batch = 0; batch < OUTBOX_MAX_BATCHES_PER_FLUSH; batch += 1) {
    const result = await publishPendingOutboxEvents({
      batchSize: OUTBOX_BATCH_SIZE,
      client: redis,
      // Le processus long-vivant est le filet de reprise durable : il reprend
      // aussi les événements ayant épuisé les essais courts du serveur web.
      continuousRecovery: true,
    });
    publishedTotal += result.publishedCount;

    // Un lot partiel signifie que toutes les lignes actuellement publiables
    // ont été parcourues. Une erreur est retentée au passage périodique suivant.
    if (result.publishedCount < OUTBOX_BATCH_SIZE) {
      break;
    }
  }

  if (publishedTotal > 0) {
    logger.info("Événements Outbox rattrapés par le worker", {
      eventId: logger.generateEventId(),
      action: "worker.outbox.flush",
      publishedCount: publishedTotal,
    });
  }

  return publishedTotal;
}

async function main() {
  logger.info("Initialisation du processus worker", {
    eventId: logger.generateEventId(),
    action: "worker.initialize",
  });

  registerQuestEventHandlers();

  // XREADGROUP est bloquant : le relay Outbox dispose donc de sa propre
  // connexion courte afin que ses publications ne patientent jamais derrière lui.
  const streamRedis = createRedisClient();
  const outboxRedis = createRedisClient({
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    commandTimeout: 5_000,
  });
  const worker = new QuestWorker(streamRedis);

  let stopping = false;
  let outboxTimer: NodeJS.Timeout | null = null;
  let activeOutboxFlush: Promise<number> | null = null;

  const flushOutboxWithoutOverlap = (): Promise<number> => {
    if (activeOutboxFlush) return activeOutboxFlush;

    activeOutboxFlush = drainPendingOutbox(outboxRedis).finally(() => {
      activeOutboxFlush = null;
    });
    return activeOutboxFlush;
  };

  const requestShutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info("Signal d'arrêt reçu par le worker", {
      eventId: logger.generateEventId(),
      action: "worker.shutdown",
      signal,
    });

    if (outboxTimer) clearInterval(outboxTimer);
    worker.stop();
  };

  process.once("SIGINT", () => requestShutdown("SIGINT"));
  process.once("SIGTERM", () => requestShutdown("SIGTERM"));

  try {
    // Rattrape les transactions validées avant un crash de l'application ou
    // pendant une indisponibilité temporaire de Redis.
    await flushOutboxWithoutOverlap();

    if (stopping) return;

    outboxTimer = setInterval(() => {
      void flushOutboxWithoutOverlap().catch((error) => {
        logger.error(
          "Échec du rattrapage périodique de l'Outbox",
          {
            eventId: logger.generateEventId(),
            action: "worker.outbox.periodic-flush",
          },
          error,
        );
      });
    }, OUTBOX_FLUSH_INTERVAL_MS);
    outboxTimer.unref();

    await worker.start();
  } catch (error) {
    logger.error(
      "Erreur fatale du worker",
      {
        eventId: logger.generateEventId(),
        action: "worker.run",
      },
      error,
    );
    process.exitCode = 1;
  } finally {
    if (outboxTimer) clearInterval(outboxTimer);
    await Promise.resolve(activeOutboxFlush).catch(() => {});
    // Les publications en cours sont terminées ci-dessus ; disconnect évite
    // qu'un QUIT reste suspendu si Redis est justement indisponible.
    streamRedis.disconnect();
    outboxRedis.disconnect();
    await prisma.$disconnect().catch(() => {});
  }
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    logger.error(
      "Erreur de démarrage du worker",
      {
        eventId: logger.generateEventId(),
        action: "worker.start",
      },
      err,
    );
    process.exit(1);
  });
}
