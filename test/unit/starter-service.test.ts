import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectStarter } from "@/lib/starter/starter-service";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe("Starter Recruitment Service (US-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject an invalid or non-starter speciesId", async () => {
    await expect(selectStarter("user-123", "garchomp")).rejects.toThrow(
      "pas éligible comme starter"
    );
  });

  it("should successfully claim a starter for a new user", async () => {
    const mockTx = {
      userProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ userId: "user-123", hasCompletedOnboarding: true }),
      },
      userPokemon: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: "pkmn-123",
          userId: "user-123",
          speciesId: "turtwig",
          nickname: "Torti",
          level: 5,
          currentHp: 21,
          maxHp: 21,
          teamPosition: 1,
          moves: [],
          isShiny: false,
        }),
      },
      campaignProgress: {
        upsert: vi.fn().mockResolvedValue({ stageId: "bachelor-1-stage-1" }),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    const result = await selectStarter("user-123", "turtwig", "Torti");

    expect(result.success).toBe(true);
    expect(result.pokemon.speciesId).toBe("turtwig");
    expect(result.pokemon.teamPosition).toBe(1);
    expect(result.unlockedStageId).toBe("bachelor-1-stage-1");
  });

  it("should throw an error if the user has already completed onboarding", async () => {
    const mockTx = {
      userProfile: {
        findUnique: vi.fn().mockResolvedValue({ userId: "user-123", hasCompletedOnboarding: true }),
      },
      userPokemon: {
        count: vi.fn().mockResolvedValue(0),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    await expect(selectStarter("user-123", "chimchar")).rejects.toThrow(
      "L'onboarding a déjà été complété"
    );
  });

  it("should throw an error if user already has Pokémon", async () => {
    const mockTx = {
      userProfile: {
        findUnique: vi.fn().mockResolvedValue({ userId: "user-123", hasCompletedOnboarding: false }),
      },
      userPokemon: {
        count: vi.fn().mockResolvedValue(1),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    await expect(selectStarter("user-123", "piplup")).rejects.toThrow(
      "Ce joueur possède déjà des créatures"
    );
  });
});
