import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, selectStarterMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  selectStarterMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock("@/lib/starter/starter-service", () => ({
  selectStarter: selectStarterMock,
}));

import { POST } from "@/app/api/starter/choose/route";

function createRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/starter/choose", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/starter/choose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse la sélection sans session authentifiée", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await POST(createRequest({ speciesId: "turtwig" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      success: false,
      error: "Authentification requise.",
    });
    expect(selectStarterMock).not.toHaveBeenCalled();
  });

  it("refuse un userId injecté dans le corps de la requête", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "authenticated-user" },
    });

    const response = await POST(
      createRequest({
        userId: "victim-user",
        speciesId: "turtwig",
      })
    );

    expect(response.status).toBe(400);
    expect(selectStarterMock).not.toHaveBeenCalled();
  });

  it("utilise exclusivement l'identifiant de la session", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "authenticated-user" },
    });
    selectStarterMock.mockResolvedValue({
      success: true,
      pokemon: { id: "pokemon-1" },
      unlockedStageId: "bachelor-1-stage-1",
    });

    const response = await POST(
      createRequest({
        speciesId: "turtwig",
        nickname: "Torti",
      })
    );

    expect(response.status).toBe(201);
    expect(selectStarterMock).toHaveBeenCalledOnce();
    expect(selectStarterMock).toHaveBeenCalledWith(
      "authenticated-user",
      "turtwig",
      "Torti"
    );
  });
});
