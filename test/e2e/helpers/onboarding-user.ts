import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import { prisma } from "../../../src/lib/prisma";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const E2E_PASSWORD = "Onboarding-E2E!2026";

export type OnboardingTestUser = {
  id: string;
  email: string;
  username: string;
};

/**
 * Interdit la création de fixtures sur une base distante. Le test supprime son
 * utilisateur, mais cette garde protège tout de même une mauvaise configuration.
 */
function assertLocalDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL_MISSING_FOR_E2E");
  }

  const hostname = new URL(databaseUrl).hostname;
  if (!LOCAL_DATABASE_HOSTS.has(hostname)) {
    throw new Error("E2E_DATABASE_MUST_BE_LOCAL");
  }
}

/** Crée un compte vérifié sans déclencher l'envoi d'un e-mail réel. */
export async function createOnboardingTestUser(): Promise<OnboardingTestUser> {
  assertLocalDatabase();

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const id = `e2e-onboarding-${suffix}`;
  const username = `e2e_${suffix}`;
  const email = `${username}@example.test`;
  const password = await hashPassword(E2E_PASSWORD);

  await prisma.user.create({
    data: {
      id,
      name: username,
      username,
      email,
      emailVerified: true,
      profile: {
        create: {
          hasCompletedOnboarding: false,
        },
      },
      accounts: {
        create: {
          accountId: id,
          providerId: "credential",
          issuer: "local:credential",
          password,
        },
      },
    },
  });

  return { id, email, username };
}

/** La suppression du compte nettoie aussi ses données grâce aux cascades Prisma. */
export async function deleteOnboardingTestUser(
  user: OnboardingTestUser | undefined,
): Promise<void> {
  if (!user) return;

  assertLocalDatabase();
  await prisma.user.deleteMany({ where: { id: user.id } });
}
