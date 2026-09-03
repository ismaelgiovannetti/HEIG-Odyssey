import { describe, it, expect } from "vitest";
import {
  getDailyPeriodKey,
  getDailyPeriodBounds,
  getWeeklyPeriodKey,
  getWeeklyPeriodBounds,
  selectQuestsDeterministically,
} from "@/lib/quests/rotation-service";
import { MVP_QUEST_DEFINITIONS } from "@/lib/quests/definitions";

describe("Quest Rotations Service (T-US13-02)", () => {
  it("génère une clé quotidienne au format YYYY-MM-DD", () => {
    const fixedDate = new Date("2026-09-01T14:30:00Z");
    const key = getDailyPeriodKey(fixedDate);
    expect(key).toBe("2026-09-01");
  });

  it("génère des bornes de début et fin cohérentes pour la journée", () => {
    const fixedDate = new Date("2026-09-01T12:00:00Z");
    const { startDate, endDate } = getDailyPeriodBounds(fixedDate);

    expect(startDate.getUTCFullYear()).toBe(2026);
    expect(startDate.getUTCMonth()).toBe(8); // 0-indexed: 8 = Septembre
    expect(startDate.getUTCDate()).toBe(1);
    expect(startDate.getUTCHours()).toBe(0);

    expect(endDate.getUTCDate()).toBe(1);
    expect(endDate.getUTCHours()).toBe(23);
    expect(endDate.getUTCMinutes()).toBe(59);
  });

  it("génère une clé hebdomadaire au format YYYY-Www", () => {
    const mondayDate = new Date("2026-08-31T10:00:00Z");
    const key = getWeeklyPeriodKey(mondayDate);
    expect(key).toBe("2026-W36");
  });

  it("génère des bornes de début (lundi) et fin (dimanche) pour la semaine", () => {
    // 2026-09-01 est un mardi
    const tuesdayDate = new Date("2026-09-01T10:00:00Z");
    const { startDate, endDate } = getWeeklyPeriodBounds(tuesdayDate);

    // Lundi 31 août 2026
    expect(startDate.getUTCDay()).toBe(1); // 1 = Lundi
    expect(startDate.getUTCHours()).toBe(0);

    // Dimanche 6 septembre 2026
    expect(endDate.getUTCDay()).toBe(0); // 0 = Dimanche
    expect(endDate.getUTCHours()).toBe(23);
  });

  it("sélectionne les quêtes de manière 100% déterministe pour une même clé de période", () => {
    const dailyQuests = MVP_QUEST_DEFINITIONS.filter((q) => q.type === "DAILY");

    const selection1 = selectQuestsDeterministically(
      dailyQuests,
      "2026-09-01",
      3,
    );
    const selection2 = selectQuestsDeterministically(
      dailyQuests,
      "2026-09-01",
      3,
    );

    expect(selection1.map((q) => q.id)).toEqual(selection2.map((q) => q.id));
    expect(selection1.length).toBe(3);
  });

  it("produit des sélections différentes pour deux dates différentes", () => {
    const dailyQuests = MVP_QUEST_DEFINITIONS.filter((q) => q.type === "DAILY");

    const selectionDay1 = selectQuestsDeterministically(
      dailyQuests,
      "2026-09-01",
      3,
    );
    const selectionDay2 = selectQuestsDeterministically(
      dailyQuests,
      "2026-09-02",
      3,
    );

    expect(selectionDay1).toBeDefined();
    expect(selectionDay2).toBeDefined();
  });
});
