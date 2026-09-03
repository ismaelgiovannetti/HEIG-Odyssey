import "server-only";

import { createHash } from "node:crypto";

import { getRedisClient } from "@/lib/events/redis-client";

const RATE_LIMIT_PREFIX = "heig-odyssey:rate-limit:";
const RATE_LIMIT_SCRIPT = `
local window = tonumber(ARGV[1])
local maximum = tonumber(ARGV[2])
local current = tonumber(redis.call("GET", KEYS[1]) or "0")
local ttl = redis.call("TTL", KEYS[1])

if ttl < 0 then
  redis.call("EXPIRE", KEYS[1], window)
  ttl = window
end

if current >= maximum then
  return {0, ttl}
end

current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], window)
end

return {1, 0}
`;

export interface RateLimitRule {
  window: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number | null;
}

/** Compteur à fenêtre fixe, atomique et partagé entre toutes les instances. */
export async function consumeFixedWindowRateLimit(
  namespace: string,
  identity: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const safeNamespace = namespace.replace(/[^a-z0-9:_-]/gi, "-").slice(0, 64);
  const identityHash = createHash("sha256").update(identity).digest("hex");
  const redisKey = `${RATE_LIMIT_PREFIX}${safeNamespace}:${identityHash}`;

  const result = await getRedisClient().eval(
    RATE_LIMIT_SCRIPT,
    1,
    redisKey,
    String(rule.window),
    String(rule.max),
  );

  if (!Array.isArray(result) || result.length !== 2) {
    throw new Error("RATE_LIMIT_STORAGE_INVALID_RESPONSE");
  }

  const allowed = Number(result[0]) === 1;
  return {
    allowed,
    retryAfter: allowed ? null : Math.max(1, Number(result[1]) || rule.window),
  };
}
