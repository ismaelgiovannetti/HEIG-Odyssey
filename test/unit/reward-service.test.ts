import { describe, it, expect, vi, beforeEach } from "vitest";
import { grantBattleRewards, calculateXpForNextLevel } from "@/lib/rewards/reward-service";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    battleRecord: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    userPokemon: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    campaignProgress: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("Reward & Idempotency Service (US-11 & US-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should correctly compute medium-fast XP leveling threshold", () => {
    expect(calculateXpForNextLevel(5)).toBe(6 * 6 * 6 - 5 * 5 * 5); // 216 - 125 = 91
    expect(calculateXpForNextLevel(10)).toBe(11 * 11 * 11 - 10 * 10 * 10); // 1331 - 1000 = 331
  });

  it("should grant rewards and progress stage on victory", async () => {
    (prisma.battleRecord.findUnique as any).mockResolvedValue(null);

    const mockTx = {
      userProfile: {
        upsert: vi.fn().mockResolvedValue({ userId: "user-1", pokedollars: 150 }),
      },
      userPokemon: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "pkmn-1",
            userId: "user-1",
            speciesId: "turtwig",
            nickname: "Tortipouss",
            level: 5,
            experience: 0,
            currentHp: 21,
            maxHp: 21,
            ivs: { hp: 15 },
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      campaignProgress: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      battleRecord: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const result = await grantBattleRewards({
      userId: "user-1",
      battleId: "battle-uuid-12345",
      stageId: "bachelor-1-stage-1",
      winner: "p1",
    });

    expect(result.isAlreadyClaimed).toBe(false);
    expect(result.moneyEarned).toBeGreaterThan(0);
    expect(result.xpEarned).toBeGreaterThan(0);
    expect(result.stageCompleted).toBe(true);
    expect(result.unlockedNextStageId).toBe("bachelor-1-stage-2");
  });

  it("should guarantee idempotency when same battleId is replayed", async () => {
    // Battle already recorded in DB
    (prisma.battleRecord.findUnique as any).mockResolvedValue({
      id: "rec-1",
      idempotencyKey: "battle-uuid-12345",
      moneyGained: 50,
      xpGained: 100,
      result: "VICTORY",
    });
    (prisma.userProfile.findUnique as any).mockResolvedValue({
      userId: "user-1",
      pokedollars: 200,
    });

    const result = await grantBattleRewards({
      userId: "user-1",
      battleId: "battle-uuid-12345",
      stageId: "bachelor-1-stage-1",
      winner: "p1",
    });

    // Should return existing without running new transaction
    expect(result.isAlreadyClaimed).toBe(true);
    expect(result.moneyEarned).toBe(50);
    expect(result.newBalance).toBe(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
