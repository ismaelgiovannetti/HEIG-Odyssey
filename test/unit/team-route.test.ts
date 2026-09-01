import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamCompositionInvalidError, TeamPokemonNotOwnedError, TeamRevisionConflictError, TeamOnboardingRequiredError, PcCapacityExceededError } from "@/lib/team/team-errors";

const mocks = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/auth/environment", () => ({ getApplicationOrigin: () => "http://localhost:3000" }));
vi.mock("@/lib/team/team-service", async () => ({
  ...await vi.importActual<typeof import("@/lib/team/team-errors")>("@/lib/team/team-errors"),
  getPlayerCollection: mocks.read, updateActiveTeam: mocks.save,
}));
import { GET, PUT } from "@/app/api/team/route";

const valid = { expectedRevision: 4, teamPokemonIds: ["p1"] };
function request(body: unknown = valid, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/team", {
    method: "PUT", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", ...headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "owner", emailVerified: true } });
  mocks.read.mockResolvedValue({ revision: 4, count: 1, pokemon: [{ id: "p1" }], team: [{ id: "p1" }] });
  mocks.save.mockResolvedValue({ revision: 5, count: 1, pokemon: [{ id: "p1" }], team: [{ id: "p1" }] });
});

describe("API privée de l'équipe", () => {
  it("refuse lecture et écriture sans session", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost:3000/api/team"))).status).toBe(401);
    expect((await PUT(request())).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("refuse un compte non vérifié", async () => {
    mocks.session.mockResolvedValue({ user: { id: "owner", emailVerified: false } });
    expect((await GET(new Request("http://localhost:3000/api/team"))).status).toBe(403);
    expect((await PUT(request())).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("ignore un userId dans l'URL et interdit la mise en cache", async () => {
    const response = await GET(new Request("http://localhost:3000/api/team?userId=victim"));
    expect(mocks.read).toHaveBeenCalledWith("owner");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ success: true, revision: 4, count: 1 });
  });

  it.each([
    { ...valid, teamPokemonIds: [] },
    { ...valid, teamPokemonIds: ["1", "2", "3", "4", "5", "6", "7"] },
    { ...valid, teamPokemonIds: ["p1", "p1"] },
    { ...valid, userId: "victim" },
    { ...valid, moves: [] },
    { teamPokemonIds: ["p1"] },
    { ...valid, expectedRevision: -1 },
    { ...valid, pcPlacements: [{ pokemonId: "p2", boxNumber: 21, boxSlot: 1 }] },
    { ...valid, pcPlacements: [{ pokemonId: "p2", boxNumber: 1, boxSlot: 36 }] },
  ])("refuse un corps invalide avant le service (%#)", async (body) => {
    expect((await PUT(request(body))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each(["https://other.example", "null", ""])("refuse une origine absente ou étrangère : %s", async (origin) => {
    expect((await PUT(request(valid, { Origin: origin }))).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("refuse un corps non JSON ou trop volumineux", async () => {
    expect((await PUT(request(valid, { "Content-Type": "text/plain" }))).status).toBe(415);
    expect((await PUT(request({ content: "a".repeat(256 * 1024) }))).status).toBe(413);
    const invalidJson = new Request("http://localhost:3000/api/team", { method: "PUT", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: "{" });
    expect((await PUT(invalidJson)).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("sauvegarde avec l'identité de session et renvoie le nouvel instantané", async () => {
    const response = await PUT(request());
    expect(mocks.save).toHaveBeenCalledWith("owner", valid);
    expect(await response.json()).toMatchObject({ success: true, revision: 5, team: [{ id: "p1" }] });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("transmet la dernière case de la vingtième boîte au service", async () => {
    const body = { ...valid, pcPlacements: [{ pokemonId: "p2", boxNumber: 20, boxSlot: 35 }] };
    expect((await PUT(request(body))).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith("owner", body);
  });

  it.each([
    [new TeamPokemonNotOwnedError(), 404],
    [new TeamCompositionInvalidError(["Tous K.O."]), 400],
    [new TeamRevisionConflictError(), 409],
    [new PcCapacityExceededError(), 409],
    [new TeamOnboardingRequiredError(), 403],
  ] as const)("explique les refus métier (%#)", async (error, status) => {
    mocks.save.mockRejectedValue(error);
    const response = await PUT(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ success: false, error: error.message });
  });

  it("ne révèle jamais une erreur interne", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mocks.save.mockRejectedValue(new Error("internal-secret-value"));
      const response = await PUT(request());
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("internal-secret-value");
      expect(JSON.stringify(logger.mock.calls)).not.toContain("internal-secret-value");
    } finally { logger.mockRestore(); }
  });
});
