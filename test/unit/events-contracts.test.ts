import { describe, it, expect } from "vitest";
import {
  generateEventId,
  createDomainEvent,
  DomainEventEnvelopeSchema,
  BattleCompletedPayloadSchema,
  TrainingCompletedPayloadSchema,
} from "@/lib/events/contracts";

describe("Events Contracts (T-US17-01)", () => {
  it("génère des identifiants d'événement uniques avec le préfixe par défaut", () => {
    const id1 = generateEventId();
    const id2 = generateEventId();

    expect(id1).toMatch(/^evt_[a-f0-9]{32}$/);
    expect(id2).toMatch(/^evt_[a-f0-9]{32}$/);
    expect(id1).not.toBe(id2);
  });

  it("génère des identifiants d'événement avec un préfixe personnalisé", () => {
    const customId = generateEventId("battle");
    expect(customId).toMatch(/^battle_[a-f0-9]{32}$/);
  });

  it("valide un payload d'événement de fin de combat de campagne valide", () => {
    const validPayload = {
      userId: "usr_123",
      battleId: "btl_456",
      battleType: "CAMPAIGN" as const,
      stageId: "bachelor-1-stage-1",
      worldId: "bachelor-1",
      opponentId: "trainer-jean",
      result: "VICTORY" as const,
      winner: "p1" as const,
      turnsCount: 4,
      xpGained: 100,
      moneyGained: 50,
      playerPokemonIds: ["poke_1", "poke_2"],
      playerTeamSpecies: ["turtwig", "chimchar"],
    };

    const parsed = BattleCompletedPayloadSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it("refuse un payload de campagne incomplet ou invalide", () => {
    const invalidPayload = {
      userId: "usr_123",
      battleId: "btl_456",
      battleType: "CAMPAIGN",
      // stageId manquant
      result: "INVALID_RESULT",
    };

    const parsed = BattleCompletedPayloadSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it("valide un payload de combat d'entraînement valide", () => {
    const validPayload = {
      userId: "usr_123",
      battleId: "btl_789",
      battleType: "TRAINING" as const,
      difficulty: "normal" as const,
      opponentId: "training-bot",
      result: "DEFEAT" as const,
      winner: "p2" as const,
      turnsCount: 6,
      xpGained: 0,
      moneyGained: 0,
      playerPokemonIds: ["poke_1"],
    };

    const parsed = TrainingCompletedPayloadSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it("crée une enveloppe d'événement complète et conforme au schéma", () => {
    const event = createDomainEvent({
      eventType: "battle.completed",
      aggregateType: "BATTLE",
      aggregateId: "btl_456",
      payload: {
        userId: "usr_123",
        battleId: "btl_456",
        battleType: "CAMPAIGN",
        stageId: "bachelor-1-stage-1",
        worldId: "bachelor-1",
        opponentId: "trainer-jean",
        result: "VICTORY",
        winner: "p1",
        turnsCount: 3,
        xpGained: 120,
        moneyGained: 60,
        playerPokemonIds: ["poke_1"],
      },
    });

    expect(event.eventId).toBeDefined();
    expect(event.eventType).toBe("battle.completed");
    expect(event.version).toBe(1);
    expect(typeof event.occurredAt).toBe("string");

    const validated = DomainEventEnvelopeSchema.safeParse(event);
    expect(validated.success).toBe(true);
  });
});
