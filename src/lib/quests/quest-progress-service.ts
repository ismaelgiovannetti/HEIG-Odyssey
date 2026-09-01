import { prisma } from "../prisma";
import { getOrGenerateActiveRotations } from "./rotation-service";
import type { BattleCompletedPayload, TrainingCompletedPayload } from "../events/contracts";
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

    const existing = await client.userQuestProgress.findUnique({
      where: {
        userId_rotationId: {
          userId,
          rotationId: rotation.id,
        },
      },
    });

    const previousCount = existing?.currentCount ?? 0;
    const targetCount = rotation.quest.targetCount;
    const newCount = previousCount + increment;
    const isCompleted = newCount >= targetCount || (existing?.isCompleted ?? false);

    await client.userQuestProgress.upsert({
      where: {
        userId_rotationId: {
          userId,
          rotationId: rotation.id,
        },
      },
      create: {
        userId,
        rotationId: rotation.id,
        currentCount: newCount,
        isCompleted: newCount >= targetCount,
      },
      update: {
        currentCount: newCount,
        isCompleted,
      },
    });

    updatedCount++;
  }

  return updatedCount;
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

    // 2. Mise à jour atomique : marquer comme réclamé
    await tx.userQuestProgress.update({
      where: { id: progress.id },
      data: {
        rewardClaimed: true,
        claimedAt: new Date(),
      },
    });

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
