import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishDomainEvent, publishPendingOutboxEvents, EVENTS_STREAM_KEY } from "@/lib/events/publisher";
import { createDomainEvent } from "@/lib/events/contracts";
import { prisma } from "@/lib/prisma";
import { OutboxStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outboxEvent: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("Redis Streams & Outbox Publisher (T-US17-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publie un événement directement dans Redis Streams avec xadd", async () => {
    const mockRedis = {
      xadd: vi.fn().mockResolvedValue("1725180000000-0"),
    };

    const event = createDomainEvent({
      eventType: "battle.completed",
      aggregateType: "BATTLE",
      aggregateId: "btl_123",
      payload: {
        userId: "usr_1",
        battleId: "btl_123",
        battleType: "CAMPAIGN",
        stageId: "bachelor-1-stage-1",
        worldId: "bachelor-1",
        opponentId: "trainer-jean",
        result: "VICTORY",
        winner: "p1",
        turnsCount: 3,
        xpGained: 100,
        moneyGained: 50,
        playerPokemonIds: ["poke_1"],
      },
    });

    const msgId = await publishDomainEvent(event, mockRedis as any);

    expect(msgId).toBe("1725180000000-0");
    expect(mockRedis.xadd).toHaveBeenCalledWith(
      EVENTS_STREAM_KEY,
      "*",
      "eventId",
      event.eventId,
      "eventType",
      "battle.completed",
      "aggregateType",
      "BATTLE",
      "aggregateId",
      "btl_123",
      "version",
      "1",
      "occurredAt",
      event.occurredAt,
      "payload",
      expect.any(String)
    );
  });

  it("parcourt les événements en attente et les marque comme PUBLISHED après succès", async () => {
    const pendingEvents = [
      {
        id: "outbox-1",
        eventId: "evt_111",
        eventType: "battle.completed",
        aggregateType: "BATTLE",
        aggregateId: "btl_111",
        payload: { userId: "usr_1" },
        status: OutboxStatus.PENDING,
        retryCount: 0,
        createdAt: new Date("2026-09-01T10:00:00Z"),
      },
    ];

    (prisma.outboxEvent.findMany as any).mockResolvedValue(pendingEvents);
    (prisma.outboxEvent.update as any).mockResolvedValue({});

    const mockRedis = {
      xadd: vi.fn().mockResolvedValue("1725180000001-0"),
    };

    const result = await publishPendingOutboxEvents({ client: mockRedis as any });

    expect(result.publishedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(mockRedis.xadd).toHaveBeenCalledTimes(1);
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: "outbox-1" },
      data: {
        status: OutboxStatus.PUBLISHED,
        publishedAt: expect.any(Date),
        lastError: null,
      },
    });
  });

  it("déplie les anciennes enveloppes Outbox avant de publier leur payload", async () => {
    (prisma.outboxEvent.findMany as any).mockResolvedValue([
      {
        id: "outbox-legacy",
        eventId: "evt_legacy",
        eventType: "battle.completed",
        aggregateType: "BATTLE",
        aggregateId: "btl_legacy",
        payload: {
          eventId: "evt_legacy",
          eventType: "battle.completed",
          aggregateType: "BATTLE",
          aggregateId: "btl_legacy",
          version: 1,
          occurredAt: "2026-09-01T10:00:00.000Z",
          payload: { userId: "usr_legacy", battleId: "btl_legacy" },
        },
        status: OutboxStatus.PENDING,
        retryCount: 0,
        createdAt: new Date("2026-09-01T10:00:00Z"),
      },
    ]);
    (prisma.outboxEvent.update as any).mockResolvedValue({});
    const mockRedis = { xadd: vi.fn().mockResolvedValue("1-0") };

    await publishPendingOutboxEvents({ client: mockRedis as any });

    const args = mockRedis.xadd.mock.calls[0];
    const payloadIndex = args.indexOf("payload") + 1;
    expect(JSON.parse(args[payloadIndex])).toEqual({
      userId: "usr_legacy",
      battleId: "btl_legacy",
    });
  });

  it("gère l'erreur lors de l'envoi Redis et incrémente le retryCount", async () => {
    const pendingEvents = [
      {
        id: "outbox-2",
        eventId: "evt_222",
        eventType: "battle.completed",
        aggregateType: "BATTLE",
        aggregateId: "btl_222",
        payload: { userId: "usr_2" },
        status: OutboxStatus.PENDING,
        retryCount: 1,
        createdAt: new Date("2026-09-01T10:00:00Z"),
      },
    ];

    (prisma.outboxEvent.findMany as any).mockResolvedValue(pendingEvents);
    (prisma.outboxEvent.update as any).mockResolvedValue({});

    const mockRedis = {
      xadd: vi.fn().mockRejectedValue(new Error("Redis connection refused")),
    };

    const result = await publishPendingOutboxEvents({ client: mockRedis as any });

    expect(result.publishedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: "outbox-2" },
      data: {
        retryCount: { increment: 1 },
        lastError: "Redis connection refused",
        status: OutboxStatus.PENDING,
      },
    });
  });
});
