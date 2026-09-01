import { prisma } from "../prisma";
import { QuestType, type QuestDefinition, type QuestRotation } from "@prisma/client";
import { MVP_QUEST_DEFINITIONS } from "./definitions";

export const QUEST_TIMEZONE = "Europe/Zurich";

/**
 * Renvoie la clé de période quotidienne déterministe (format YYYY-MM-DD).
 */
export function getDailyPeriodKey(date: Date = new Date()): string {
  // Formatage dans le fuseau horaire de référence
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: QUEST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Renvoie les bornes de début et fin pour la rotation quotidienne.
 */
export function getDailyPeriodBounds(date: Date = new Date()): { startDate: Date; endDate: Date } {
  const periodKey = getDailyPeriodKey(date);
  const [year, month, day] = periodKey.split("-").map((v) => parseInt(v, 10));

  const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  return { startDate, endDate };
}

/**
 * Calcule le numéro de semaine ISO-8601 et renvoie la clé hebdomadaire (format YYYY-Www).
 */
export function getWeeklyPeriodKey(date: Date = new Date()): string {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getUTCDay() + 6) % 7; // Lundi = 0, Dimanche = 6
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getUTCFullYear();
  const weekFormatted = weekNumber < 10 ? `0${weekNumber}` : `${weekNumber}`;
  return `${year}-W${weekFormatted}`;
}

/**
 * Renvoie les bornes de début (lundi 00:00) et de fin (dimanche 23:59) pour la semaine.
 */
export function getWeeklyPeriodBounds(date: Date = new Date()): { startDate: Date; endDate: Date } {
  const dayOfWeek = (date.getUTCDay() + 6) % 7; // 0 = lundi
  const startDate = new Date(date.valueOf());
  startDate.setUTCDate(startDate.getUTCDate() - dayOfWeek);
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(startDate.valueOf());
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  endDate.setUTCHours(23, 59, 59, 999);

  return { startDate, endDate };
}

/**
 * Génère un hash entier déterministe à partir d'une chaîne.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Sélectionne déterministement N quêtes parmi les définitions disponibles pour une clé donnée.
 */
export function selectQuestsDeterministically<T extends { id: string }>(
  items: T[],
  periodKey: string,
  count: number
): T[] {
  if (items.length <= count) return [...items];

  // Tri stable initial
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const baseSeed = hashString(periodKey);

  // Algorithme de mélange déterministe (Fisher-Yates basé sur seed)
  const pool = [...sorted];
  const selected: T[] = [];

  for (let i = 0; i < count; i++) {
    const index = (baseSeed + i * 31) % pool.length;
    selected.push(pool.splice(index, 1)[0]);
  }

  return selected;
}

export type ActiveRotationsResult = {
  dailyPeriodKey: string;
  weeklyPeriodKey: string;
  dailyRotations: Array<QuestRotation & { quest: QuestDefinition }>;
  weeklyRotations: Array<QuestRotation & { quest: QuestDefinition }>;
  allRotations: Array<QuestRotation & { quest: QuestDefinition }>;
};

/**
 * Récupère ou génère les rotations actives pour la date donnée (T-US13-02).
 */
export async function getOrGenerateActiveRotations(
  date: Date = new Date(),
  client: any = prisma
): Promise<ActiveRotationsResult> {
  const dailyPeriodKey = getDailyPeriodKey(date);
  const weeklyPeriodKey = getWeeklyPeriodKey(date);

  const dailyBounds = getDailyPeriodBounds(date);
  const weeklyBounds = getWeeklyPeriodBounds(date);

  // 1. Récupération des rotations quotidiennes existantes
  let dailyRotations = await client.questRotation.findMany({
    where: { periodKey: dailyPeriodKey, type: QuestType.DAILY },
    include: { quest: true },
  });

  if (dailyRotations.length === 0) {
    // Récupérer les définitions quotidiennes disponibles
    let dailyDefinitions = await client.questDefinition.findMany({
      where: { type: QuestType.DAILY },
    });

    if (dailyDefinitions.length === 0) {
      // Si la base n'a pas encore été seedée, initialiser depuis le catalogue
      for (const def of MVP_QUEST_DEFINITIONS.filter((q) => q.type === QuestType.DAILY)) {
        await client.questDefinition.upsert({
          where: { id: def.id },
          update: {},
          create: def,
        });
      }
      dailyDefinitions = await client.questDefinition.findMany({
        where: { type: QuestType.DAILY },
      });
    }

    const selectedDaily = selectQuestsDeterministically(dailyDefinitions, dailyPeriodKey, 3);

    for (const def of selectedDaily) {
      await client.questRotation.upsert({
        where: {
          periodKey_questId: {
            periodKey: dailyPeriodKey,
            questId: def.id,
          },
        },
        update: {},
        create: {
          periodKey: dailyPeriodKey,
          type: QuestType.DAILY,
          questId: def.id,
          startDate: dailyBounds.startDate,
          endDate: dailyBounds.endDate,
        },
      });
    }

    dailyRotations = await client.questRotation.findMany({
      where: { periodKey: dailyPeriodKey, type: QuestType.DAILY },
      include: { quest: true },
    });
  }

  // 2. Récupération des rotations hebdomadaires existantes
  let weeklyRotations = await client.questRotation.findMany({
    where: { periodKey: weeklyPeriodKey, type: QuestType.WEEKLY },
    include: { quest: true },
  });

  if (weeklyRotations.length === 0) {
    let weeklyDefinitions = await client.questDefinition.findMany({
      where: { type: QuestType.WEEKLY },
    });

    if (weeklyDefinitions.length === 0) {
      for (const def of MVP_QUEST_DEFINITIONS.filter((q) => q.type === QuestType.WEEKLY)) {
        await client.questDefinition.upsert({
          where: { id: def.id },
          update: {},
          create: def,
        });
      }
      weeklyDefinitions = await client.questDefinition.findMany({
        where: { type: QuestType.WEEKLY },
      });
    }

    const selectedWeekly = selectQuestsDeterministically(weeklyDefinitions, weeklyPeriodKey, 2);

    for (const def of selectedWeekly) {
      await client.questRotation.upsert({
        where: {
          periodKey_questId: {
            periodKey: weeklyPeriodKey,
            questId: def.id,
          },
        },
        update: {},
        create: {
          periodKey: weeklyPeriodKey,
          type: QuestType.WEEKLY,
          questId: def.id,
          startDate: weeklyBounds.startDate,
          endDate: weeklyBounds.endDate,
        },
      });
    }

    weeklyRotations = await client.questRotation.findMany({
      where: { periodKey: weeklyPeriodKey, type: QuestType.WEEKLY },
      include: { quest: true },
    });
  }

  return {
    dailyPeriodKey,
    weeklyPeriodKey,
    dailyRotations,
    weeklyRotations,
    allRotations: [...dailyRotations, ...weeklyRotations],
  };
}
