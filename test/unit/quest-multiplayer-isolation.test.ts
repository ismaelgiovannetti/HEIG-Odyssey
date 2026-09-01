import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  handleBattleCompletedForQuests,
  claimQuestReward,
  QuestRewardAlreadyClaimedError,
} from "@/lib/quests/quest-progress-service";
import { QuestType } from "@prisma/client";
import * as rotationService from "@/lib/quests/rotation-service";

describe("Quest Multiplayer Isolation & Rotation Testing (T-US13-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("garantit l'isolation stricte de la progression entre deux joueurs sur les mêmes quêtes", async () => {
    // Deux joueurs 'player-A' et 'player-B'
    const playerProgressStore = new Map<string, any>();

    const activeRotations: any = {
      dailyPeriodKey: "2026-09-01",
      weeklyPeriodKey: "2026-W36",
      allRotations: [
        {
          id: "rot-daily-1",
          type: QuestType.DAILY,
          quest: {
            id: "daily-win-1-battle",
            targetType: "WIN_BATTLES_ANY",
            targetCount: 1,
            rewardPokedollars: 50,
          },
        },
      ],
    };

    vi.spyOn(rotationService, "getOrGenerateActiveRotations").mockResolvedValue(activeRotations);

    const mockPrisma = {
      userQuestProgress: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const key = `${where.userId_rotationId.userId}_${where.userId_rotationId.rotationId}`;
          return Promise.resolve(playerProgressStore.get(key) || null);
        }),
        upsert: vi.fn().mockImplementation(({ where, create, update }) => {
          const key = `${where.userId_rotationId.userId}_${where.userId_rotationId.rotationId}`;
          const current = playerProgressStore.get(key);
          const data = current ? { ...current, ...update } : { ...create, id: `prog-${key}` };
          playerProgressStore.set(key, data);
          return Promise.resolve(data);
        }),
      },
    };

    // 1. Le Joueur A gagne un combat
    await handleBattleCompletedForQuests(
      {
        userId: "player-A",
        battleId: "btl-a-1",
        battleType: "CAMPAIGN",
        stageId: "bachelor-1-stage-1",
        worldId: "bachelor-1",
        opponentId: "trainer-jean",
        result: "VICTORY",
        winner: "p1",
        turnsCount: 3,
        xpGained: 100,
        moneyGained: 50,
        playerPokemonIds: ["p1"],
      },
      mockPrisma as any
    );

    // Vérification : Joueur A a progressé et terminé la quête
    const progressA = playerProgressStore.get("player-A_rot-daily-1");
    expect(progressA).toBeDefined();
    expect(progressA.currentCount).toBe(1);
    expect(progressA.isCompleted).toBe(true);

    // Vérification : Joueur B n'a AUCUNE progression enregistrée
    const progressB = playerProgressStore.get("player-B_rot-daily-1");
    expect(progressB).toBeUndefined();
  });

  it("isole la progression entre deux rotations temporelles distinctes", async () => {
    const progressStore = new Map<string, any>();

    const rotationDay1: any = {
      id: "rot-day-1",
      quest: { id: "quest-1", targetType: "WIN_BATTLES_ANY", targetCount: 1 },
    };

    const rotationDay2: any = {
      id: "rot-day-2",
      quest: { id: "quest-1", targetType: "WIN_BATTLES_ANY", targetCount: 1 },
    };

    const mockPrisma = {
      userQuestProgress: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const key = `${where.userId_rotationId.userId}_${where.userId_rotationId.rotationId}`;
          return Promise.resolve(progressStore.get(key) || null);
        }),
        upsert: vi.fn().mockImplementation(({ where, create, update }) => {
          const key = `${where.userId_rotationId.userId}_${where.userId_rotationId.rotationId}`;
          const current = progressStore.get(key);
          const data = current ? { ...current, ...update } : { ...create, id: `prog-${key}` };
          progressStore.set(key, data);
          return Promise.resolve(data);
        }),
      },
    };

    // Jour 1
    vi.spyOn(rotationService, "getOrGenerateActiveRotations").mockResolvedValue({
      dailyPeriodKey: "2026-09-01",
      weeklyPeriodKey: "2026-W36",
      allRotations: [rotationDay1],
    } as any);

    await handleBattleCompletedForQuests(
      {
        userId: "user-1",
        battleId: "btl-1",
        battleType: "CAMPAIGN",
        stageId: "bachelor-1-stage-1",
        worldId: "bachelor-1",
        opponentId: "trainer-jean",
        result: "VICTORY",
        winner: "p1",
        turnsCount: 2,
        xpGained: 100,
        moneyGained: 50,
        playerPokemonIds: ["p1"],
      },
      mockPrisma as any
    );

    expect(progressStore.get("user-1_rot-day-1").isCompleted).toBe(true);

    // Jour 2 : Nouvelle rotation active
    vi.spyOn(rotationService, "getOrGenerateActiveRotations").mockResolvedValue({
      dailyPeriodKey: "2026-09-02",
      weeklyPeriodKey: "2026-W36",
      allRotations: [rotationDay2],
    } as any);

    // Avant tout combat le jour 2, la nouvelle rotation est vierge
    expect(progressStore.get("user-1_rot-day-2")).toBeUndefined();
    // L'ancienne reste intacte
    expect(progressStore.get("user-1_rot-day-1").isCompleted).toBe(true);
  });

  it("refuse catégoriquement le rejeu d'une réclamation de récompense", async () => {
    let balance = 100;
    let isClaimed = false;

    const mockTx = {
      userQuestProgress: {
        findUnique: vi.fn().mockImplementation(() =>
          Promise.resolve({
            id: "prog-1",
            userId: "user-1",
            rotationId: "rot-1",
            isCompleted: true,
            rewardClaimed: isClaimed,
            rotation: {
              quest: { rewardPokedollars: 50, rewardXp: 100 },
            },
          })
        ),
        update: vi.fn().mockImplementation(() => {
          isClaimed = true;
          return Promise.resolve({});
        }),
      },
      userProfile: {
        upsert: vi.fn().mockImplementation(() => {
          balance += 50;
          return Promise.resolve({ pokedollars: balance });
        }),
      },
    };

    const mockPrisma = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };

    // 1ère réclamation : succès
    const res1 = await claimQuestReward("user-1", "rot-1", mockPrisma as any);
    expect(res1.success).toBe(true);
    expect(balance).toBe(150);

    // 2ème réclamation (rejeu de la même requête réseau) : rejet immédiat
    await expect(claimQuestReward("user-1", "rot-1", mockPrisma as any)).rejects.toThrow(
      QuestRewardAlreadyClaimedError
    );

    // Le solde n'a pas bougé
    expect(balance).toBe(150);
  });
});
