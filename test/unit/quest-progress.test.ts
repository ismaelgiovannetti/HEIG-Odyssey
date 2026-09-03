import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateQuestIncrement,
  claimQuestReward,
  handleBattleCompletedEventForQuests,
  getUserQuests,
  QuestNotFoundError,
  QuestNotCompletedError,
  QuestRewardAlreadyClaimedError,
} from "@/lib/quests/quest-progress-service";

describe("Quest Progress & Claim Service (T-US13-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateQuestIncrement", () => {
    it("incrémente WIN_BATTLES_ANY uniquement en cas de victoire p1", () => {
      const victoryPayload: any = { winner: "p1", turnsCount: 4, battleType: "CAMPAIGN" };
      const defeatPayload: any = { winner: "p2", turnsCount: 4, battleType: "CAMPAIGN" };

      expect(calculateQuestIncrement("WIN_BATTLES_ANY", victoryPayload)).toBe(1);
      expect(calculateQuestIncrement("WIN_BATTLES_ANY", defeatPayload)).toBe(0);
    });

    it("incrémente WIN_BATTLES_CAMPAIGN uniquement en cas de victoire en campagne", () => {
      const campaignWin: any = { winner: "p1", turnsCount: 3, battleType: "CAMPAIGN" };
      const trainingWin: any = { winner: "p1", turnsCount: 3, battleType: "TRAINING" };

      expect(calculateQuestIncrement("WIN_BATTLES_CAMPAIGN", campaignWin)).toBe(1);
      expect(calculateQuestIncrement("WIN_BATTLES_CAMPAIGN", trainingWin)).toBe(0);
    });

    it("incrémente COMPLETE_TURNS selon le nombre de tours disputés", () => {
      const payload: any = { winner: "p2", turnsCount: 8, battleType: "CAMPAIGN" };
      expect(calculateQuestIncrement("COMPLETE_TURNS", payload)).toBe(8);
    });
  });

  describe("claimQuestReward", () => {
    it("échoue avec QuestNotFoundError si la quête n'existe pas", async () => {
      const mockTx = {
        userQuestProgress: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      await expect(
        claimQuestReward("user-1", "rot-inexistante", mockPrisma as any)
      ).rejects.toThrow(QuestNotFoundError);
    });

    it("échoue avec QuestNotCompletedError si la quête n'est pas encore terminée", async () => {
      const mockTx = {
        userQuestProgress: {
          findUnique: vi.fn().mockResolvedValue({
            id: "prog-1",
            isCompleted: false,
            rewardClaimed: false,
            rotation: {
              quest: { rewardPokedollars: 50, rewardXp: 100 },
            },
          }),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      await expect(
        claimQuestReward("user-1", "rot-1", mockPrisma as any)
      ).rejects.toThrow(QuestNotCompletedError);
    });

    it("échoue avec QuestRewardAlreadyClaimedError si la quête a déjà été réclamée", async () => {
      const mockTx = {
        userQuestProgress: {
          findUnique: vi.fn().mockResolvedValue({
            id: "prog-1",
            isCompleted: true,
            rewardClaimed: true,
            rotation: {
              quest: { rewardPokedollars: 50, rewardXp: 100 },
            },
          }),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      await expect(
        claimQuestReward("user-1", "rot-1", mockPrisma as any)
      ).rejects.toThrow(QuestRewardAlreadyClaimedError);
    });

    it("crédite le solde et marque la quête comme réclamée lors d'un succès", async () => {
      const mockTx = {
        userQuestProgress: {
          findUnique: vi.fn().mockResolvedValue({
            id: "prog-1",
            isCompleted: true,
            rewardClaimed: false,
            rotation: {
              quest: { rewardPokedollars: 150, rewardXp: 300 },
            },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        userProfile: {
          upsert: vi.fn().mockResolvedValue({ pokedollars: 450 }),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      const result = await claimQuestReward("user-1", "rot-1", mockPrisma as any);

      expect(result.success).toBe(true);
      expect(result.rewardPokedollars).toBe(150);
      expect(result.newBalance).toBe(450);

      expect(mockTx.userQuestProgress.updateMany).toHaveBeenCalledWith({
        where: {
          id: "prog-1",
          userId: "user-1",
          isCompleted: true,
          rewardClaimed: false,
        },
        data: {
          rewardClaimed: true,
          claimedAt: expect.any(Date),
        },
      });

      expect(mockTx.userProfile.upsert).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        create: {
          userId: "user-1",
          pokedollars: 150,
          hasCompletedOnboarding: true,
        },
        update: {
          pokedollars: { increment: 150 },
        },
      });
    });

    it("ne crédite rien si une requête concurrente a déjà réclamé la récompense", async () => {
      const mockTx = {
        userQuestProgress: {
          findUnique: vi.fn().mockResolvedValue({
            id: "prog-1",
            isCompleted: true,
            rewardClaimed: false,
            rotation: {
              quest: { rewardPokedollars: 150, rewardXp: 300 },
            },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        userProfile: {
          upsert: vi.fn(),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      await expect(
        claimQuestReward("user-1", "rot-1", mockPrisma as any),
      ).rejects.toThrow(QuestRewardAlreadyClaimedError);
      expect(mockTx.userProfile.upsert).not.toHaveBeenCalled();
    });
  });

  describe("event idempotency", () => {
    it("ignore un événement dont le reçu existe déjà", async () => {
      const mockTx = {
        processedDomainEvent: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        userQuestProgress: {
          upsert: vi.fn(),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      const result = await handleBattleCompletedEventForQuests(
        "evt-already-processed",
        {
          userId: "user-1",
          battleId: "battle-1",
          battleType: "TRAINING",
          opponentId: "training-easy",
          result: "VICTORY",
          winner: "p1",
          turnsCount: 2,
          xpGained: 10,
          moneyGained: 5,
          playerPokemonIds: ["pokemon-1"],
        },
        mockPrisma as any,
      );

      expect(result).toBe(0);
      expect(mockTx.userQuestProgress.upsert).not.toHaveBeenCalled();
    });

    it("refuse un événement qui ne correspond à aucun combat enregistré", async () => {
      const mockTx = {
        processedDomainEvent: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        battleRecord: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        userQuestProgress: {
          upsert: vi.fn(),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      await expect(
        handleBattleCompletedEventForQuests(
          "evt-forged",
          {
            userId: "victim",
            battleId: "battle-forged",
            battleType: "TRAINING",
            opponentId: "training-easy",
            result: "VICTORY",
            winner: "p1",
            turnsCount: 2,
            xpGained: 10,
            moneyGained: 5,
            playerPokemonIds: ["pokemon-1"],
          },
          mockPrisma as any,
        ),
      ).rejects.toThrow("QUEST_EVENT_BATTLE_MISMATCH");
      expect(mockTx.userQuestProgress.upsert).not.toHaveBeenCalled();
    });
  });
});
