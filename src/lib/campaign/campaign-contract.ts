import type { CampaignDegreeEnum } from "@/lib/content/schemas";
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

export interface StageAccessCheckResult {
  allowed: boolean;
  reason?: string;
  stage?: import("@/lib/content/schemas").CampaignStage;
  trainerId?: string;
  worldId?: string;
}
