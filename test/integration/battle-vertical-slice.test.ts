import { describe, it, expect, vi, beforeEach } from "vitest";
import { BattleEngine } from "@/lib/combat/battle-engine";
import {
  BattleSessionUnavailableError,
  registerBattleSession,
  getBattleSession,
  processBattleTurn,
} from "@/lib/combat/battle-session-store";
import { prisma } from "@/lib/prisma";
import type { TrainerPokemonInput } from "@/lib/content/schemas";

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
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(),
  },
}));


describe("Battle Vertical Slice Integration (T-US06-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const p1Team: TrainerPokemonInput[] = [
    {
      speciesId: "pikachu",
      level: 50,
      moves: [
        {
          id: "thunderbolt",
          name: "Tonnerre",
          type: "Electric",
          category: "special",
          power: 95,
          accuracy: 100,
          pp: 15,
          maxPp: 15,
          priority: 0,
        },
      ],
    },
  ];

  const p2Team: TrainerPokemonInput[] = [
    {
      speciesId: "magikarp",
      level: 5,
      moves: [
        {
          id: "splash",
          name: "Trempette",
          type: "Normal",
          category: "status",
          power: 0,
          accuracy: 100,
          pp: 40,
          maxPp: 40,
          priority: 0,
        },
      ],
    },
  ];

  it("should register a battle session and process a turn to completion with rewards", async () => {
    const engine = new BattleEngine({
      p1: { name: "Player", team: p1Team },
      p2: { name: "Trainer", team: p2Team },
    });

    const participantIds = ["pkmn-1"];
    registerBattleSession(engine, "user-1", participantIds, "bachelor-1-stage-1", "random");
    // Le stockage garde une copie : modifier le tableau d'origine ne change pas le combat.
    participantIds[0] = "replacement";

    const session = getBattleSession(engine.battleId);
    expect(session).toBeDefined();
    expect(session?.playerPokemonIds).toEqual(["pkmn-1"]);
    expect(Object.isFrozen(session?.playerPokemonIds)).toBe(true);

    // Ce scénario couvre le moteur et les services ; PostgreSQL est simulé ici.
    (prisma.battleRecord.findUnique as any).mockResolvedValue(null);
    const mockTx = {
      userProfile: {
        upsert: vi.fn().mockResolvedValue({ userId: "user-1", pokedollars: 150 }),
      },
      userPokemon: {
        findMany: vi.fn().mockResolvedValue([{
          id: "pkmn-1", userId: "user-1", speciesId: "pikachu", level: 50,
          experience: 0, currentHp: 100, maxHp: 100, ivs: { hp: 15 }, nickname: null,
        }]),
        update: vi.fn(),
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
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));


    // Un autre compte ne peut ni lire ni faire avancer ce combat.
    await expect(
      processBattleTurn(engine.battleId, "other-user", { type: "move", moveIndex: 0 }),
    ).rejects.toBeInstanceOf(BattleSessionUnavailableError);

    // Le propriétaire peut jouer : Tonnerre met K.O. le Magicarpe au premier tour.
    const result = await processBattleTurn(
      engine.battleId,
      "user-1",
      { type: "move", moveIndex: 0 },
    );

    expect(result.turnResult).toBeDefined();
    expect(result.turnResult.events.length).toBeGreaterThan(0);
    expect(result.turnResult.state.phase).toBe("finished");
    expect(result.turnResult.state.winner).toBe("p1");

    // La fin du combat transmet automatiquement les participants aux récompenses.
    expect(result.rewards).toBeDefined();
    expect(result.rewards?.moneyEarned).toBeGreaterThan(0);
    expect(result.rewards?.stageCompleted).toBe(true);
    expect(mockTx.userPokemon.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { in: ["pkmn-1"] } }, orderBy: { id: "asc" },
    });
  });
});
