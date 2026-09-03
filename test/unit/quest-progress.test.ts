import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateQuestIncrement,
  claimQuestReward,
  handleBattleCompletedEventForQuests,
  isQuestProgressPendingForBattle,
  QuestNotFoundError,
  QuestNotCompletedError,
  QuestRewardAlreadyClaimedError,
} from "@/lib/quests/quest-progress-service";
import type {
  BattleCompletedPayload,
  TrainingCompletedPayload,
} from "@/lib/events/contracts";
import { asPrismaClient } from "../helpers/mock-clients";

function campaignBattlePayload(
  overrides: Partial<BattleCompletedPayload> = {},
): BattleCompletedPayload {
  return {
    userId: "user-1",
    battleId: "battle-1",
    battleType: "CAMPAIGN",
    stageId: "bachelor-1-stage-1",
    worldId: "bachelor-1",
    opponentId: "trainer-jean",
    result: "VICTORY",
    winner: "p1",
    turnsCount: 4,
    xpGained: 100,
    moneyGained: 50,
    playerPokemonIds: ["pokemon-1"],
    ...overrides,
  };
}

function trainingBattlePayload(
  overrides: Partial<TrainingCompletedPayload> = {},
): TrainingCompletedPayload {
  return {
    userId: "user-1",
    battleId: "training-1",
    battleType: "TRAINING",
    opponentId: "training-normal",
    result: "VICTORY",
    winner: "p1",
    turnsCount: 4,
    xpGained: 100,
    moneyGained: 50,
    playerPokemonIds: ["pokemon-1"],
    ...overrides,
  };
}

describe("Quest Progress & Claim Service (T-US13-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateQuestIncrement", () => {
    it("incrémente WIN_BATTLES_ANY uniquement en cas de victoire p1", () => {
      const victoryPayload = campaignBattlePayload();
      const defeatPayload = campaignBattlePayload({
        result: "DEFEAT",
        winner: "p2",
      });

      expect(calculateQuestIncrement("WIN_BATTLES_ANY", victoryPayload)).toBe(
        1,
      );
      expect(calculateQuestIncrement("WIN_BATTLES_ANY", defeatPayload)).toBe(0);
    });

    it("incrémente WIN_BATTLES_CAMPAIGN uniquement en cas de victoire en campagne", () => {
      const campaignWin = campaignBattlePayload({ turnsCount: 3 });
      const trainingWin = trainingBattlePayload({ turnsCount: 3 });

      expect(calculateQuestIncrement("WIN_BATTLES_CAMPAIGN", campaignWin)).toBe(
        1,
      );
      expect(calculateQuestIncrement("WIN_BATTLES_CAMPAIGN", trainingWin)).toBe(
        0,
      );
    });

    it("incrémente COMPLETE_TURNS selon le nombre de tours disputés", () => {
      const payload = campaignBattlePayload({
        result: "DEFEAT",
        winner: "p2",
        turnsCount: 8,
      });
      expect(calculateQuestIncrement("COMPLETE_TURNS", payload)).toBe(8);
    });
  });

  describe("battle quest synchronization", () => {
    it("reste en attente tant que le reçu du combat du joueur n'existe pas", async () => {
      const mockPrisma = {
        battleRecord: {
          findFirst: vi.fn().mockResolvedValue({ id: "record-1" }),
        },
        processedDomainEvent: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      await expect(
        isQuestProgressPendingForBattle(
          "user-1",
          "battle-1",
          asPrismaClient(mockPrisma),
        ),
      ).resolves.toBe(true);
      expect(mockPrisma.battleRecord.findFirst).toHaveBeenCalledWith({
        where: { idempotencyKey: "battle-1", userId: "user-1" },
        select: { id: true },
      });
    });

    it("ne consulte aucun reçu pour un combat inconnu ou d'un autre joueur", async () => {
      const mockPrisma = {
        battleRecord: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        processedDomainEvent: {
          findUnique: vi.fn(),
        },
      };

      await expect(
        isQuestProgressPendingForBattle(
          "user-1",
          "battle-of-user-2",
          asPrismaClient(mockPrisma),
        ),
      ).resolves.toBe(false);
      expect(mockPrisma.processedDomainEvent.findUnique).not.toHaveBeenCalled();
    });

    it("confirme la synchronisation lorsque le reçu transactionnel existe", async () => {
      const mockPrisma = {
        battleRecord: {
          findFirst: vi.fn().mockResolvedValue({ id: "record-1" }),
        },
        processedDomainEvent: {
          findUnique: vi.fn().mockResolvedValue({ id: "receipt-1" }),
        },
      };

      await expect(
        isQuestProgressPendingForBattle(
          "user-1",
          "battle-1",
          asPrismaClient(mockPrisma),
        ),
      ).resolves.toBe(false);
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
        claimQuestReward(
          "user-1",
          "rot-inexistante",
          asPrismaClient(mockPrisma),
        ),
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
        claimQuestReward("user-1", "rot-1", asPrismaClient(mockPrisma)),
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
        claimQuestReward("user-1", "rot-1", asPrismaClient(mockPrisma)),
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

      const result = await claimQuestReward(
        "user-1",
        "rot-1",
        asPrismaClient(mockPrisma),
      );

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
        claimQuestReward("user-1", "rot-1", asPrismaClient(mockPrisma)),
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
        asPrismaClient(mockPrisma),
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
          asPrismaClient(mockPrisma),
        ),
      ).rejects.toThrow("QUEST_EVENT_BATTLE_MISMATCH");
      expect(mockTx.userQuestProgress.upsert).not.toHaveBeenCalled();
    });

    it("attribue un événement rattrapé à la rotation de fin du combat", async () => {
      const completedAt = new Date("2026-08-20T18:30:00.000Z");
      const mockTx = {
        processedDomainEvent: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        battleRecord: {
          findUnique: vi.fn().mockResolvedValue({
            userId: "user-1",
            battleType: "TRAINING",
            opponentId: "training-easy",
            result: "VICTORY",
            turnsCount: 2,
            xpGained: 10,
            moneyGained: 5,
            completedAt,
          }),
        },
        questRotation: {
          findMany: vi.fn().mockImplementation(({ where }) =>
            Promise.resolve([
              {
                id: `rotation-${where.type}`,
                type: where.type,
                quest: { targetType: "NOOP", targetCount: 1 },
              },
            ]),
          ),
        },
        userQuestProgress: {
          upsert: vi.fn(),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      await handleBattleCompletedEventForQuests(
        "evt-historical",
        {
          userId: "user-1",
          battleId: "battle-historical",
          battleType: "TRAINING",
          opponentId: "training-easy",
          result: "VICTORY",
          winner: "p1",
          turnsCount: 2,
          xpGained: 10,
          moneyGained: 5,
          playerPokemonIds: ["pokemon-1"],
        },
        asPrismaClient(mockPrisma),
      );

      expect(mockTx.questRotation.findMany).toHaveBeenCalledWith({
        where: { periodKey: "2026-08-20", type: "DAILY" },
        include: { quest: true },
      });
      expect(mockTx.userQuestProgress.upsert).not.toHaveBeenCalled();
    });
  });
});
