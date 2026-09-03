import { prisma } from "../prisma";
import { getOrGenerateActiveRotations } from "./rotation-service";
import type { BattleCompletedPayload, TrainingCompletedPayload } from "../events/contracts";
import { PermanentDomainEventError } from "../events/errors";
import type { QuestType } from "@prisma/client";

export interface UserQuestItem {
  rotationId: string;
  questId: string;
  title: string;
  description: string;
  type: QuestType;
  targetType: string;
  targetCount: number;
  currentCount: number;
  isCompleted: boolean;
  rewardClaimed: boolean;
  claimedAt: string | null;
  rewardPokedollars: number;
  rewardXp: number;
  startDate: string;
  endDate: string;
}

export interface UserQuestsState {
  dailyPeriodKey: string;
  weeklyPeriodKey: string;
  dailyQuests: UserQuestItem[];
  weeklyQuests: UserQuestItem[];
  allQuests: UserQuestItem[];
}

export interface ClaimQuestRewardResult {
  success: boolean;
  rotationId: string;
  rewardPokedollars: number;
  rewardXp: number;
  newBalance: number;
}

export class QuestNotFoundError extends Error {
  constructor(message = "Quête introuvable pour cette rotation.") {
    super(message);
    this.name = "QuestNotFoundError";
  }
}

export class QuestNotCompletedError extends Error {
  constructor(message = "Les objectifs de la quête ne sont pas encore atteints.") {
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
 * Récupère l'état complet des quêtes actives et de la progression pour un joueur (T-US13-03).
 */
export async function getUserQuests(
  userId: string,
  date: Date = new Date(),
  client: any = prisma
): Promise<UserQuestsState> {
  const activeRotations = await getOrGenerateActiveRotations(date, client);
  const rotationIds = activeRotations.allRotations.map((r) => r.id);

  const existingProgress = await client.userQuestProgress.findMany({
    where: {
      userId,
      rotationId: { in: rotationIds },
    },
  });

  const progressByRotationId = new Map(existingProgress.map((p: any) => [p.rotationId, p]));

  const mapRotationToItem = (rotation: (typeof activeRotations.allRotations)[number]): UserQuestItem => {
    const progress: any = progressByRotationId.get(rotation.id);
    const targetCount = rotation.quest.targetCount;
    const currentCount = progress ? Math.min(progress.currentCount, targetCount) : 0;
    const isCompleted = progress ? progress.isCompleted || currentCount >= targetCount : false;
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
  payload: BattleCompletedPayload | TrainingCompletedPayload
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
 * Met à jour la progression des quêtes actives d'un joueur suite à un événement de combat (T-US13-03).
 */
export async function handleBattleCompletedForQuests(
  payload: BattleCompletedPayload | TrainingCompletedPayload,
  client: any = prisma
): Promise<number> {
  const userId = payload.userId;
  if (!userId) return 0;

  const activeRotations = await getOrGenerateActiveRotations(new Date(), client);
  let updatedCount = 0;

  for (const rotation of activeRotations.allRotations) {
    const increment = calculateQuestIncrement(rotation.quest.targetType, payload);
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
  client: any = prisma,
): Promise<number> {
  return client.$transaction(async (tx: any) => {
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
      },
    });
    const eventMatchesRecord =
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

    return handleBattleCompletedForQuests(payload, tx);
  });
}

/**
 * Réclame la récompense d'une quête terminée de manière transactionnelle et idempotente (T-US13-03).
 */
export async function claimQuestReward(
  userId: string,
  rotationId: string,
  client: any = prisma
): Promise<ClaimQuestRewardResult> {
  return await client.$transaction(async (tx: any) => {
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
