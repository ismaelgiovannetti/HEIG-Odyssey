import { z } from "zod";

export const QuestTypeSchema = z.enum(["DAILY", "WEEKLY"]);

export const QuestItemSchema = z.object({
  rotationId: z.string().min(1),
  questId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  type: QuestTypeSchema,
  targetType: z.string().min(1),
  targetCount: z.number().int().positive(),
  currentCount: z.number().int().nonnegative(),
  isCompleted: z.boolean(),
  rewardClaimed: z.boolean(),
  claimedAt: z.string().datetime().nullable(),
  rewardPokedollars: z.number().int().nonnegative(),
  rewardXp: z.number().int().nonnegative(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const UserQuestsStateSchema = z.object({
  dailyPeriodKey: z.string().min(1),
  weeklyPeriodKey: z.string().min(1),
  dailyQuests: z.array(QuestItemSchema),
  weeklyQuests: z.array(QuestItemSchema),
  allQuests: z.array(QuestItemSchema),
});

export const QuestListSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: UserQuestsStateSchema,
  syncPending: z.boolean(),
});

export const ClaimQuestBodySchema = z
  .object({ rotationId: z.string().trim().min(1).max(128) })
  .strict();

export const ClaimQuestRewardResultSchema = z.object({
  success: z.literal(true),
  rotationId: z.string().min(1),
  rewardPokedollars: z.number().int().nonnegative(),
  rewardXp: z.number().int().nonnegative(),
  newBalance: z.number().int().nonnegative(),
});

export const ClaimQuestSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: ClaimQuestRewardResultSchema,
});

export const QuestFailureResponseSchema = z.object({
  success: z.literal(false),
  error: z.string().min(1).optional(),
});

export type QuestItem = z.infer<typeof QuestItemSchema>;
export type UserQuestsState = z.infer<typeof UserQuestsStateSchema>;
export type QuestGroups = Pick<UserQuestsState, "dailyQuests" | "weeklyQuests">;
export type ClaimQuestRewardResult = z.infer<
  typeof ClaimQuestRewardResultSchema
>;

export function readApiError(value: unknown): string | undefined {
  const parsed = QuestFailureResponseSchema.safeParse(value);
  return parsed.success ? parsed.data.error : undefined;
}
