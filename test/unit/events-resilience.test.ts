import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  publishPendingOutboxEvents,
  publishDomainEvent,
  EVENTS_STREAM_KEY,
} from "@/lib/events/publisher";
import {
  processAndAckStreamMessage,
  claimAndProcessStaleMessages,
} from "@/worker/quest-worker";
import {
  registerEventHandler,
  clearEventHandlers,
} from "@/worker/event-dispatcher";
import { createDomainEvent } from "@/lib/events/contracts";
import { prisma } from "@/lib/prisma";
import { OutboxStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outboxEvent: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("Redis Streams Resilience & Idempotency (T-US17-05)", () => {
  beforeEach(() => {
    clearEventHandlers();
    vi.clearAllMocks();
  });

  describe("Scénario 1 : Panne temporaire Redis et reprise par l'Outbox", () => {
    it("conserve l'événement en PENDING lors d'une panne Redis puis le publie avec succès au retour du service", async () => {
      const mockPendingEvent = {
        id: "outbox-resilient-1",
        eventId: "evt_resilient_1",
        eventType: "battle.completed",
        aggregateType: "BATTLE",
        aggregateId: "btl_resilient_1",
        payload: { userId: "usr_resilient" },
        status: OutboxStatus.PENDING,
        retryCount: 0,
        createdAt: new Date("2026-09-01T10:00:00Z"),
      };

      (prisma.outboxEvent.findMany as any).mockResolvedValue([mockPendingEvent]);
      (prisma.outboxEvent.update as any).mockResolvedValue({});

      // 1. Échec initial (Redis hors service)
      const offlineRedis = {
        xadd: vi.fn().mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:6379")),
      };

      const failResult = await publishPendingOutboxEvents({ client: offlineRedis as any });
      expect(failResult.failedCount).toBe(1);
      expect(failResult.publishedCount).toBe(0);
      expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: "outbox-resilient-1" },
        data: {
          retryCount: { increment: 1 },
          lastError: "ECONNREFUSED 127.0.0.1:6379",
          status: OutboxStatus.PENDING,
        },
      });

      // 2. Rétablissement de Redis
      const onlineRedis = {
        xadd: vi.fn().mockResolvedValue("1725180000010-0"),
      };

      const successResult = await publishPendingOutboxEvents({ client: onlineRedis as any });
      expect(successResult.publishedCount).toBe(1);
      expect(successResult.failedCount).toBe(0);
      expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: "outbox-resilient-1" },
        data: {
          status: OutboxStatus.PUBLISHED,
          publishedAt: expect.any(Date),
          lastError: null,
        },
      });
    });
  });

  describe("Scénario 2 : Crash du worker et reprise automatique des messages abandonnés", () => {
    it("réclame le message non acquitté via XAUTOCLAIM et finalise son traitement", async () => {
      const processedEventIds: string[] = [];

      registerEventHandler("battle.completed", async (event) => {
        processedEventIds.push(event.eventId);
      });

      const staleMessageRawFields = [
        "eventId",
        "evt_abandoned_42",
        "eventType",
        "battle.completed",
        "aggregateType",
        "BATTLE",
        "aggregateId",
        "btl_42",
        "version",
        "1",
        "occurredAt",
        "2026-09-01T10:00:00.000Z",
        "payload",
        JSON.stringify({
          userId: "usr_42",
          battleId: "btl_42",
          battleType: "CAMPAIGN",
          stageId: "bachelor-1-stage-1",
          worldId: "bachelor-1",
          opponentId: "trainer-jean",
          result: "VICTORY",
          winner: "p1",
          turnsCount: 3,
          xpGained: 100,
          moneyGained: 50,
          playerPokemonIds: ["p1"],
        }),
      ];

      const mockRedis = {
        xautoclaim: vi.fn().mockResolvedValue([
          "0-0",
          [["1725180000042-0", staleMessageRawFields]],
        ]),
        xack: vi.fn().mockResolvedValue(1),
      };

      const claimedCount = await claimAndProcessStaleMessages(
        mockRedis as any,
        EVENTS_STREAM_KEY,
        "quest-workers",
        "recovery-worker-1",
        30000
      );

      expect(claimedCount).toBe(1);
      expect(processedEventIds).toContain("evt_abandoned_42");
      expect(mockRedis.xack).toHaveBeenCalledWith(
        EVENTS_STREAM_KEY,
        "quest-workers",
        "1725180000042-0"
      );
    });
  });

  describe("Scénario 3 : Idempotence et protection contre le rejeu", () => {
    it("garantit que l'exécution rejouée d'un même événement est détectable via son eventId unique", async () => {
      const handledEventsSet = new Set<string>();
      let sideEffectCount = 0;

      // Handler idempotent vérifiant si l'événement a déjà été appliqué
      registerEventHandler("battle.completed", async (event) => {
        if (handledEventsSet.has(event.eventId)) {
          // Événement déjà traité : idempotent no-op
          return;
        }
        handledEventsSet.add(event.eventId);
        sideEffectCount++;
      });

      const rawFields = [
        "eventId",
        "evt_idempotent_99",
        "eventType",
        "battle.completed",
        "aggregateType",
        "BATTLE",
        "aggregateId",
        "btl_99",
        "version",
        "1",
        "occurredAt",
        "2026-09-01T10:00:00.000Z",
        "payload",
        JSON.stringify({
          userId: "usr_99",
          battleId: "btl_99",
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
        xack: vi.fn().mockResolvedValue(1),
      };

      // 1er passage
      const res1 = await processAndAckStreamMessage(
        mockRedis as any,
        EVENTS_STREAM_KEY,
        "quest-workers",
        "1725180000099-0",
        rawFields
      );
      expect(res1).toBe(true);
      expect(sideEffectCount).toBe(1);

      // 2e passage (rejeu du même événement)
      const res2 = await processAndAckStreamMessage(
        mockRedis as any,
        EVENTS_STREAM_KEY,
        "quest-workers",
        "1725180000099-0",
        rawFields
      );
      expect(res2).toBe(true);
      expect(sideEffectCount).toBe(1); // Aucun effet supplémentaire
      expect(mockRedis.xack).toHaveBeenCalledTimes(2);
    });
  });

  describe("Scénario 4 : Message empoisonné (Poison pill) sans blocage", () => {
    it("acquitte un message JSON corrompu pour éviter de bloquer la consommation des messages suivants", async () => {
      const mockRedis = {
        xadd: vi.fn().mockResolvedValue("1725180000667-0"),
        xack: vi.fn().mockResolvedValue(1),
      };

      const corruptedRawFields = [
        "eventId",
        "evt_corrupted",
        "eventType",
        "battle.completed",
        "payload",
        "MALFORMED_NON_JSON_DATA",
      ];

      const result = await processAndAckStreamMessage(
        mockRedis as any,
        EVENTS_STREAM_KEY,
        "quest-workers",
        "1725180000666-0",
        corruptedRawFields
      );

      // Message rejeté, conservé en quarantaine puis acquitté.
      expect(result).toBe(false);
      expect(mockRedis.xadd).toHaveBeenCalled();
      expect(mockRedis.xack).toHaveBeenCalledWith(
        EVENTS_STREAM_KEY,
        "quest-workers",
        "1725180000666-0"
      );
      expect(mockRedis.xadd.mock.invocationCallOrder[0]).toBeLessThan(
        mockRedis.xack.mock.invocationCallOrder[0],
      );
    });
  });
});
