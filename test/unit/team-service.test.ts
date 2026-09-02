import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  getPlayerCollection, releasePokemon, updateActiveTeam, TeamCompositionInvalidError,
  TeamPokemonInBattleError, TeamPokemonNotOwnedError, TeamRevisionConflictError,
  TeamOnboardingRequiredError,
} from "@/lib/team/team-service";
import { teamPokemon } from "../helpers/team-fixtures";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(), $executeRaw: vi.fn(),
    userProfile: { findUnique: vi.fn(), update: vi.fn() },
    userPokemon: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return { tx, transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
});
const battleMocks = vi.hoisted(() => ({
  isPokemonInActiveBattle: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/combat/battle-session-store", () => ({
  isPokemonInActiveBattle: battleMocks.isPokemonInActiveBattle,
}));

const active = teamPokemon({ id: "p1", teamPosition: 1, boxNumber: null, boxSlot: null, nickname: "Torti" });
const stored = teamPokemon({ id: "p2", speciesId: "chimchar" });

beforeEach(() => {
  vi.clearAllMocks();
  battleMocks.isPokemonInActiveBattle.mockReturnValue(false);
  mocks.tx.$queryRaw.mockResolvedValue([{ id: "profile-1" }]);
  mocks.tx.$executeRaw.mockResolvedValue(2);
  mocks.tx.userProfile.findUnique.mockResolvedValue({ hasCompletedOnboarding: true, collectionRevision: 4 });
  mocks.tx.userProfile.update.mockResolvedValue({ collectionRevision: 5 });
  mocks.tx.userPokemon.findMany.mockResolvedValue([active, stored]);
  mocks.tx.userPokemon.deleteMany.mockResolvedValue({ count: 1 });
  mocks.tx.userPokemon.updateMany.mockResolvedValue({ count: 0 });
});

describe("service équipe et PC", () => {
  it("lit un instantané privé avec les attaques possédées et les dimensions des boîtes", async () => {
    const result = await getPlayerCollection("user-1");
    expect(result).toMatchObject({ revision: 4, count: 2, pc: { columns: 7, rows: 5 } });
    expect(result.pc.boxes).toHaveLength(20);
    expect(result.team).toHaveLength(1);
    expect(result.pokemon[0]).toMatchObject({ id: "p1", name: "Torti", moves: [{ id: "tackle", pp: 0 }] });
    expect(result.pokemon[0]).not.toHaveProperty("userId");
    expect(result.pokemon[0].stats?.hp).toBe(21);
    expect(mocks.tx.userPokemon.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });

  it("refuse l'accès avant la fin du recrutement initial", async () => {
    mocks.tx.userProfile.findUnique.mockResolvedValue({ hasCompletedOnboarding: false });
    await expect(getPlayerCollection("user-1")).rejects.toBeInstanceOf(TeamOnboardingRequiredError);
    await expect(updateActiveTeam("user-1", { expectedRevision: 4, teamPokemonIds: ["p1"] })).rejects.toBeInstanceOf(TeamOnboardingRequiredError);
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("refuse un identifiant absent de la collection sans écrire", async () => {
    await expect(updateActiveTeam("user-1", { expectedRevision: 4, teamPokemonIds: ["foreign"] })).rejects.toBeInstanceOf(TeamPokemonNotOwnedError);
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("revérifie les entrées même lors d'un appel direct au service", async () => {
    await expect(updateActiveTeam("user-1", { expectedRevision: 4, teamPokemonIds: [] })).rejects.toBeInstanceOf(TeamCompositionInvalidError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuse une équipe entièrement K.O.", async () => {
    mocks.tx.userPokemon.findMany.mockResolvedValue([{ ...active, currentHp: 0 }, stored]);
    await expect(updateActiveTeam("user-1", { expectedRevision: 4, teamPokemonIds: ["p1"] })).rejects.toBeInstanceOf(TeamCompositionInvalidError);
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("verrouille le joueur puis refuse la version d'un ancien onglet", async () => {
    await expect(updateActiveTeam("user-1", { expectedRevision: 3, teamPokemonIds: ["p2"] })).rejects.toBeInstanceOf(TeamRevisionConflictError);
    expect(mocks.tx.$queryRaw.mock.calls[0][0].sql).toContain("FOR UPDATE");
    expect(mocks.tx.userPokemon.findMany).not.toHaveBeenCalled();
    expect(mocks.tx.userProfile.update).not.toHaveBeenCalled();
  });

  it("enregistre l'échange puis renvoie la version et le rangement relus", async () => {
    const updated = [{ ...stored, teamPosition: 1, boxNumber: null, boxSlot: null }, { ...active, teamPosition: null, boxNumber: 1, boxSlot: 1 }];
    mocks.tx.userPokemon.findMany.mockResolvedValueOnce([active, stored]).mockResolvedValueOnce(updated);
    const result = await updateActiveTeam("user-1", { expectedRevision: 4, teamPokemonIds: ["p2"] });
    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.tx.$executeRaw.mock.calls[0][0].values).toContain("user-1");
    expect(mocks.tx.userProfile.update).toHaveBeenCalledWith({ where: { userId: "user-1" }, data: { collectionRevision: { increment: 1 } } });
    expect(result.revision).toBe(5);
    expect(result.team[0].id).toBe("p2");
    expect(result.pokemon.find((p) => p.id === "p1")).toMatchObject({ boxNumber: 1, boxSlot: 1 });
  });

  it("relâche définitivement un Pokémon du PC puis renvoie la collection relue", async () => {
    mocks.tx.userPokemon.findMany
      .mockResolvedValueOnce([active, stored])
      .mockResolvedValueOnce([active]);
    const result = await releasePokemon("user-1", {
      expectedRevision: 4,
      pokemonId: "p2",
    });
    expect(mocks.tx.userPokemon.deleteMany).toHaveBeenCalledWith({
      where: { id: "p2", userId: "user-1" },
    });
    expect(mocks.tx.userPokemon.updateMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ revision: 5, count: 1 });
    expect(result.pokemon.map((pokemon) => pokemon.id)).toEqual(["p1"]);
  });

  it("compacte l'équipe après le relâchement d'un partenaire actif", async () => {
    const secondActive = {
      ...stored,
      teamPosition: 2,
      boxNumber: null,
      boxSlot: null,
    };
    const compacted = { ...secondActive, teamPosition: 1 };
    mocks.tx.userPokemon.findMany
      .mockResolvedValueOnce([active, secondActive])
      .mockResolvedValueOnce([compacted]);
    const result = await releasePokemon("user-1", {
      expectedRevision: 4,
      pokemonId: "p1",
    });
    expect(mocks.tx.userPokemon.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", teamPosition: { gt: 1 } },
      data: { teamPosition: { decrement: 1 } },
    });
    expect(result.team[0]).toMatchObject({ id: "p2", teamPosition: 1 });
  });

  it("refuse de relâcher le dernier partenaire actif", async () => {
    await expect(
      releasePokemon("user-1", { expectedRevision: 4, pokemonId: "p1" }),
    ).rejects.toBeInstanceOf(TeamCompositionInvalidError);
    expect(mocks.tx.userPokemon.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.userProfile.update).not.toHaveBeenCalled();
  });

  it("ne révèle pas si l'identifiant relâché appartient à un autre joueur", async () => {
    await expect(
      releasePokemon("user-1", { expectedRevision: 4, pokemonId: "foreign" }),
    ).rejects.toBeInstanceOf(TeamPokemonNotOwnedError);
    expect(mocks.tx.userPokemon.deleteMany).not.toHaveBeenCalled();
  });

  it("refuse de relâcher un participant d'un combat en cours", async () => {
    battleMocks.isPokemonInActiveBattle.mockReturnValue(true);
    await expect(
      releasePokemon("user-1", { expectedRevision: 4, pokemonId: "p2" }),
    ).rejects.toBeInstanceOf(TeamPokemonInBattleError);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.tx.userPokemon.deleteMany).not.toHaveBeenCalled();
  });
});
