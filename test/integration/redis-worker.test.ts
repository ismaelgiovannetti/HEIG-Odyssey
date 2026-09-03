import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDomainEvent } from "@/lib/events/contracts";
import { EVENTS_STREAM_KEY, publishDomainEvent } from "@/lib/events/publisher";
import {
  clearEventHandlers,
  registerEventHandler,
} from "@/worker/event-dispatcher";
import { QuestWorker } from "@/worker/quest-worker";

const REDIS_TIMEOUT_MS = 5_000;

function createTestRedisClient(): Redis {
  return new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    connectTimeout: 1_000,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
}

describe("Redis Streams quest worker", () => {
  let consumer: Redis;
  let publisher: Redis;

  beforeEach(async () => {
    clearEventHandlers();
    consumer = createTestRedisClient();
    publisher = createTestRedisClient();
    await Promise.all([consumer.connect(), publisher.connect()]);
  });

  afterEach(() => {
    clearEventHandlers();
    consumer.disconnect();
    publisher.disconnect();
  });

  it("publishes, consumes and acknowledges a real Redis event", async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const groupName = `quest-workers-integration-${suffix}`;
    const consumerName = `worker-integration-${suffix}`;
    const event = createDomainEvent({
      eventId: `evt-integration-${suffix}`,
      eventType: "battle.completed",
      aggregateType: "BATTLE",
      aggregateId: `battle-integration-${suffix}`,
      payload: {
        userId: `user-integration-${suffix}`,
        battleId: `battle-integration-${suffix}`,
        battleType: "CAMPAIGN",
        stageId: "bachelor-1-stage-1",
        worldId: "bachelor-1",
        opponentId: "trainer-integration",
        result: "VICTORY",
        winner: "p1",
        turnsCount: 4,
        xpGained: 110,
        moneyGained: 60,
        playerPokemonIds: ["pokemon-integration"],
      },
    });

    await consumer.xgroup(
      "CREATE",
      EVENTS_STREAM_KEY,
      groupName,
      "$",
      "MKSTREAM",
    );

    let resolveHandled: ((eventId: string) => void) | undefined;
    const handled = new Promise<string>((resolve) => {
      resolveHandled = resolve;
    });
    const unregister = registerEventHandler(
      "battle.completed",
      async (envelope) => {
        resolveHandled?.(envelope.eventId);
      },
    );
    const worker = new QuestWorker(consumer, {
      groupName,
      consumerName,
      blockTimeoutMs: 100,
      pollIntervalMs: 10,
    });
    const workerRun = worker.start();
    let messageId: string | undefined;

    try {
      messageId = await publishDomainEvent(event, publisher);
      await expect(
        Promise.race([
          handled,
          new Promise<never>((_resolve, reject) => {
            setTimeout(
              () => reject(new Error("Redis worker timed out")),
              REDIS_TIMEOUT_MS,
            );
          }),
        ]),
      ).resolves.toBe(event.eventId);

      const pending = await publisher.xpending(EVENTS_STREAM_KEY, groupName);
      expect(pending[0]).toBe(0);
    } finally {
      unregister();
      worker.stop();
      await workerRun;
      if (messageId) {
        await publisher.xdel(EVENTS_STREAM_KEY, messageId);
      }
      await publisher.xgroup("DESTROY", EVENTS_STREAM_KEY, groupName);
    }
  });
});
