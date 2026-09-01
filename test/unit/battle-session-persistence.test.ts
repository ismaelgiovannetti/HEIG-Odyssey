import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/combat/ai", () => ({
  selectAIAction: vi.fn(),
}));

vi.mock("@/lib/rewards/reward-service", () => ({
  grantBattleRewards: vi.fn(),
  grantTrainingRewards: vi.fn(),
}));

vi.mock("@/lib/combat/battle-participants", () => ({
  snapshotBattleParticipants: (ids: readonly string[]) => [...ids],
}));

type TestBattleGlobals = typeof globalThis & {
  __heigOdysseyBattleSessions?: Map<string, unknown>;
};

const battleGlobals = globalThis as TestBattleGlobals;

describe("persistance en mémoire d'une session de combat", () => {
  beforeEach(() => {
    // Chaque test démarre avec le même état qu'un nouveau processus serveur.
    delete battleGlobals.__heigOdysseyBattleSessions;
    vi.resetModules();
  });

  afterEach(() => {
    delete battleGlobals.__heigOdysseyBattleSessions;
  });

  it("retrouve le combat après un rechargement du module Next.js", async () => {
    const firstModule = await import("@/lib/combat/battle-session-store");
    const engine = {
      battleId: "battle-after-module-reload",
    } as Parameters<typeof firstModule.registerBattleSession>[0];

    firstModule.registerBattleSession(
      engine,
      "user-owner",
      ["pokemon-owner"],
      undefined,
      "random",
      { battleType: "TRAINING", difficulty: "normal" },
    );

    // Simule la recompilation de la route d'action après la création du combat.
    vi.resetModules();
    const secondModule = await import("@/lib/combat/battle-session-store");
    const session = secondModule.getBattleSession("battle-after-module-reload");

    expect(session).toBeDefined();
    expect(session?.userId).toBe("user-owner");
    expect(session?.playerPokemonIds).toEqual(["pokemon-owner"]);
    expect(session?.difficulty).toBe("normal");
  });
});
