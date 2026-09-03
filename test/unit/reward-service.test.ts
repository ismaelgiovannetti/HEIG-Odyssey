import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  grantBattleRewards,
  calculateXpForNextLevel,
} from "@/lib/rewards/reward-service";
import { prisma } from "@/lib/prisma";
import { mockInteractiveTransaction } from "../helpers/mock-clients";
import { battleRecord, userProfile } from "../helpers/prisma-fixtures";

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
    outboxEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
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
    vi.mocked(prisma.battleRecord.findUnique).mockResolvedValue(null);

    const mockTx = {
      userProfile: {
        upsert: vi
          .fn()
          .mockResolvedValue({ userId: "user-1", pokedollars: 150 }),
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
      outboxEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    mockInteractiveTransaction(prisma, mockTx);

    const result = await grantBattleRewards({
      userId: "user-1",
      battleId: "battle-uuid-12345",
      stageId: "bachelor-1-stage-1",
      winner: "p1",
      playerPokemonIds: ["pkmn-1"],
    });

    expect(result.isAlreadyClaimed).toBe(false);
    expect(result.moneyEarned).toBeGreaterThan(0);
    expect(result.xpEarned).toBeGreaterThan(0);
    expect(result.stageCompleted).toBe(true);
    expect(result.unlockedNextStageId).toBe("bachelor-1-stage-2");
    // Aucun filtre sur l'équipe actuelle : le participant peut avoir rejoint le PC.
    expect(mockTx.userPokemon.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { in: ["pkmn-1"] } },
      orderBy: { id: "asc" },
    });
    // Vérification de la création de l'OutboxEvent transactionnel
    expect(mockTx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "battle.completed",
          aggregateType: "BATTLE",
          aggregateId: "battle-uuid-12345",
          status: "PENDING",
        }),
      }),
    );
    const storedPayload =
      mockTx.outboxEvent.create.mock.calls[0]?.[0]?.data?.payload;
    expect(storedPayload).toMatchObject({
      userId: "user-1",
      battleId: "battle-uuid-12345",
      battleType: "CAMPAIGN",
    });
    expect(storedPayload).not.toHaveProperty("payload");
  });

  it("should guarantee idempotency when same battleId is replayed", async () => {
    // Le combat enregistré appartient au même compte : le rejeu ne paie rien de plus.
    vi.mocked(prisma.battleRecord.findUnique).mockResolvedValue(
      battleRecord({
        id: "rec-1",
        userId: "user-1",
        idempotencyKey: "battle-uuid-12345",
        moneyGained: 50,
        xpGained: 100,
        result: "VICTORY",
      }),
    );
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
      userProfile({
        userId: "user-1",
        pokedollars: 200,
      }),
    );

    const result = await grantBattleRewards({
      userId: "user-1",
      battleId: "battle-uuid-12345",
      stageId: "bachelor-1-stage-1",
      winner: "p1",
      playerPokemonIds: ["pkmn-1"],
    });

    // La réponse reprend le résultat existant sans ouvrir une nouvelle transaction.
    expect(result.isAlreadyClaimed).toBe(true);
    expect(result.moneyEarned).toBe(50);
    expect(result.newBalance).toBe(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuse le rejeu d'un combat appartenant à autrui", async () => {
    vi.mocked(prisma.battleRecord.findUnique).mockResolvedValue(
      battleRecord({
        userId: "other-user",
      }),
    );
    await expect(
      grantBattleRewards({
        userId: "user-1",
        battleId: "foreign-battle",
        stageId: "bachelor-1-stage-1",
        winner: "p1",
        playerPokemonIds: ["pkmn-1"],
      }),
    ).rejects.toThrow("BATTLE_REWARD_OWNER_MISMATCH");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
