import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPlayerCollection, updateActiveTeam, TeamRevisionConflictError, TeamCompositionInvalidError, TeamPokemonNotOwnedError } from "@/lib/team/team-service";
import { grantBattleRewards } from "@/lib/rewards/reward-service";

const createdUsers = new Set<string>();

// Les tests créent et suppriment leurs propres comptes, uniquement sur une base locale.
function assertLocalDatabase() {
  const value = process.env.DATABASE_URL;
  if (!value || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname)) {
    throw new Error("TEAM_INTEGRATION_DATABASE_MUST_BE_LOCAL");
  }
}

async function createCollection() {
  assertLocalDatabase();
  const userId = `integration-team-${randomUUID()}`;
  await prisma.user.create({ data: {
    id: userId, name: "Test équipe", email: `${userId}@example.test`, emailVerified: true,
    profile: { create: { hasCompletedOnboarding: true } },
  } });
  createdUsers.add(userId);
  const pokemon = [];
  // Un membre actif et deux créatures rangées constituent une collection minimale complète.
  for (let i = 0; i < 3; i++) {
    pokemon.push(await prisma.userPokemon.create({ data: {
      userId, speciesId: "turtwig", level: 5, currentHp: 21, maxHp: 21,
      ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, moves: [], nature: "Hardy",
      teamPosition: i === 0 ? 1 : null, boxNumber: i === 0 ? null : 1, boxSlot: i === 0 ? null : i,
    } }));
  }
  return { userId, pokemon };
}

async function readStoredState(userId: string) {
  return {
    profile: await prisma.userProfile.findUnique({ where: { userId } }),
    pokemon: await prisma.userPokemon.findMany({ where: { userId }, orderBy: { id: "asc" } }),
  };
}

afterEach(async () => {
  if (createdUsers.size === 0) return;
  assertLocalDatabase();
  await prisma.user.deleteMany({ where: { id: { in: [...createdUsers] } } });
  createdUsers.clear();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("persistance réelle de l'équipe et du PC", () => {
  it("sauvegarde les transferts et échanges, puis retrouve les mêmes cases après relecture", async () => {
    const { userId, pokemon: [a, b, c] } = await createCollection();
    const result = await updateActiveTeam(userId, {
      expectedRevision: 0, teamPokemonIds: [b.id],
      pcPlacements: [{ pokemonId: a.id, boxNumber: 15, boxSlot: 70 }, { pokemonId: c.id, boxNumber: 1, boxSlot: 1 }],
    });
    expect(result.revision).toBe(1);
    expect(result.team.map((p) => p.id)).toEqual([b.id]);
    expect(await getPlayerCollection(userId)).toEqual(result);

    // Un échange direct de deux cases du PC doit également préserver les deux créatures.
    await updateActiveTeam(userId, {
      expectedRevision: 1, teamPokemonIds: [b.id],
      pcPlacements: [{ pokemonId: a.id, boxNumber: 1, boxSlot: 1 }, { pokemonId: c.id, boxNumber: 15, boxSlot: 70 }],
    });
    const pcSwapped = await getPlayerCollection(userId);
    expect(pcSwapped.pokemon.find((p) => p.id === a.id)).toMatchObject({ boxNumber: 1, boxSlot: 1 });
    expect(pcSwapped.pokemon.find((p) => p.id === c.id)).toMatchObject({ boxNumber: 15, boxSlot: 70 });

    // L'échange de deux membres ne doit pas échouer sur une collision transitoire de cases.
    await updateActiveTeam(userId, { expectedRevision: 2, teamPokemonIds: [b.id, a.id] });
    const swapped = await updateActiveTeam(userId, { expectedRevision: 3, teamPokemonIds: [a.id, b.id] });
    expect(swapped.team.map((p) => p.id)).toEqual([a.id, b.id]);
    expect(swapped.count).toBe(3);
  });

  it("n'accepte qu'une sauvegarde pour deux onglets ayant la même version", async () => {
    const { userId, pokemon: [, b, c] } = await createCollection();
    const results = await Promise.allSettled([
      updateActiveTeam(userId, { expectedRevision: 0, teamPokemonIds: [b.id] }),
      updateActiveTeam(userId, { expectedRevision: 0, teamPokemonIds: [c.id] }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(TeamRevisionConflictError);
    const stored = await getPlayerCollection(userId);
    expect(stored.revision).toBe(1);
    expect(stored.team).toHaveLength(1);
    expect(stored.count).toBe(3);
    expect(stored.pokemon.filter((p) => p.boxNumber !== null)).toHaveLength(2);
  });

  it("refuse le rejeu exact d'une sauvegarde sans déplacer une deuxième fois les créatures", async () => {
    const { userId, pokemon: [, b] } = await createCollection();
    const input = { expectedRevision: 0, teamPokemonIds: [b.id] };
    const saved = await updateActiveTeam(userId, input);
    await expect(updateActiveTeam(userId, input)).rejects.toBeInstanceOf(TeamRevisionConflictError);
    expect(await getPlayerCollection(userId)).toEqual(saved);
  });

  it("ne perd aucune créature si une case est dupliquée ou si une créature étrangère est fournie", async () => {
    const { userId, pokemon: [a, b, c] } = await createCollection();
    const other = await createCollection();
    const before = await readStoredState(userId);
    await expect(updateActiveTeam(userId, {
      expectedRevision: 0, teamPokemonIds: [a.id],
      pcPlacements: [{ pokemonId: b.id, boxNumber: 1, boxSlot: 1 }, { pokemonId: c.id, boxNumber: 1, boxSlot: 1 }],
    })).rejects.toBeInstanceOf(TeamCompositionInvalidError);
    await expect(updateActiveTeam(userId, { expectedRevision: 0, teamPokemonIds: [other.pokemon[0].id] })).rejects.toBeInstanceOf(TeamPokemonNotOwnedError);
    expect(await readStoredState(userId)).toEqual(before);
  });

  it("annule aussi les écritures déjà effectuées si la préparation de la réponse échoue", async () => {
    const { userId, pokemon: [a, b] } = await createCollection();
    // Donnée volontairement corrompue dans CE compte de test : la réponse ne peut pas la sérialiser.
    await prisma.userPokemon.update({ where: { id: a.id }, data: { moves: { invalid: true } } });
    const before = await readStoredState(userId);
    await expect(updateActiveTeam(userId, { expectedRevision: 0, teamPokemonIds: [b.id] })).rejects.toThrow();
    expect(await readStoredState(userId)).toEqual(before);
  });

  it("la base refuse elle-même une double occupation et un emplacement hors limites", async () => {
    const { userId, pokemon: [, b] } = await createCollection();
    const before = await readStoredState(userId);
    await expect(prisma.userPokemon.update({ where: { id: b.id }, data: { teamPosition: 1, boxNumber: null, boxSlot: null } })).rejects.toThrow();
    await expect(prisma.userPokemon.update({ where: { id: b.id }, data: { boxNumber: 16 } })).rejects.toThrow();
    expect(await readStoredState(userId)).toEqual(before);
  });

  it("attribue l'XP au participant de départ même après son transfert dans le PC", async () => {
    const { userId, pokemon: [participant, replacement] } = await createCollection();
    const playerPokemonIds = [participant.id];
    await updateActiveTeam(userId, { expectedRevision: 0, teamPokemonIds: [replacement.id] });
    const battleId = `integration-battle-${randomUUID()}`;
    const rewards = await grantBattleRewards({ userId, battleId, stageId: "bachelor-1-stage-1", winner: "p1", playerPokemonIds });
    const updatedParticipant = await prisma.userPokemon.findUniqueOrThrow({ where: { id: participant.id } });
    const updatedReplacement = await prisma.userPokemon.findUniqueOrThrow({ where: { id: replacement.id } });
    expect(rewards.xpEarned).toBeGreaterThan(0);
    expect(updatedParticipant.teamPosition).toBeNull();
    expect(updatedParticipant.level > participant.level || updatedParticipant.experience > participant.experience).toBe(true);
    expect(updatedReplacement.experience).toBe(replacement.experience);
    expect(updatedReplacement.level).toBe(replacement.level);
    const record = await prisma.battleRecord.findUniqueOrThrow({ where: { idempotencyKey: battleId } });
    expect(record.playerTeamSnapshot).toEqual({ pokemonIds: playerPokemonIds });
  });

  it("annule les gains si la liste des participants contient une créature étrangère", async () => {
    const { userId } = await createCollection();
    const other = await createCollection();
    const before = await readStoredState(userId);
    const battleId = `integration-battle-${randomUUID()}`;
    await expect(grantBattleRewards({ userId, battleId, stageId: "bachelor-1-stage-1", winner: "p1", playerPokemonIds: [other.pokemon[0].id] })).rejects.toThrow("BATTLE_PARTICIPANTS_UNAVAILABLE");
    expect(await readStoredState(userId)).toEqual(before);
    expect(await prisma.battleRecord.findUnique({ where: { idempotencyKey: battleId } })).toBeNull();
  });
});
