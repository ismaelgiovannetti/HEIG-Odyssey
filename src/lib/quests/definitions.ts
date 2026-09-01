import { QuestType } from "@prisma/client";

export interface QuestSeedDefinition {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  targetType: string;
  targetCount: number;
  rewardPokedollars: number;
  rewardXp: number;
}

/**
 * Catalogue des définitions de quêtes du MVP (T-US13-06).
 */
export const MVP_QUEST_DEFINITIONS: QuestSeedDefinition[] = [
  // ----------------------------------------------------
  // Quêtes Quotidiennes (DAILY)
  // ----------------------------------------------------
  {
    id: "daily-win-1-battle",
    title: "Première Victoire",
    description: "Remportez 1 combat (campagne ou entraînement).",
    type: QuestType.DAILY,
    targetType: "WIN_BATTLES_ANY",
    targetCount: 1,
    rewardPokedollars: 50,
    rewardXp: 100,
  },
  {
    id: "daily-win-3-battles",
    title: "Triomphe Quotidien",
    description: "Remportez 3 combats au total.",
    type: QuestType.DAILY,
    targetType: "WIN_BATTLES_ANY",
    targetCount: 3,
    rewardPokedollars: 100,
    rewardXp: 250,
  },
  {
    id: "daily-win-campaign",
    title: "Conquête de Monde",
    description: "Remportez 1 combat dans le mode campagne.",
    type: QuestType.DAILY,
    targetType: "WIN_BATTLES_CAMPAIGN",
    targetCount: 1,
    rewardPokedollars: 75,
    rewardXp: 150,
  },
  {
    id: "daily-win-training",
    title: "Séance Tactique",
    description: "Remportez 1 combat d'entraînement.",
    type: QuestType.DAILY,
    targetType: "WIN_BATTLES_TRAINING",
    targetCount: 1,
    rewardPokedollars: 75,
    rewardXp: 150,
  },
  {
    id: "daily-complete-10-turns",
    title: "Endurance Journalière",
    description: "Disputez au moins 10 tours de combat.",
    type: QuestType.DAILY,
    targetType: "COMPLETE_TURNS",
    targetCount: 10,
    rewardPokedollars: 50,
    rewardXp: 100,
  },

  // ----------------------------------------------------
  // Quêtes Hebdomadaires (WEEKLY)
  // ----------------------------------------------------
  {
    id: "weekly-win-10-battles",
    title: "Champion de la Semaine",
    description: "Remportez 10 combats au total.",
    type: QuestType.WEEKLY,
    targetType: "WIN_BATTLES_ANY",
    targetCount: 10,
    rewardPokedollars: 300,
    rewardXp: 800,
  },
  {
    id: "weekly-win-5-campaign",
    title: "Pionnier de la Campagne",
    description: "Remportez 5 combats en mode campagne.",
    type: QuestType.WEEKLY,
    targetType: "WIN_BATTLES_CAMPAIGN",
    targetCount: 5,
    rewardPokedollars: 250,
    rewardXp: 600,
  },
  {
    id: "weekly-win-5-training",
    title: "Perfectionnement Stratégique",
    description: "Remportez 5 combats en mode entraînement.",
    type: QuestType.WEEKLY,
    targetType: "WIN_BATTLES_TRAINING",
    targetCount: 5,
    rewardPokedollars: 250,
    rewardXp: 600,
  },
  {
    id: "weekly-complete-50-turns",
    title: "Marathon Tactique",
    description: "Disputez au moins 50 tours de combat sur la semaine.",
    type: QuestType.WEEKLY,
    targetType: "COMPLETE_TURNS",
    targetCount: 50,
    rewardPokedollars: 200,
    rewardXp: 500,
  },
];
