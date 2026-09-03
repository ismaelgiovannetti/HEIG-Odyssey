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

    expect(
      firstModule.isPokemonInActiveBattle("user-owner", "pokemon-owner"),
    ).toBe(true);
    expect(
      firstModule.isPokemonInActiveBattle("other-user", "pokemon-owner"),
    ).toBe(false);

    // Simule la recompilation de la route d'action après la création du combat.
    vi.resetModules();
    const secondModule = await import("@/lib/combat/battle-session-store");
    const session = secondModule.getBattleSession("battle-after-module-reload");

    expect(session).toBeDefined();
    expect(
      secondModule.isPokemonInActiveBattle("user-owner", "pokemon-owner"),
    ).toBe(true);
    expect(session?.userId).toBe("user-owner");
    expect(session?.playerPokemonIds).toEqual(["pokemon-owner"]);
    expect(session?.difficulty).toBe("normal");
  });

  it("abandonBattleSession libère immédiatement le verrou de l'équipe", async () => {
    const store = await import("@/lib/combat/battle-session-store");
    store.registerBattleSession(
      { battleId: "battle-quit" } as Parameters<typeof store.registerBattleSession>[0],
      "user-1",
      ["pk-1"],
      undefined,
      "random",
      { battleType: "TRAINING", difficulty: "easy" },
    );
    expect(store.isPokemonInActiveBattle("user-1", "pk-1")).toBe(true);

    // Un autre compte ne peut pas fermer ce combat.
    expect(store.abandonBattleSession("battle-quit", "intrus")).toBe(false);
    expect(store.isPokemonInActiveBattle("user-1", "pk-1")).toBe(true);

    // Le propriétaire, si.
    expect(store.abandonBattleSession("battle-quit", "user-1")).toBe(true);
    expect(store.isPokemonInActiveBattle("user-1", "pk-1")).toBe(false);
    expect(store.getBattleSession("battle-quit")).toBeUndefined();
    // Idempotent.
    expect(store.abandonBattleSession("battle-quit", "user-1")).toBe(false);
  });

  it("remplace l'ancienne session lorsqu'un joueur démarre un nouveau combat", async () => {
    const store = await import("@/lib/combat/battle-session-store");

    store.registerBattleSession(
      { battleId: "battle-old" } as Parameters<typeof store.registerBattleSession>[0],
      "user-1",
      ["pk-1"],
      undefined,
      "random",
      { battleType: "TRAINING", difficulty: "easy" },
    );
    store.registerBattleSession(
      { battleId: "battle-new" } as Parameters<typeof store.registerBattleSession>[0],
      "user-1",
      ["pk-2"],
      undefined,
      "random",
      { battleType: "TRAINING", difficulty: "normal" },
    );

    expect(store.getBattleSession("battle-old")).toBeUndefined();
    expect(store.getBattleSession("battle-new")).toBeDefined();
    expect(store.isPokemonInActiveBattle("user-1", "pk-1")).toBe(false);
    expect(store.isPokemonInActiveBattle("user-1", "pk-2")).toBe(true);
  });

  it("une session inactive cesse de verrouiller après la fenêtre d'activité", async () => {
    vi.useFakeTimers();
    try {
      const store = await import("@/lib/combat/battle-session-store");
      store.registerBattleSession(
        { battleId: "battle-idle" } as Parameters<typeof store.registerBattleSession>[0],
        "user-2",
        ["pk-2"],
        undefined,
        "random",
        { battleType: "TRAINING", difficulty: "easy" },
      );
      expect(store.isPokemonInActiveBattle("user-2", "pk-2")).toBe(true);

      // 3 min sans action de combat : le joueur a quitté l'arène.
      vi.advanceTimersByTime(3 * 60 * 1000 + 1000);
      expect(store.isPokemonInActiveBattle("user-2", "pk-2")).toBe(false);

      // La session existe toujours (fenêtre de reprise), mais ne bloque plus.
      expect(store.getBattleSession("battle-idle")).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
