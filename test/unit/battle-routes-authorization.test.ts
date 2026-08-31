import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class BattleSessionUnavailableError extends Error {}
  class BattleActionRejectedError extends Error {}
  class BattleEngine {
    battleId = "battle-test";

    getState() {
      return { phase: "waiting" };
    }
  }

  return {
    BattleActionRejectedError,
    BattleEngine,
    BattleSessionUnavailableError,
    canUserAccessStage: vi.fn(),
    findMany: vi.fn(),
    getSession: vi.fn(),
    getTrainer: vi.fn(),
    loadCampaign: vi.fn(),
    processBattleTurn: vi.fn(),
    registerBattleSession: vi.fn(),
    userPokemonToTrainerPokemon: vi.fn(),
    validateTeamComposition: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@/lib/campaign/campaign-service", () => ({
  canUserAccessStage: mocks.canUserAccessStage,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { userPokemon: { findMany: mocks.findMany } },
}));

vi.mock("@/lib/combat/battle-engine", () => ({
  BattleEngine: mocks.BattleEngine,
}));

vi.mock("@/lib/combat/battle-session-store", () => ({
  BattleActionRejectedError: mocks.BattleActionRejectedError,
  BattleSessionUnavailableError: mocks.BattleSessionUnavailableError,
  processBattleTurn: mocks.processBattleTurn,
  registerBattleSession: mocks.registerBattleSession,
}));

vi.mock("@/lib/content/loader", () => ({
  getTrainer: mocks.getTrainer,
  loadCampaign: mocks.loadCampaign,
}));

vi.mock("@/lib/team/team-validator", () => ({
  userPokemonToTrainerPokemon: mocks.userPokemonToTrainerPokemon,
  validateTeamComposition: mocks.validateTeamComposition,
}));

import { POST as startBattle } from "@/app/api/battle/start/route";
import { POST as applyBattleAction } from "@/app/api/battle/action/route";

function request(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "owner-user" } });
  mocks.findMany.mockResolvedValue([{ id: "pokemon-1" }]);
  mocks.validateTeamComposition.mockReturnValue({ isValid: true, errors: [] });
  mocks.userPokemonToTrainerPokemon.mockReturnValue({
    speciesId: "pikachu",
    level: 5,
    moves: [],
  });
  mocks.getTrainer.mockReturnValue({
    id: "trainer-1",
    name: "Rival",
    team: [],
    aiProfile: "random",
  });
  mocks.canUserAccessStage.mockResolvedValue({
    allowed: true,
    trainerId: "trainer-1",
  });
  mocks.loadCampaign.mockReturnValue([]);
  mocks.processBattleTurn.mockResolvedValue({
    turnResult: {
      turn: 1,
      events: [],
      state: { phase: "waiting" },
    },
  });
});

describe("POST /api/battle/start", () => {
  it("refuse un démarrage sans session authentifiée", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await startBattle(
      request("/api/battle/start", { trainerId: "trainer-1" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.registerBattleSession).not.toHaveBeenCalled();
  });

  it("refuse un userId injecté par le navigateur", async () => {
    const response = await startBattle(
      request("/api/battle/start", {
        userId: "victim-user",
        trainerId: "trainer-1",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});

describe("autorisation du démarrage d'un combat", () => {
  it("refuse de mélanger une étape de campagne et un autre dresseur", async () => {
    const response = await startBattle(
      request("/api/battle/start", {
        stageId: "bachelor-1-stage-1",
        trainerId: "trainer-1",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.registerBattleSession).not.toHaveBeenCalled();
  });

  it("refuse le lancement d'une étape de campagne verrouillée avec code 403", async () => {
    mocks.canUserAccessStage.mockResolvedValue({
      allowed: false,
      reason: "Cette étape est verrouillée.",
    });

    const response = await startBattle(
      request("/api/battle/start", { stageId: "bachelor-1-stage-2" }),
    );

    expect(response.status).toBe(403);
    expect(mocks.registerBattleSession).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      success: false,
      error: "Cette étape est verrouillée.",
    });
  });

  it("autorise le lancement d'une étape de campagne débloquée avec code 200", async () => {
    mocks.canUserAccessStage.mockResolvedValue({
      allowed: true,
      trainerId: "trainer-1",
    });

    const response = await startBattle(
      request("/api/battle/start", { stageId: "bachelor-1-stage-1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.canUserAccessStage).toHaveBeenCalledWith(
      "owner-user",
      "bachelor-1-stage-1",
    );
    expect(mocks.registerBattleSession).toHaveBeenCalled();
  });

  it("charge et enregistre le combat avec l'identité Better Auth", async () => {
    const response = await startBattle(
      request("/api/battle/start", { trainerId: "trainer-1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "owner-user" }),
      }),
    );
    expect(mocks.registerBattleSession.mock.calls[0]?.[1]).toBe("owner-user");
  });
});

describe("POST /api/battle/action", () => {
  const actionBody = {
    battleId: "battle-test",
    action: { type: "move", moveIndex: 0 },
  };

  it("refuse une action sans session authentifiée", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await applyBattleAction(
      request("/api/battle/action", actionBody),
    );

    expect(response.status).toBe(401);
    expect(mocks.processBattleTurn).not.toHaveBeenCalled();
  });

  it("transmet l'identité du propriétaire au stockage", async () => {
    const response = await applyBattleAction(
      request("/api/battle/action", actionBody),
    );

    expect(response.status).toBe(200);
    expect(mocks.processBattleTurn).toHaveBeenCalledWith(
      "battle-test",
      "owner-user",
      { type: "move", moveIndex: 0 },
    );
  });
});

describe("erreurs sécurisées des actions de combat", () => {
  const actionBody = {
    battleId: "battle-test",
    action: { type: "move", moveIndex: 0 },
  };

  it("ne distingue pas un combat absent d'un combat appartenant à autrui", async () => {
    mocks.processBattleTurn.mockRejectedValue(
      new mocks.BattleSessionUnavailableError(),
    );

    const response = await applyBattleAction(
      request("/api/battle/action", actionBody),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: "Combat introuvable ou expiré.",
    });
  });
});

describe("erreurs internes des combats", () => {
  it("ne renvoie jamais le message technique au navigateur", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.processBattleTurn.mockRejectedValue(new Error("internal-secret-value"));

    const response = await applyBattleAction(
      request("/api/battle/action", {
        battleId: "battle-test",
        action: { type: "move", moveIndex: 0 },
      }),
    );
    const body = await response.json();
    consoleError.mockRestore();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("internal-secret-value");
  });
});
