import "server-only";

import type { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import {
  getOrGenerateActiveRotations,
  type QuestDatabaseClient,
} from "./rotation-service";
import type {
  BattleCompletedPayload,
  TrainingCompletedPayload,
} from "../events/contracts";
import { PermanentDomainEventError } from "../events/errors";
import type {
  ClaimQuestRewardResult,
  QuestItem as UserQuestItem,
  UserQuestsState,
} from "./quest-contract";

export type {
  ClaimQuestRewardResult,
  QuestItem as UserQuestItem,
  UserQuestsState,
} from "./quest-contract";

export class QuestNotFoundError extends Error {
  constructor(message = "Quête introuvable pour cette rotation.") {
    super(message);
    this.name = "QuestNotFoundError";
  }
}

export class QuestNotCompletedError extends Error {
  constructor(
    message = "Les objectifs de la quête ne sont pas encore atteints.",
  ) {
    super(message);
    this.name = "QuestNotCompletedError";
  }
}

export class QuestRewardAlreadyClaimedError extends Error {
  constructor(message = "La récompense de cette quête a déjà été réclamée.") {
    super(message);
    this.name = "QuestRewardAlreadyClaimedError";
  }
}

/**
 * Indique si le worker doit encore appliquer l'événement d'un combat du
 * joueur. La recherche inclut l'identité du propriétaire afin qu'un identifiant
 * appartenant a un autre compte soit indistinguable d'un identifiant inconnu.
 */
export async function isQuestProgressPendingForBattle(
  userId: string,
  battleId: string,
  client: QuestDatabaseClient = prisma,
): Promise<boolean> {
  const ownBattle = await client.battleRecord.findFirst({
    where: {
      idempotencyKey: battleId,
      userId,
    },
    select: { id: true },
  });

  if (!ownBattle) return false;

  const receipt = await client.processedDomainEvent.findUnique({
    where: { aggregateId: battleId },
    select: { id: true },
  });

  return receipt === null;
}

/**
 * Récupère l'état complet des quêtes actives et de la progression pour un joueur.
 */
export async function getUserQuests(
  userId: string,
  date: Date = new Date(),
  client: QuestDatabaseClient = prisma,
): Promise<UserQuestsState> {
  const activeRotations = await getOrGenerateActiveRotations(date, client);
  const rotationIds = activeRotations.allRotations.map((r) => r.id);

  const existingProgress = await client.userQuestProgress.findMany({
    where: {
      userId,
      rotationId: { in: rotationIds },
    },
  });

  const progressByRotationId = new Map(
    existingProgress.map((progress) => [progress.rotationId, progress]),
  );

  const mapRotationToItem = (
    rotation: (typeof activeRotations.allRotations)[number],
  ): UserQuestItem => {
    const progress = progressByRotationId.get(rotation.id);
    const targetCount = rotation.quest.targetCount;
    const currentCount = progress
      ? Math.min(progress.currentCount, targetCount)
      : 0;
    const isCompleted = progress
      ? progress.isCompleted || currentCount >= targetCount
      : false;
    const rewardClaimed = progress ? progress.rewardClaimed : false;

    return {
      rotationId: rotation.id,
      questId: rotation.quest.id,
      title: rotation.quest.title,
      description: rotation.quest.description,
      type: rotation.type,
      targetType: rotation.quest.targetType,
      targetCount,
      currentCount,
      isCompleted,
      rewardClaimed,
      claimedAt: progress?.claimedAt ? progress.claimedAt.toISOString() : null,
      rewardPokedollars: rotation.quest.rewardPokedollars,
      rewardXp: rotation.quest.rewardXp,
      startDate: rotation.startDate.toISOString(),
      endDate: rotation.endDate.toISOString(),
    };
  };

  const dailyQuests = activeRotations.dailyRotations.map(mapRotationToItem);
  const weeklyQuests = activeRotations.weeklyRotations.map(mapRotationToItem);

  return {
    dailyPeriodKey: activeRotations.dailyPeriodKey,
    weeklyPeriodKey: activeRotations.weeklyPeriodKey,
    dailyQuests,
    weeklyQuests,
    allQuests: [...dailyQuests, ...weeklyQuests],
  };
}

/**
 * Calcule l'incrément applicable pour un objectif de quête à partir d'un événement de combat.
 */
export function calculateQuestIncrement(
  targetType: string,
  payload: BattleCompletedPayload | TrainingCompletedPayload,
): number {
  const isVictory = payload.winner === "p1";

  switch (targetType) {
    case "WIN_BATTLES_ANY":
    case "WIN_BATTLES":
    case "COMPLETE_BATTLES":
      return isVictory ? 1 : 0;

    case "WIN_BATTLES_CAMPAIGN":
      return isVictory && payload.battleType === "CAMPAIGN" ? 1 : 0;

    case "WIN_BATTLES_TRAINING":
    case "WIN_TRAINING":
      return isVictory && payload.battleType === "TRAINING" ? 1 : 0;

    case "COMPLETE_TURNS":
      return payload.turnsCount > 0 ? payload.turnsCount : 0;

    default:
      return 0;
  }
}

/**
 * Met à jour la progression des quêtes actives d'un joueur suite à un événement de combat.
 */
export async function handleBattleCompletedForQuests(
  payload: BattleCompletedPayload | TrainingCompletedPayload,
  client: QuestDatabaseClient = prisma,
  occurredAt: Date = new Date(),
): Promise<number> {
  const userId = payload.userId;
  if (!userId) return 0;

  const activeRotations = await getOrGenerateActiveRotations(
    occurredAt,
    client,
  );
  let updatedCount = 0;

  for (const rotation of activeRotations.allRotations) {
    const increment = calculateQuestIncrement(
      rotation.quest.targetType,
      payload,
    );
    if (increment <= 0) continue;

    const targetCount = rotation.quest.targetCount;
    const progress = await client.userQuestProgress.upsert({
      where: {
        userId_rotationId: {
          userId,
          rotationId: rotation.id,
        },
      },
      create: {
        userId,
        rotationId: rotation.id,
        currentCount: increment,
        isCompleted: increment >= targetCount,
      },
      update: {
        // L'incrément SQL évite de perdre une victoire si deux événements
        // distincts sont traités simultanément pour le même joueur.
        currentCount: { increment },
      },
    });

    if (!progress.isCompleted && progress.currentCount >= targetCount) {
      await client.userQuestProgress.updateMany({
        where: { id: progress.id, isCompleted: false },
        data: { isCompleted: true },
      });
    }

    updatedCount++;
  }

  return updatedCount;
}

/**
 * Applique un événement Redis une seule fois. Le reçu et les progressions sont
 * écrits dans la même transaction : un crash ne peut laisser l'un sans l'autre.
 */
export async function handleBattleCompletedEventForQuests(
  eventId: string,
  payload: BattleCompletedPayload | TrainingCompletedPayload,
  client: PrismaClient = prisma,
): Promise<number> {
  return client.$transaction(async (tx) => {
    const receipt = await tx.processedDomainEvent.createMany({
      // Un combat ne doit faire progresser les quêtes qu'une seule fois, même
      // si un producteur compromis republie son payload avec un nouvel eventId.
      data: [{ eventId, aggregateId: payload.battleId }],
      skipDuplicates: true,
    });

    if (receipt.count === 0) {
      return 0;
    }

    // Redis est un transport, pas une source de vérité. Un événement forgé ou
    // corrompu ne doit pas pouvoir faire progresser les quêtes d'un autre compte.
    const battle = await tx.battleRecord.findUnique({
      where: { idempotencyKey: payload.battleId },
      select: {
        userId: true,
        battleType: true,
        opponentId: true,
        result: true,
        turnsCount: true,
        xpGained: true,
        moneyGained: true,
        completedAt: true,
      },
    });
    const completedAt =
      battle?.completedAt instanceof Date ? battle.completedAt : null;
    const eventMatchesRecord =
      completedAt !== null &&
      battle?.userId === payload.userId &&
      battle.battleType === payload.battleType &&
      battle.opponentId === payload.opponentId &&
      battle.result === payload.result &&
      payload.winner === (battle.result === "VICTORY" ? "p1" : "p2") &&
      battle.turnsCount === payload.turnsCount &&
      battle.xpGained === payload.xpGained &&
      battle.moneyGained === payload.moneyGained;

    if (!eventMatchesRecord) {
      throw new PermanentDomainEventError("QUEST_EVENT_BATTLE_MISMATCH");
    }

    // La date persistée du combat est la source de vérité. Lors d'un
    // rattrapage, un ancien événement progresse ainsi son ancienne rotation au
    // lieu de créditer par erreur les missions actives aujourd'hui.
    return handleBattleCompletedForQuests(payload, tx, completedAt);
  });
}

/**
 * Réclame la récompense d'une quête terminée de manière transactionnelle et idempotente.
 */
export async function claimQuestReward(
  userId: string,
  rotationId: string,
  client: PrismaClient = prisma,
): Promise<ClaimQuestRewardResult> {
  return await client.$transaction(async (tx) => {
    // 1. Récupération de la progression et de la rotation liée
    const progress = await tx.userQuestProgress.findUnique({
      where: {
        userId_rotationId: {
          userId,
          rotationId,
        },
      },
      include: {
        rotation: {
          include: {
            quest: true,
          },
        },
      },
    });

    if (!progress) {
      throw new QuestNotFoundError();
    }

    if (!progress.isCompleted) {
      throw new QuestNotCompletedError();
    }

    if (progress.rewardClaimed) {
      throw new QuestRewardAlreadyClaimedError();
    }

    const quest = progress.rotation.quest;

    // 2. La précondition fait partie de l'UPDATE : deux requêtes concurrentes
    // ne peuvent jamais toutes les deux franchir cette étape.
    const claimed = await tx.userQuestProgress.updateMany({
      where: {
        id: progress.id,
        userId,
        isCompleted: true,
        rewardClaimed: false,
      },
      data: {
        rewardClaimed: true,
        claimedAt: new Date(),
      },
    });

    if (claimed.count !== 1) {
      throw new QuestRewardAlreadyClaimedError();
    }

    // 3. Crédit de la monnaie dans le profil utilisateur
    const updatedProfile = await tx.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        pokedollars: quest.rewardPokedollars,
        hasCompletedOnboarding: true,
      },
      update: {
        pokedollars: { increment: quest.rewardPokedollars },
      },
    });

    return {
      success: true,
      rotationId,
      rewardPokedollars: quest.rewardPokedollars,
      rewardXp: quest.rewardXp,
      newBalance: updatedProfile.pokedollars,
    };
  });
}
