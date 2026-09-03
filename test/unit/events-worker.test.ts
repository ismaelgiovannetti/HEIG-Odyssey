import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseStreamFields,
  parseStreamEnvelope,
  initConsumerGroup,
  processAndAckStreamMessage,
  claimAndProcessStaleMessages,
} from "@/lib/../worker/quest-worker";
import {
  registerEventHandler,
  clearEventHandlers,
  dispatchDomainEvent,
} from "@/lib/../worker/event-dispatcher";
import { createDomainEvent } from "@/lib/events/contracts";
import { asRedisClient } from "../helpers/mock-clients";

describe("Quest Worker & Event Dispatcher (T-US17-04)", () => {
  beforeEach(() => {
    clearEventHandlers();
    vi.clearAllMocks();
  });

  it("parse correctement un tableau de champs bruts clé-valeur Redis", () => {
    const raw = [
      "eventId",
      "evt_123",
      "eventType",
      "battle.completed",
      "payload",
      '{"foo":"bar"}',
    ];
    const fields = parseStreamFields(raw);
    expect(fields).toEqual({
      eventId: "evt_123",
      eventType: "battle.completed",
      payload: '{"foo":"bar"}',
    });
  });

  it("désérialise et valide une enveloppe d'événement valide", () => {
    const rawFields = [
      "eventId",
      "evt_abc",
      "eventType",
      "battle.completed",
      "aggregateType",
      "BATTLE",
      "aggregateId",
      "btl_999",
      "version",
      "1",
      "occurredAt",
      "2026-09-01T10:00:00.000Z",
      "payload",
      JSON.stringify({
        userId: "usr_1",
        battleId: "btl_999",
        battleType: "CAMPAIGN",
        stageId: "bachelor-1-stage-1",
        worldId: "bachelor-1",
        opponentId: "trainer-jean",
        result: "VICTORY",
        winner: "p1",
        turnsCount: 2,
        xpGained: 100,
        moneyGained: 50,
        playerPokemonIds: ["p1"],
      }),
    ];

    const envelope = parseStreamEnvelope("1725180000000-0", rawFields);
    expect(envelope).not.toBeNull();
    expect(envelope?.eventId).toBe("evt_abc");
    expect(envelope?.eventType).toBe("battle.completed");
    expect(envelope?.aggregateId).toBe("btl_999");
  });

  it("ignore un message malformé sans faire crasher le parser", () => {
    const invalidFields = ["invalidKey", "invalidValue"];
    const envelope = parseStreamEnvelope("1725180000000-1", invalidFields);
    expect(envelope).toBeNull();
  });

  it("distribue les événements aux handlers enregistrés", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerEventHandler("battle.completed", handler);

    const event = createDomainEvent({
      eventType: "battle.completed",
      aggregateType: "BATTLE",
      aggregateId: "btl_1",
      payload: { test: true },
    });

    const result = await dispatchDomainEvent(event);
    expect(result.success).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("traite et acquitte (XACK) le message lorsque les handlers réussissent", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerEventHandler("battle.completed", handler);

    const mockRedis = {
      xack: vi.fn().mockResolvedValue(1),
    };

    const rawFields = [
      "eventId",
      "evt_abc",
      "eventType",
      "battle.completed",
      "aggregateType",
      "BATTLE",
      "aggregateId",
      "btl_999",
      "version",
      "1",
      "occurredAt",
      "2026-09-01T10:00:00.000Z",
      "payload",
      JSON.stringify({
        userId: "usr_1",
        battleId: "btl_999",
        battleType: "CAMPAIGN",
        stageId: "bachelor-1-stage-1",
        worldId: "bachelor-1",
        opponentId: "trainer-jean",
        result: "VICTORY",
        winner: "p1",
        turnsCount: 2,
        xpGained: 100,
        moneyGained: 50,
        playerPokemonIds: ["p1"],
      }),
    ];

    const success = await processAndAckStreamMessage(
      asRedisClient(mockRedis),
      "heig-odyssey:events",
      "quest-workers",
      "1725180000000-0",
      rawFields,
    );

    expect(success).toBe(true);
    expect(mockRedis.xack).toHaveBeenCalledWith(
      "heig-odyssey:events",
      "quest-workers",
      "1725180000000-0",
    );
  });

  it("n'acquitte PAS le message si un handler lève une exception", async () => {
    const failingHandler = vi.fn().mockRejectedValue(new Error("DB timeout"));
    registerEventHandler("battle.completed", failingHandler);

    const mockRedis = {
      xack: vi.fn(),
    };

    const rawFields = [
      "eventId",
      "evt_abc",
      "eventType",
      "battle.completed",
      "aggregateType",
      "BATTLE",
      "aggregateId",
      "btl_999",
      "version",
      "1",
      "occurredAt",
      "2026-09-01T10:00:00.000Z",
      "payload",
      JSON.stringify({
        userId: "usr_1",
        battleId: "btl_999",
        battleType: "CAMPAIGN",
        stageId: "bachelor-1-stage-1",
        worldId: "bachelor-1",
        opponentId: "trainer-jean",
        result: "VICTORY",
        winner: "p1",
        turnsCount: 2,
        xpGained: 100,
        moneyGained: 50,
        playerPokemonIds: ["p1"],
      }),
    ];

    const success = await processAndAckStreamMessage(
      asRedisClient(mockRedis),
      "heig-odyssey:events",
      "quest-workers",
      "1725180000000-0",
      rawFields,
    );

    expect(success).toBe(false);
    expect(mockRedis.xack).not.toHaveBeenCalled();
  });

  it("gère l'erreur BUSYGROUP de manière idempotente lors de l'initialisation du groupe", async () => {
    const mockRedis = {
      xgroup: vi
        .fn()
        .mockRejectedValue(
          new Error("BUSYGROUP Consumer Group name already exists"),
        ),
    };

    await expect(
      initConsumerGroup(asRedisClient(mockRedis)),
    ).resolves.not.toThrow();
  });

  it("réclame et acquitte les messages abandonnés avec XAUTOCLAIM", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerEventHandler("battle.completed", handler);

    const rawFields = [
      "eventId",
      "evt_stale",
      "eventType",
      "battle.completed",
      "aggregateType",
      "BATTLE",
      "aggregateId",
      "btl_stale",
      "version",
      "1",
      "occurredAt",
      "2026-09-01T10:00:00.000Z",
      "payload",
      JSON.stringify({
        userId: "usr_1",
        battleId: "btl_stale",
        battleType: "CAMPAIGN",
        stageId: "bachelor-1-stage-1",
        worldId: "bachelor-1",
        opponentId: "trainer-jean",
        result: "VICTORY",
        winner: "p1",
        turnsCount: 2,
        xpGained: 100,
        moneyGained: 50,
        playerPokemonIds: ["p1"],
      }),
    ];

    const mockRedis = {
      xautoclaim: vi
        .fn()
        .mockResolvedValue(["0-0", [["1725180000099-0", rawFields]]]),
      xack: vi.fn().mockResolvedValue(1),
    };

    const count = await claimAndProcessStaleMessages(
      asRedisClient(mockRedis),
      "heig-odyssey:events",
      "quest-workers",
      "worker_test",
      60000,
    );

    expect(count).toBe(1);
    expect(mockRedis.xack).toHaveBeenCalledWith(
      "heig-odyssey:events",
      "quest-workers",
      "1725180000099-0",
    );
  });
});
