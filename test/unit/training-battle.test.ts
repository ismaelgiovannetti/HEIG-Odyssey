import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeAverageTeamLevel,
  difficultyToAIProfile,
  generateTrainingOpponent,
} from "@/lib/training/training-generator";
import { grantTrainingRewards } from "@/lib/rewards/reward-service";
import { POST as startBattleRoute } from "@/app/api/battle/start/route";
import { prisma } from "@/lib/prisma";
import { mockInteractiveTransaction } from "../helpers/mock-clients";
import { teamPokemon } from "../helpers/team-fixtures";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock("@/lib/auth/environment", () => ({
  getApplicationOrigin: () => "http://localhost:3000",
}));

vi.mock("@/lib/security/rate-limit", () => ({
  consumeFixedWindowRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    retryAfter: null,
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userPokemon: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    battleRecord: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    outboxEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(),
  },
}));

describe("Training Battle Mode (T-US09-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Générateur d'entraînement (training-generator)", () => {
    it("calcule le niveau moyen de l'équipe et le borne entre 5 et 100", () => {
      expect(computeAverageTeamLevel([])).toBe(5);
      expect(computeAverageTeamLevel([{ level: 2 }, { level: 4 }])).toBe(5);
      expect(computeAverageTeamLevel([{ level: 20 }, { level: 40 }])).toBe(30);
      expect(computeAverageTeamLevel([{ level: 120 }])).toBe(100);
    });

    it("associe correctement chaque niveau de difficulté à son profil IA", () => {
      expect(difficultyToAIProfile("easy")).toBe("random");
      expect(difficultyToAIProfile("normal")).toBe("heuristic");
      expect(difficultyToAIProfile("hard")).toBe("expectiminimax");
    });

    it("génère un dresseur virtuel cohérent avec l'équipe du joueur", () => {
      const trainer = generateTrainingOpponent({
        averageLevel: 25,
        difficulty: "normal",
        teamSize: 2,
      });

      expect(trainer.id).toBe("training-normal");
      expect(trainer.aiProfile).toBe("heuristic");
      expect(trainer.team.length).toBe(2);
      expect(trainer.team[0].level).toBe(25);
      expect(trainer.team[0].moves.length).toBeGreaterThan(0);
    });
  });

  describe("Récompenses d'entraînement (grantTrainingRewards)", () => {
    it("attribue les récompenses de victoire et crée l'OutboxEvent training.completed", async () => {
      vi.mocked(prisma.battleRecord.findUnique).mockResolvedValue(null);

      const mockTx = {
        userPokemon: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "pkmn-1",
              userId: "user-1",
              speciesId: "turtwig",
              level: 10,
              experience: 0,
              ivs: { hp: 15 },
            },
          ]),
          update: vi.fn().mockResolvedValue({}),
        },
        userProfile: {
          upsert: vi.fn().mockResolvedValue({ pokedollars: 180 }),
        },
        battleRecord: {
          create: vi.fn().mockResolvedValue({}),
        },
        outboxEvent: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      mockInteractiveTransaction(prisma, mockTx);

      const result = await grantTrainingRewards({
        userId: "user-1",
        battleId: "btl-training-1",
        difficulty: "normal",
        winner: "p1",
        playerPokemonIds: ["pkmn-1"],
        turnsCount: 4,
      });

      expect(result.isAlreadyClaimed).toBe(false);
      expect(result.moneyEarned).toBe(80);
      // Niveau 10 -> XP de base 214 -> normal (x1.5) -> 321 XP
      expect(result.xpEarned).toBe(321);
      expect(result.newBalance).toBe(180);

      expect(mockTx.battleRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          idempotencyKey: "btl-training-1",
          battleType: "TRAINING",
          opponentId: "training-normal",
          result: "VICTORY",
          xpGained: 321,
          moneyGained: 80,
        }),
      });

      expect(mockTx.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: "training.completed",
          aggregateType: "TRAINING",
          aggregateId: "btl-training-1",
        }),
      });
    });

    it("calcule l'XP à partir des Pokémon adverses vaincus et de la difficulté", async () => {
      vi.mocked(prisma.battleRecord.findUnique).mockResolvedValue(null);

      const mockTx = {
        userPokemon: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "pkmn-1",
              userId: "user-1",
              speciesId: "turtwig",
              level: 15,
              experience: 0,
              ivs: { hp: 15 },
            },
          ]),
          update: vi.fn().mockResolvedValue({}),
        },
        userProfile: {
          upsert: vi.fn().mockResolvedValue({ pokedollars: 130 }),
        },
        battleRecord: {
          create: vi.fn().mockResolvedValue({}),
        },
        outboxEvent: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      mockInteractiveTransaction(prisma, mockTx);

      // Adversaire avec 2 Pokémon niveau 15 vaincus, difficulté hard (x3)
      // bulbizarre (stage 1, b=65): floor((65 * 15 * 1.5) / 7) = 208
      // ivysaur (stage 2, b=140): floor((140 * 15 * 1.5) / 7) = 450
      // Base XP = 208 + 450 = 658 -> Hard (x3) = 1974 XP
      const result = await grantTrainingRewards({
        userId: "user-1",
        battleId: "btl-training-multi-defeated",
        difficulty: "hard",
        winner: "p1",
        playerPokemonIds: ["pkmn-1"],
        turnsCount: 6,
        opponentTeam: [
          { speciesId: "bulbasaur", level: 15, isFainted: true },
          { speciesId: "ivysaur", level: 15, isFainted: true },
        ],
      });

      expect(result.xpEarned).toBe(1974);
      expect(result.moneyEarned).toBe(130);
    });

    it("ne crédite aucun gain en cas de défaite p2", async () => {
      vi.mocked(prisma.battleRecord.findUnique).mockResolvedValue(null);

      const mockTx = {
        userPokemon: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "pkmn-1",
              userId: "user-1",
              speciesId: "turtwig",
              level: 10,
              experience: 0,
              ivs: { hp: 15 },
            },
          ]),
          update: vi.fn().mockResolvedValue({}),
        },
        userProfile: {
          upsert: vi.fn().mockResolvedValue({ pokedollars: 50 }),
        },
        battleRecord: {
          create: vi.fn().mockResolvedValue({}),
        },
        outboxEvent: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      mockInteractiveTransaction(prisma, mockTx);

      const result = await grantTrainingRewards({
        userId: "user-1",
        battleId: "btl-training-defeat",
        difficulty: "hard",
        winner: "p2",
        playerPokemonIds: ["pkmn-1"],
        turnsCount: 2,
      });

      expect(result.moneyEarned).toBe(0);
      expect(result.xpEarned).toBe(0);
    });
  });

  describe("API POST /api/battle/start en mode training", () => {
    it("démarre avec succès un combat d'entraînement avec une équipe valide", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "user-training-1" },
      });

      vi.mocked(prisma.userPokemon.findMany).mockResolvedValue([
        teamPokemon({
          id: "pkmn-1",
          userId: "user-training-1",
          nickname: "Twiggy",
          level: 15,
          currentHp: 45,
          maxHp: 45,
          teamPosition: 1,
        }),
      ]);

      const req = new Request("http://localhost:3000/api/battle/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          mode: "training",
          difficulty: "hard",
        }),
      });

      const res = await startBattleRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.battleId).toBeDefined();
      expect(json.trainer.id).toBe("training-hard");
      expect(json.trainer.title).toContain("Expectiminimax");
    });
  });
});
