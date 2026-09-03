import {
  BattleResult,
  BattleType,
  OutboxStatus,
  type BattleRecord,
  type OutboxEvent,
  type UserProfile,
} from "@prisma/client";

const REFERENCE_DATE = new Date("2026-09-01T10:00:00.000Z");

export function outboxEvent(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: "outbox-1",
    eventId: "evt_1",
    eventType: "battle.completed",
    aggregateType: "BATTLE",
    aggregateId: "battle-1",
    payload: {},
    status: OutboxStatus.PENDING,
    retryCount: 0,
    lastError: null,
    createdAt: REFERENCE_DATE,
    publishedAt: null,
    ...overrides,
  };
}

export function battleRecord(
  overrides: Partial<BattleRecord> = {},
): BattleRecord {
  return {
    id: "battle-record-1",
    userId: "user-1",
    battleType: BattleType.CAMPAIGN,
    opponentId: "trainer-jean",
    opponentTeamSnapshot: {},
    playerTeamSnapshot: {},
    result: BattleResult.VICTORY,
    turnsCount: 1,
    rewardsClaimed: true,
    xpGained: 100,
    moneyGained: 50,
    idempotencyKey: "battle-1",
    createdAt: REFERENCE_DATE,
    completedAt: REFERENCE_DATE,
    ...overrides,
  };
}

export function userProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "profile-1",
    userId: "user-1",
    pokedollars: 0,
    hasCompletedOnboarding: true,
    onboardingCompletedAt: REFERENCE_DATE,
    collectionRevision: 0,
    createdAt: REFERENCE_DATE,
    updatedAt: REFERENCE_DATE,
    ...overrides,
  };
}
