import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPlayerCollection,
  updateActiveTeam,
  TeamCompositionInvalidError,
  TeamPokemonNotOwnedError,
} from "@/lib/team/team-service";
import { prisma } from "@/lib/prisma";
import type { UserPokemon } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userPokemon: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

function mockPokemon(overrides: Partial<UserPokemon> & { id: string }): UserPokemon {
  return {
    userId: "user-1",
    speciesId: "turtwig",
    nickname: null,
    level: 5,
    experience: 0,
    currentHp: 20,
    maxHp: 20,
    ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: [],
    ability: "Overgrow",
    nature: "Hardy",
    gender: "GENDERLESS",
    isShiny: false,
    teamPosition: null,
    caughtAt: new Date(),
    ...overrides,
  } as UserPokemon;
}

describe("Team Service (T-US05-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPlayerCollection", () => {
    it("lit toute la collection du joueur, équipe active comprise", async () => {
      (prisma.userPokemon.findMany as any).mockResolvedValue([
        mockPokemon({ id: "p1", teamPosition: 1, nickname: "Torti" }),
        mockPokemon({ id: "p2", teamPosition: null, speciesId: "chimchar" }),
      ]);

      const collection = await getPlayerCollection("user-1");

      expect(prisma.userPokemon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-1" } }),
      );
      expect(collection).toHaveLength(2);
      expect(collection[0]).toMatchObject({ id: "p1", name: "Torti", teamPosition: 1 });
      expect(collection[1]).toMatchObject({ id: "p2", teamPosition: null });
      // Le nom d'espèce sert de repli lorsqu'aucun surnom n'a été donné.
      expect(collection[1].name).not.toBe("");
    });
  });

  describe("updateActiveTeam", () => {
    function mockTransaction(owned: UserPokemon[]) {
      const tx = {
        userPokemon: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce(owned) // vérification de propriété
            .mockResolvedValueOnce(owned), // relecture finale
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
      return tx;
    }

    it("refuse une créature qui n'appartient pas au joueur", async () => {
      mockTransaction([mockPokemon({ id: "p1" })]); // un seul trouvé pour deux demandés

      await expect(updateActiveTeam("user-1", ["p1", "p2"])).rejects.toBeInstanceOf(
        TeamPokemonNotOwnedError,
      );
    });

    it("refuse une composition invalide (toutes les créatures K.O.)", async () => {
      mockTransaction([
        mockPokemon({ id: "p1", currentHp: 0 }),
        mockPokemon({ id: "p2", currentHp: 0 }),
      ]);

      await expect(updateActiveTeam("user-1", ["p1", "p2"])).rejects.toBeInstanceOf(
        TeamCompositionInvalidError,
      );
    });

    it("met à jour les positions et libère les créatures retirées de l'équipe", async () => {
      const tx = mockTransaction([
        mockPokemon({ id: "p1", currentHp: 20, teamPosition: 1 }),
        mockPokemon({ id: "p2", currentHp: 20, teamPosition: 1 }),
      ]);

      const result = await updateActiveTeam("user-1", ["p1", "p2"]);

      // Les créatures actives non reprises dans la nouvelle liste retournent en collection.
      expect(tx.userPokemon.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", teamPosition: { not: null }, id: { notIn: ["p1", "p2"] } },
        data: { teamPosition: null },
      });

      expect(tx.userPokemon.update).toHaveBeenNthCalledWith(1, {
        where: { id: "p1" },
        data: { teamPosition: 1 },
      });
      expect(tx.userPokemon.update).toHaveBeenNthCalledWith(2, {
        where: { id: "p2" },
        data: { teamPosition: 2 },
      });

      expect(result).toHaveLength(2);
    });
  });
});
