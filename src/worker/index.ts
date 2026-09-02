import { createRedisClient } from "@/lib/events/redis-client";
import { QuestWorker } from "./quest-worker";
import { registerQuestEventHandlers } from "./quest-handler";
import { logger } from "@/lib/logger";

async function main() {
  logger.info("Initialisation du processus worker", {
    eventId: logger.generateEventId(),
    action: "worker.initialize",
  });

  registerQuestEventHandlers();

  const redis = createRedisClient();

  const worker = new QuestWorker(redis);

  const shutdown = async (signal: string) => {
    logger.info("Signal d'arrêt reçu par le worker", {
      eventId: logger.generateEventId(),
      action: "worker.shutdown",
      signal,
    });
    worker.stop();
    await redis.quit().catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await worker.start();
  } catch (error) {
    logger.error("Erreur fatale du worker", {
      eventId: logger.generateEventId(),
      action: "worker.run",
    }, error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    logger.error("Erreur de démarrage du worker", {
      eventId: logger.generateEventId(),
      action: "worker.start",
    }, err);
    process.exit(1);
  });
}
