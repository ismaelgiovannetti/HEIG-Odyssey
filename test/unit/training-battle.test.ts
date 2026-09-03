import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeAverageTeamLevel,
  difficultyToAIProfile,
  generateTrainingOpponent,
} from "@/lib/combat/training-generator";
import { grantTrainingRewards } from "@/lib/rewards/reward-service";
import { POST as startBattleRoute } from "@/app/api/battle/start/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
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
      (prisma.battleRecord.findUnique as any).mockResolvedValue(null);

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

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

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
      expect(result.xpEarned).toBe(180);
      expect(result.newBalance).toBe(180);

      expect(mockTx.battleRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          idempotencyKey: "btl-training-1",
          battleType: "TRAINING",
          opponentId: "training-normal",
          result: "VICTORY",
          xpGained: 180,
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

    it("ne crédite aucun gain en cas de défaite p2", async () => {
      (prisma.battleRecord.findUnique as any).mockResolvedValue(null);

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

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

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
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "user-training-1" },
      });

      (prisma.userPokemon.findMany as any).mockResolvedValue([
        {
          id: "pkmn-1",
          userId: "user-training-1",
          speciesId: "turtwig",
          nickname: "Twiggy",
          level: 15,
          experience: 0,
          currentHp: 45,
          maxHp: 45,
          teamPosition: 1,
          ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },

        },
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
