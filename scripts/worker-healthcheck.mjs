import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const EVENTS_STREAM_KEY = "heig-odyssey:events";
const QUEST_WORKER_GROUP = "quest-workers";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: true,
  enableReadyCheck: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 2_000,
  commandTimeout: 2_000,
  retryStrategy: () => null,
});
const prisma = new PrismaClient();

function readRedisField(fields, key) {
  if (!Array.isArray(fields)) return undefined;

  for (let index = 0; index < fields.length; index += 2) {
    if (fields[index] === key) return fields[index + 1];
  }

  return undefined;
}

try {
  const [pong, groups] = await Promise.all([
    redis.ping(),
    redis.xinfo("GROUPS", EVENTS_STREAM_KEY),
    prisma.$queryRaw`SELECT 1`,
  ]);
  const questGroupExists = groups.some(
    (group) => readRedisField(group, "name") === QUEST_WORKER_GROUP,
  );

  if (pong !== "PONG" || !questGroupExists) {
    throw new Error("Quest worker dependencies are not ready");
  }
} catch {
  // Le détail peut contenir une adresse de connexion : il reste volontairement
  // absent de la sortie du healthcheck.
  console.error("Quest worker healthcheck failed");
  process.exitCode = 1;
} finally {
  redis.disconnect();
  await prisma.$disconnect().catch(() => {});
}
