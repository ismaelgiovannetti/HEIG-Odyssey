import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  getPlayerCollectionMock,
  updateActiveTeamMock,
  TeamPokemonNotOwnedError,
  TeamCompositionInvalidError,
} = vi.hoisted(() => {
  class TeamPokemonNotOwnedError extends Error {}
  class TeamCompositionInvalidError extends Error {
    constructor(public readonly reasons: string[]) {
      super("Composition d'équipe invalide.");
    }
  }

  return {
    getSessionMock: vi.fn(),
    getPlayerCollectionMock: vi.fn(),
    updateActiveTeamMock: vi.fn(),
    TeamPokemonNotOwnedError,
    TeamCompositionInvalidError,
  };
});

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock("@/lib/team/team-service", () => ({
  getPlayerCollection: getPlayerCollectionMock,
  updateActiveTeam: updateActiveTeamMock,
  TeamPokemonNotOwnedError,
  TeamCompositionInvalidError,
}));

import { GET, PUT } from "@/app/api/team/route";

function getRequest(): Request {
  return new Request("http://localhost:3000/api/team");
}

function putRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/team", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/team", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse la lecture sans session authentifiée", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    expect(getPlayerCollectionMock).not.toHaveBeenCalled();
  });

  it("charge la collection du joueur authentifié uniquement", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "owner-user" } });
    getPlayerCollectionMock.mockResolvedValue([{ id: "p1" }]);

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getPlayerCollectionMock).toHaveBeenCalledWith("owner-user");
    expect(body).toEqual({ success: true, count: 1, pokemon: [{ id: "p1" }] });
  });
});

describe("PUT /api/team", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ user: { id: "owner-user" } });
  });

  it("refuse la mutation sans session authentifiée", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await PUT(putRequest({ teamPokemonIds: ["p1"] }));

    expect(response.status).toBe(401);
    expect(updateActiveTeamMock).not.toHaveBeenCalled();
  });

  it("refuse une équipe vide", async () => {
    const response = await PUT(putRequest({ teamPokemonIds: [] }));

    expect(response.status).toBe(400);
    expect(updateActiveTeamMock).not.toHaveBeenCalled();
  });

  it("refuse une équipe de plus de six créatures", async () => {
    const response = await PUT(
      putRequest({ teamPokemonIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"] }),
    );

    expect(response.status).toBe(400);
    expect(updateActiveTeamMock).not.toHaveBeenCalled();
  });

  it("refuse une liste contenant un doublon", async () => {
    const response = await PUT(putRequest({ teamPokemonIds: ["p1", "p1"] }));

    expect(response.status).toBe(400);
    expect(updateActiveTeamMock).not.toHaveBeenCalled();
  });

  it("refuse un userId injecté dans le corps de la requête", async () => {
    const response = await PUT(
      putRequest({ userId: "victim-user", teamPokemonIds: ["p1"] }),
    );

    expect(response.status).toBe(400);
    expect(updateActiveTeamMock).not.toHaveBeenCalled();
  });

  it("transmet exclusivement l'identifiant de session au service", async () => {
    updateActiveTeamMock.mockResolvedValue([{ id: "p1", teamPosition: 1 }]);

    const response = await PUT(putRequest({ teamPokemonIds: ["p1"] }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateActiveTeamMock).toHaveBeenCalledWith("owner-user", ["p1"]);
    expect(body).toEqual({ success: true, team: [{ id: "p1", teamPosition: 1 }] });
  });

  it("refuse une créature qui n'appartient pas au joueur sans révéler de détail", async () => {
    updateActiveTeamMock.mockRejectedValue(new TeamPokemonNotOwnedError());

    const response = await PUT(putRequest({ teamPokemonIds: ["not-owned"] }));

    expect(response.status).toBe(404);
  });

  it("refuse une composition invalide en expliquant la raison", async () => {
    updateActiveTeamMock.mockRejectedValue(
      new TeamCompositionInvalidError(["L'équipe ne contient aucun Pokémon en état de combattre (tous K.O.)."]),
    );

    const response = await PUT(putRequest({ teamPokemonIds: ["p1"] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual([
      "L'équipe ne contient aucun Pokémon en état de combattre (tous K.O.).",
    ]);
  });

  it("ne renvoie jamais le message technique d'une erreur inattendue", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    updateActiveTeamMock.mockRejectedValue(new Error("internal-secret-value"));

    const response = await PUT(putRequest({ teamPokemonIds: ["p1"] }));
    const body = await response.json();
    consoleError.mockRestore();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("internal-secret-value");
  });
});
