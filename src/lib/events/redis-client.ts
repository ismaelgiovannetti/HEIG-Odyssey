import "server-only";

import Redis, { type RedisOptions } from "ioredis";
import { logger } from "@/lib/logger";

let redisClientInstance: Redis | null = null;

export function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

export function createRedisClient(customOptions?: RedisOptions): Redis {
  const url = getRedisUrl();
  const client = new Redis(url, {
    maxRetriesPerRequest: null, // Requis pour les streams bloquants / consumer groups
    enableReadyCheck: true,
    autoResubscribe: true,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    ...customOptions,
  });

  // Évite les Unhandled error events lorsque Redis est injoignable hors connexion
  client.on("error", (err: Error) => {
    logger.warn(
      "Erreur de connexion Redis",
      {
        eventId: logger.generateEventId(),
        action: "redis.connection",
      },
      err,
    );
  });

  return client;
}

/**
 * Singleton Redis pour les opérations régulières de l'application (hors commandes bloquantes).
 */
export function getRedisClient(): Redis {
  if (!redisClientInstance) {
    // Les workers utilisent volontairement des commandes bloquantes, mais une
    // requête HTTP ne doit jamais rester suspendue indéfiniment si Redis tombe.
    redisClientInstance = createRedisClient({
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      commandTimeout: 2_000,
    });
  }
  return redisClientInstance;
}
