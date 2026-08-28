import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { selectStarter } from "@/lib/starter/starter-service";

const createdUserIds = new Set<string>();

// Une faute de configuration ne doit jamais permettre à ce test destructif de
// créer puis supprimer un utilisateur sur une base distante.
function assertLocalDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL_MISSING_FOR_INTEGRATION_TEST");
  }

  const hostname = new URL(databaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    throw new Error("INTEGRATION_DATABASE_MUST_BE_LOCAL");
  }
}

async function createEligibleUser(): Promise<string> {
  assertLocalDatabase();

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const userId = `integration-onboarding-${suffix}`;

  await prisma.user.create({
    data: {
      id: userId,
      name: `integration_${suffix}`,
      username: `integration_${suffix}`,
      email: `integration_${suffix}@example.test`,
      emailVerified: true,
      profile: {
        create: { hasCompletedOnboarding: false },
      },
    },
  });
  createdUserIds.add(userId);

  return userId;
}

afterEach(async () => {
  assertLocalDatabase();
  await prisma.user.deleteMany({
    where: { id: { in: Array.from(createdUserIds) } },
  });
  createdUserIds.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("cycle de vie réel de l'onboarding", () => {
  it("crée atomiquement le profil terminé, le starter, l'équipe et la campagne", async () => {
    const userId = await createEligibleUser();

    const result = await selectStarter(userId, "turtwig", "Torti");
    const [profile, team, progress] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.userPokemon.findMany({ where: { userId } }),
      prisma.campaignProgress.findMany({ where: { userId } }),
    ]);

    expect(result.success).toBe(true);
    expect(result.unlockedStageId).toBe("bachelor-1-stage-1");
    expect(profile?.hasCompletedOnboarding).toBe(true);
    expect(profile?.onboardingCompletedAt).not.toBeNull();
    expect(team).toHaveLength(1);
    expect(team[0]).toMatchObject({
      speciesId: "turtwig",
      nickname: "Torti",
      level: 5,
      experience: 0,
      teamPosition: 1,
    });
    expect(progress).toEqual([
      expect.objectContaining({
        worldId: "bachelor-1",
        stageId: "bachelor-1-stage-1",
        isCompleted: false,
      }),
    ]);
  });

  it("refuse un rejeu séquentiel sans modifier l'équipe initiale", async () => {
    const userId = await createEligibleUser();

    await selectStarter(userId, "piplup");
    await expect(selectStarter(userId, "chimchar")).rejects.toThrow(
      "L'onboarding a déjà été complété",
    );

    const [pokemonCount, stageCount] = await Promise.all([
      prisma.userPokemon.count({ where: { userId } }),
      prisma.campaignProgress.count({ where: { userId } }),
    ]);

    expect(pokemonCount).toBe(1);
    expect(stageCount).toBe(1);
  });
});
