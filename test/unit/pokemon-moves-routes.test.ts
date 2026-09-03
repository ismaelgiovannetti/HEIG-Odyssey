import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getLearnsetRoute } from "@/app/api/pokemon/[id]/learnset/route";
import { PUT as updateMovesRoute } from "@/app/api/pokemon/[id]/moves/route";
import { POST as evolveRoute } from "@/app/api/pokemon/[id]/evolve/route";
import { prisma } from "@/lib/prisma";
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userPokemon: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock("@/lib/combat/battle-session-store", () => ({
  isPokemonInActiveBattle: vi.fn(() => false),
}));

describe("Pokemon Moves & Evolution API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/pokemon/[id]/learnset", () => {
    it("returns 401 if user is not authenticated", async () => {
      getSessionMock.mockResolvedValue(null);

      const res = await getLearnsetRoute(
        new Request("http://localhost:3000/api/pokemon/pkmn-1/learnset"),
        { params: Promise.resolve({ id: "pkmn-1" }) },
      );

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("returns learnable moves and evolutions for owned Pokemon", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "user-123" },
      });

      vi.mocked(prisma.userPokemon.findFirst).mockResolvedValue(
        teamPokemon({
          id: "pkmn-1",
          userId: "user-123",
          speciesId: "bulbasaur",
          nickname: "Bulbizarre",
          level: 16,
          moves: [
            {
              id: "tackle",
              name: "Charge",
              type: "Normal",
              power: 40,
              pp: 35,
              maxPp: 35,
            },
          ],
        }),
      );

      const res = await getLearnsetRoute(
        new Request("http://localhost:3000/api/pokemon/pkmn-1/learnset"),
        { params: Promise.resolve({ id: "pkmn-1" }) },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.learnableMoves)).toBe(true);
      expect(json.learnableMoves.length).toBeGreaterThan(0);
      expect(Array.isArray(json.evolutions)).toBe(true);
      expect(json.evolutions[0].targetSpeciesId).toBe("ivysaur");
      expect(json.evolutions[0].canEvolve).toBe(true);
    });
  });

  describe("PUT /api/pokemon/[id]/moves", () => {
    it("returns 400 on invalid move count", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "user-123" },
      });

      const res = await updateMovesRoute(
        new Request("http://localhost:3000/api/pokemon/pkmn-1/moves", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
          },
          body: JSON.stringify({ moveIds: [] }),
        }),
        { params: Promise.resolve({ id: "pkmn-1" }) },
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("returns 400 when a move identifier is not a bounded string", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "user-123" },
      });

      const res = await updateMovesRoute(
        new Request("http://localhost:3000/api/pokemon/pkmn-1/moves", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
          },
          body: JSON.stringify({ moveIds: [{}] }),
        }),
        { params: Promise.resolve({ id: "pkmn-1" }) },
      );

      expect(res.status).toBe(400);
      expect(prisma.userPokemon.findFirst).not.toHaveBeenCalled();
    });

    it("updates moves successfully when valid", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "user-123" },
      });

      vi.mocked(prisma.userPokemon.findFirst).mockResolvedValue(
        teamPokemon({
          id: "pkmn-1",
          userId: "user-123",
          speciesId: "bulbasaur",
          level: 16,
        }),
      );

      vi.mocked(prisma.userPokemon.update).mockResolvedValue(
        teamPokemon({
          id: "pkmn-1",
          userId: "user-123",
          speciesId: "bulbasaur",
          nickname: "Bulbizarre",
          level: 16,
          experience: 0,
          teamPosition: 1,
          boxNumber: null,
          boxSlot: null,
          isShiny: false,
          ability: "Overgrow",
          nature: "Hardy",
          moves: [
            {
              id: "tackle",
              name: "Charge",
              type: "Normal",
              category: "physical",
              power: 40,
              accuracy: 100,
              pp: 35,
              maxPp: 35,
              priority: 0,
            },
            {
              id: "vinewhip",
              name: "Fouet Lianes",
              type: "Grass",
              category: "physical",
              power: 45,
              accuracy: 100,
              pp: 25,
              maxPp: 25,
              priority: 0,
            },
          ],
          ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
          evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
          currentHp: 20,
          maxHp: 20,
        }),
      );

      const res = await updateMovesRoute(
        new Request("http://localhost:3000/api/pokemon/pkmn-1/moves", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
          },
          body: JSON.stringify({ moveIds: ["tackle", "vinewhip"] }),
        }),
        { params: Promise.resolve({ id: "pkmn-1" }) },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.moves).toHaveLength(2);
    });
  });

  describe("POST /api/pokemon/[id]/evolve", () => {
    it("evolves pokemon and updates database", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "user-123" },
      });

      vi.mocked(prisma.userPokemon.findFirst).mockResolvedValue(
        teamPokemon({
          id: "pkmn-1",
          userId: "user-123",
          speciesId: "bulbasaur",
          nickname: "Bulbizarre",
          level: 16,
          currentHp: 40,
          maxHp: 40,
          ivs: { hp: 15 },
          evs: { hp: 0 },
          moves: [],
        }),
      );

      vi.mocked(prisma.userPokemon.update).mockResolvedValue(
        teamPokemon({
          id: "pkmn-1",
          userId: "user-123",
          speciesId: "ivysaur",
          nickname: "Herbizarre",
          level: 16,
          currentHp: 50,
          maxHp: 50,
          ivs: { hp: 15 },
          evs: { hp: 0 },
          moves: [],
        }),
      );

      const res = await evolveRoute(
        new Request("http://localhost:3000/api/pokemon/pkmn-1/evolve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
          },
          body: JSON.stringify({ targetSpeciesId: "ivysaur" }),
        }),
        { params: Promise.resolve({ id: "pkmn-1" }) },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.newSpeciesName).toBe("Herbizarre");
      expect(json.pokemon.speciesId).toBe("ivysaur");
    });

    it("does not expose an unexpected database error", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "user-123" },
      });
      vi.mocked(prisma.userPokemon.findFirst).mockRejectedValue(
        new Error("postgres-secret-detail"),
      );

      const res = await evolveRoute(
        new Request("http://localhost:3000/api/pokemon/pkmn-1/evolve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
          },
          body: JSON.stringify({ targetSpeciesId: "ivysaur" }),
        }),
        { params: Promise.resolve({ id: "pkmn-1" }) },
      );

      expect(res.status).toBe(500);
      expect(await res.text()).not.toContain("postgres-secret-detail");
    });
  });
});
