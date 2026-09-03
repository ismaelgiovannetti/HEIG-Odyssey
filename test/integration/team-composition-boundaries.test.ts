import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getPlayerCollection,
  updateActiveTeam,
  TeamCompositionInvalidError,
  TeamPokemonNotOwnedError,
} from "@/lib/team/team-service";

const createdUsers = new Set<string>();

// Les tests créent et suppriment leurs propres comptes, uniquement sur une base locale.
function assertLocalDatabase() {
  const value = process.env.DATABASE_URL;
  if (
    !value ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname)
  ) {
    throw new Error("TEAM_INTEGRATION_DATABASE_MUST_BE_LOCAL");
  }
}

async function createCollection(pokemonCount = 3) {
  assertLocalDatabase();
  const userId = `integration-team-boundaries-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id: userId,
      name: "Test limites équipe",
      email: `${userId}@example.test`,
      emailVerified: true,
      profile: { create: { hasCompletedOnboarding: true } },
    },
  });
  createdUsers.add(userId);

  const pokemon = [];
  for (let i = 0; i < pokemonCount; i++) {
    pokemon.push(
      await prisma.userPokemon.create({
        data: {
          userId,
          speciesId: "turtwig",
          level: 5,
          currentHp: 21,
          maxHp: 21,
          ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
          evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
          moves: [],
          nature: "Hardy",
          teamPosition: null,
          boxNumber: 1,
          boxSlot: i + 1,
        },
      }),
    );
  }
  return { userId, pokemon };
}

async function readStoredState(userId: string) {
  return {
    profile: await prisma.userProfile.findUnique({ where: { userId } }),
    pokemon: await prisma.userPokemon.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    }),
  };
}

afterEach(async () => {
  if (createdUsers.size === 0) return;
  assertLocalDatabase();
  await prisma.user.deleteMany({ where: { id: { in: [...createdUsers] } } });
  createdUsers.clear();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("limites réelles de composition d'équipe (T-US05-04)", () => {
  it("refuse une équipe vide sans toucher la base", async () => {
    const { userId } = await createCollection();
    const before = await readStoredState(userId);

    await expect(
      updateActiveTeam(userId, { expectedRevision: 0, teamPokemonIds: [] }),
    ).rejects.toBeInstanceOf(TeamCompositionInvalidError);

    expect(await readStoredState(userId)).toEqual(before);
  });

  it("refuse une équipe de plus de six créatures réellement possédées sans toucher la base", async () => {
    const { userId, pokemon } = await createCollection(7);
    const before = await readStoredState(userId);

    await expect(
      updateActiveTeam(userId, {
        expectedRevision: 0,
        teamPokemonIds: pokemon.map((p) => p.id),
      }),
    ).rejects.toBeInstanceOf(TeamCompositionInvalidError);

    expect(await readStoredState(userId)).toEqual(before);
  });

  it("refuse une créature d'un autre joueur réel placée dans le PC sans toucher la base", async () => {
    const { userId, pokemon } = await createCollection(1);
    const other = await createCollection(1);
    const before = await readStoredState(userId);

    await expect(
      updateActiveTeam(userId, {
        expectedRevision: 0,
        teamPokemonIds: [pokemon[0].id],
        pcPlacements: [
          { pokemonId: other.pokemon[0].id, boxNumber: 1, boxSlot: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(TeamPokemonNotOwnedError);

    expect(await readStoredState(userId)).toEqual(before);
    // La créature de l'autre joueur ne doit elle non plus jamais avoir été déplacée.
    const otherAfter = await prisma.userPokemon.findUniqueOrThrow({
      where: { id: other.pokemon[0].id },
    });
    expect(otherAfter.teamPosition).toBeNull();
  });

  it("accepte et persiste une équipe de six créatures réellement possédées", async () => {
    const { userId, pokemon } = await createCollection(6);

    const result = await updateActiveTeam(userId, {
      expectedRevision: 0,
      teamPokemonIds: pokemon.map((p) => p.id),
    });

    expect(result.team).toHaveLength(6);
    const stored = await getPlayerCollection(userId);
    expect(stored.team).toHaveLength(6);
  });
});
