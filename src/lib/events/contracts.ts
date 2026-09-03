import "server-only";

import { z } from "zod";
import { randomUUID } from "node:crypto";

/**
 * Générateur standardisé d'identifiant d'événement unique.
 * Format : evt_<uuid_sans_tirets>
 */
export function generateEventId(prefix: string = "evt"): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export const DomainEventTypeEnum = z.enum([
  "battle.completed",
  "training.completed",
]);

export type DomainEventType = z.infer<typeof DomainEventTypeEnum>;

function validateBattleOutcome(
  payload: {
    result: "VICTORY" | "DEFEAT" | "ESCAPED";
    winner: "p1" | "p2";
  },
  context: z.RefinementCtx,
): void {
  const expectedWinner = payload.result === "VICTORY" ? "p1" : "p2";
  if (payload.winner !== expectedWinner) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["winner"],
      message: "Le vainqueur ne correspond pas au résultat du combat.",
    });
  }
}

/**
 * Schéma et type du payload pour l'événement de fin de combat de campagne.
 */
export const BattleCompletedPayloadSchema = z
  .object({
    userId: z.string().min(1),
    battleId: z.string().min(1),
    battleType: z.literal("CAMPAIGN"),
    stageId: z.string().min(1),
    worldId: z.string().min(1),
    opponentId: z.string().min(1),
    result: z.enum(["VICTORY", "DEFEAT", "ESCAPED"]),
    winner: z.enum(["p1", "p2"]),
    turnsCount: z.number().int().min(0),
    xpGained: z.number().int().min(0),
    moneyGained: z.number().int().min(0),
    playerPokemonIds: z.array(z.string()),
    playerTeamSpecies: z.array(z.string()).optional(),
  })
  .strict()
  .superRefine(validateBattleOutcome);

export type BattleCompletedPayload = z.infer<
  typeof BattleCompletedPayloadSchema
>;

/**
 * Schéma et type du payload pour l'événement de fin de combat d'entraînement.
 */
export const TrainingCompletedPayloadSchema = z
  .object({
    userId: z.string().min(1),
    battleId: z.string().min(1),
    battleType: z.literal("TRAINING"),
    difficulty: z.enum(["easy", "normal", "hard"]).optional(),
    opponentId: z.string().min(1),
    result: z.enum(["VICTORY", "DEFEAT", "ESCAPED"]),
    winner: z.enum(["p1", "p2"]),
    turnsCount: z.number().int().min(0),
    xpGained: z.number().int().min(0),
    moneyGained: z.number().int().min(0),
    playerPokemonIds: z.array(z.string()),
    playerTeamSpecies: z.array(z.string()).optional(),
  })
  .strict()
  .superRefine(validateBattleOutcome);

export type TrainingCompletedPayload = z.infer<
  typeof TrainingCompletedPayloadSchema
>;

const DomainEventMetadataSchema = {
  eventId: z.string().min(1).max(128),
  aggregateId: z.string().min(1).max(128),
  version: z.number().int().min(1).default(1),
  occurredAt: z.string().datetime(),
};

/**
 * Enveloppe globale d'événement métier. La branche discriminée lie chaque type
 * à son agrégat et à son payload au lieu d'accepter un objet arbitraire.
 */
export const DomainEventEnvelopeSchema = z
  .discriminatedUnion("eventType", [
    z
      .object({
        ...DomainEventMetadataSchema,
        eventType: z.literal("battle.completed"),
        aggregateType: z.literal("BATTLE"),
        payload: BattleCompletedPayloadSchema,
      })
      .strict(),
    z
      .object({
        ...DomainEventMetadataSchema,
        eventType: z.literal("training.completed"),
        aggregateType: z.literal("TRAINING"),
        payload: TrainingCompletedPayloadSchema,
      })
      .strict(),
  ])
  .superRefine((event, context) => {
    if (event.aggregateId !== event.payload.battleId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["aggregateId"],
        message: "L'agrégat ne correspond pas au combat du payload.",
      });
    }
  });

export type DomainEventEnvelope<T = unknown> = {
  eventId: string;
  eventType: DomainEventType;
  aggregateType: "BATTLE" | "TRAINING";
  aggregateId: string;
  version: number;
  occurredAt: string;
  payload: T;
};

/**
 * Fabrique standardisée d'enveloppe d'événement.
 */
export function createDomainEvent<T extends Record<string, unknown>>(params: {
  eventType: DomainEventType;
  aggregateType: "BATTLE" | "TRAINING";
  aggregateId: string;
  payload: T;
  version?: number;
  eventId?: string;
  occurredAt?: Date;
}): DomainEventEnvelope<T> {
  const eventId = params.eventId ?? generateEventId();
  const occurredAt = (params.occurredAt ?? new Date()).toISOString();

  return {
    eventId,
    eventType: params.eventType,
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    version: params.version ?? 1,
    occurredAt,
    payload: params.payload,
  };
}
