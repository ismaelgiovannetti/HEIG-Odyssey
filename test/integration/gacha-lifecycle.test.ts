import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { executeGachaPull } from "@/lib/gacha/gacha-service";
import { prisma } from "@/lib/prisma";

const createdUserIds = new Set<string>();

function assertLocalDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL_MISSING_FOR_INTEGRATION_TEST");
  const hostname = new URL(databaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    throw new Error("INTEGRATION_DATABASE_MUST_BE_LOCAL");
  }
}

async function createFundedUser(): Promise<string> {
  assertLocalDatabase();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const userId = `integration-gacha-${suffix}`;
  await prisma.user.create({
    data: {
      id: userId,
      name: `gacha_${suffix}`,
      username: `gacha_${suffix}`,
      email: `gacha_${suffix}@example.test`,
      emailVerified: true,
      profile: {
        create: { hasCompletedOnboarding: true, pokedollars: 500 },
      },
    },
  });
  createdUserIds.add(userId);
  return userId;
}

afterEach(async () => {
  assertLocalDatabase();
  await prisma.user.deleteMany({ where: { id: { in: Array.from(createdUserIds) } } });
  createdUserIds.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("cycle de vie réel d'un tirage gacha", () => {
  it("débite une fois et crée une créature complète dans la première case du PC", async () => {
    const userId = await createFundedUser();
    const idempotencyKey = `gacha-${randomUUID()}`;

    const result = await executeGachaPull({
      userId,
      bannerId: "banner-standard",
      idempotencyKey,
    });
    const [profile, pokemon, pull] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.userPokemon.findMany({ where: { userId } }),
      prisma.gachaPull.findUnique({ where: { idempotencyKey } }),
    ]);

    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(200);
    expect(profile).toMatchObject({ pokedollars: 200, collectionRevision: 1 });
    expect(pokemon).toHaveLength(1);
    expect(pokemon[0]).toMatchObject({
      id: result.pokemon.id,
      teamPosition: null,
      boxNumber: 1,
      boxSlot: 1,
      level: 5,
      currentHp: result.pokemon.maxHp,
      isShiny: result.pokemon.isShiny,
      nature: result.pokemon.nature,
    });
    expect(Array.isArray(pokemon[0].moves)).toBe(true);
    expect(pokemon[0].moves).not.toHaveLength(0);
    expect(pull).toMatchObject({ userId, bannerId: "banner-standard", costPaid: 300 });

    const replay = await executeGachaPull({
      userId,
      bannerId: "banner-standard",
      idempotencyKey,
    });
    expect(replay.isCachedPull).toBe(true);
    expect(await prisma.userPokemon.count({ where: { userId } })).toBe(1);
    expect((await prisma.userProfile.findUnique({ where: { userId } }))?.pokedollars).toBe(200);
  });
});
