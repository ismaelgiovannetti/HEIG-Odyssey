import { createRedisClient } from "@/lib/events/redis-client";
import { QuestWorker } from "./quest-worker";

async function main() {
  console.log("[Worker Process] Initialisation du worker de quêtes...");

  const redis = createRedisClient();
  const worker = new QuestWorker(redis);

  const shutdown = async (signal: string) => {
    console.log(`[Worker Process] Signal ${signal} reçu, arrêt en cours...`);
    worker.stop();
    await redis.quit().catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await worker.start();
  } catch (error) {
    console.error("[Worker Process] Erreur fatale :", error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error("[Worker Process] Erreur de démarrage :", err);
    process.exit(1);
  });
}
