import Redis, { type RedisOptions } from "ioredis";

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
    if (process.env.NODE_ENV !== "test") {
      console.warn("[Redis Client] Notification d'erreur :", err.message || err);
    }
  });

  return client;
}



/**
 * Singleton Redis pour les opérations régulières de l'application (hors commandes bloquantes).
 */
export function getRedisClient(): Redis {
  if (!redisClientInstance) {
    redisClientInstance = createRedisClient();
  }
  return redisClientInstance;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClientInstance) {
    await redisClientInstance.quit().catch(() => {});
    redisClientInstance = null;
  }
}
