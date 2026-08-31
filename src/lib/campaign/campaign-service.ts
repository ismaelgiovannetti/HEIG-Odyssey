import { prisma } from "@/lib/prisma";
import { loadCampaign, loadTrainers } from "@/lib/content/loader";
import type { CampaignDegreeEnum, CampaignStage, CampaignWorld } from "@/lib/content/schemas";
import type { z } from "zod";

export type CampaignDegree = z.infer<typeof CampaignDegreeEnum>;

export type StageProgressStatus = "COMPLETED" | "ACCESSIBLE" | "LOCKED";
export type WorldProgressStatus = "COMPLETED" | "ACCESSIBLE" | "LOCKED";

export interface CampaignStageView {
  id: string;
  stageNumber: number;
  name: string;
  description: string;
  recommendedLevel: number;
  trainerId: string;
  trainerName: string;
  trainerTitle: string;
  trainerSprite: string;
  prerequisiteStageId: string | null;
  rewardMoney: number;
  rewardXp: number;
  status: StageProgressStatus;
  isCompleted: boolean;
  isAccessible: boolean;
  isLocked: boolean;
  firstClearedAt: Date | null;
}

export interface CampaignWorldView {
  id: string;
  name: string;
  degree: CampaignDegree;
  description: string;
  stages: CampaignStageView[];
  status: WorldProgressStatus;
  completedStagesCount: number;
  totalStagesCount: number;
  isCompleted: boolean;
  isAccessible: boolean;
  isLocked: boolean;
}

export interface CampaignProgressOverview {
  worlds: CampaignWorldView[];
  currentWorldId: string;
  totalCompletedStages: number;
  totalStages: number;
  nextRecommendedStage: CampaignStageView | null;
}

/**
 * Charge l'ensemble des mondes et étapes de la campagne en calculant le statut
 * (COMPLETED, ACCESSIBLE, LOCKED) pour le joueur donné selon ses enregistrements persistants.
 */
export async function getCampaignProgressForUser(
  userId: string,
): Promise<CampaignProgressOverview> {
  const worlds = loadCampaign();
  const trainers = loadTrainers();

  const userProgressList = await prisma.campaignProgress.findMany({
    where: { userId },
  });

  // Ces deux index évitent de relire la réponse Prisma pour chaque étape du
  // contenu, tout en distinguant une progression créée d'une victoire acquise.
  const progressByStageId = new Map(
    userProgressList.map((p) => [p.stageId, p]),
  );

  const completedStageIds = new Set(
    userProgressList.filter((p) => p.isCompleted).map((p) => p.stageId),
  );

  let totalCompletedStages = 0;
  let totalStages = 0;
  let nextRecommendedStage: CampaignStageView | null = null;

  const worldViews: CampaignWorldView[] = worlds.map((world) => {
    let completedStagesCount = 0;

    const stagesView: CampaignStageView[] = world.stages.map((stage) => {
      totalStages += 1;
      const progress = progressByStageId.get(stage.id);
      const isCompleted = completedStageIds.has(stage.id);

      let status: StageProgressStatus = "LOCKED";

      if (isCompleted) {
        status = "COMPLETED";
        completedStagesCount += 1;
        totalCompletedStages += 1;
      } else if (
        stage.prerequisiteStageId === null ||
        completedStageIds.has(stage.prerequisiteStageId)
      ) {
        status = "ACCESSIBLE";
      } else {
        status = "LOCKED";
      }

      const trainer = trainers.get(stage.trainerId);

      const stageView: CampaignStageView = {
        id: stage.id,
        stageNumber: stage.stageNumber,
        name: stage.name,
        description: stage.description,
        recommendedLevel: stage.recommendedLevel,
        trainerId: stage.trainerId,
        trainerName: trainer?.name ?? "Dresseur mystère",
        trainerTitle: trainer?.title ?? "Challenger",
        trainerSprite: trainer?.sprite ?? "/sprites/trainer-player-back.png",
        prerequisiteStageId: stage.prerequisiteStageId,
        rewardMoney: stage.rewardMoney,
        rewardXp: stage.rewardXp,
        status,
        isCompleted,
        isAccessible: status !== "LOCKED",
        isLocked: status === "LOCKED",
        firstClearedAt: progress?.firstClearedAt ?? null,
      };

      if (!nextRecommendedStage && status === "ACCESSIBLE") {
        nextRecommendedStage = stageView;
      }

      return stageView;
    });

    const isCompleted = completedStagesCount === world.stages.length;
    const isAccessible = stagesView.some(
      (s) => s.status === "ACCESSIBLE" || s.status === "COMPLETED",
    );

    let worldStatus: WorldProgressStatus = "LOCKED";
    if (isCompleted) {
      worldStatus = "COMPLETED";
    } else if (isAccessible) {
      worldStatus = "ACCESSIBLE";
    }

    return {
      id: world.id,
      name: world.name,
      degree: world.degree,
      description: world.description,
      stages: stagesView,
      status: worldStatus,
      completedStagesCount,
      totalStagesCount: world.stages.length,
      isCompleted,
      isAccessible,
      isLocked: worldStatus === "LOCKED",
    };
  });

  // La reprise privilégie le premier monde encore jouable ; le premier monde
  // sert uniquement de repli lorsque la campagne est entièrement terminée.
  const currentWorld =
    worldViews.find((w) => w.status === "ACCESSIBLE" && !w.isCompleted) ??
    worldViews.find((w) => w.status === "ACCESSIBLE") ??
    worldViews[0];

  return {
    worlds: worldViews,
    currentWorldId: currentWorld?.id ?? "bachelor-1",
    totalCompletedStages,
    totalStages,
    nextRecommendedStage,
  };
}

export interface StageAccessCheckResult {
  allowed: boolean;
  reason?: string;
  stage?: CampaignStage;
  trainerId?: string;
  worldId?: string;
}

/**
 * Valide côté serveur si un joueur authentifié possède le droit de lancer une étape donnée.
 * Règle stricte :
 * - Si prerequisiteStageId === null : accessible immédiatement (dès onboarding validé).
 * - Si prerequisiteStageId !== null : accessible UNIQUEMENT si le prérequis est marqué isCompleted: true dans CampaignProgress.
 * - Le niveau recommandé est INFORMATIF et n'intervient JAMAIS dans cette décision.
 */
export async function canUserAccessStage(
  userId: string,
  stageId: string,
): Promise<StageAccessCheckResult> {
  const worlds = loadCampaign();

  let targetStage: CampaignStage | undefined;
  let targetWorld: CampaignWorld | undefined;

  for (const world of worlds) {
    const found = world.stages.find((s) => s.id === stageId);
    if (found) {
      targetStage = found;
      targetWorld = world;
      break;
    }
  }

  if (!targetStage || !targetWorld) {
    return {
      allowed: false,
      reason: "Étape de campagne introuvable dans la configuration.",
    };
  }

  // Une racine de campagne ne dépend d'aucune ligne de progression existante.
  if (targetStage.prerequisiteStageId === null) {
    return {
      allowed: true,
      stage: targetStage,
      trainerId: targetStage.trainerId,
      worldId: targetWorld.id,
    };
  }

  // L'autorisation est recalculée depuis la base et ne fait jamais confiance
  // au statut affiché précédemment dans le navigateur.
  const prereqProgress = await prisma.campaignProgress.findUnique({
    where: {
      userId_stageId: {
        userId,
        stageId: targetStage.prerequisiteStageId,
      },
    },
  });

  if (!prereqProgress || !prereqProgress.isCompleted) {
    return {
      allowed: false,
      reason:
        "Cette étape est verrouillée. Vous devez d'abord remporter le combat précédent pour y accéder.",
    };
  }

  return {
    allowed: true,
    stage: targetStage,
    trainerId: targetStage.trainerId,
    worldId: targetWorld.id,
  };
}
