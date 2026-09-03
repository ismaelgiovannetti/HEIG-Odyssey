import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import { prisma } from "./prisma";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const E2E_PASSWORD = "Onboarding-E2E!2026";

export type OnboardingTestUser = {
  id: string;
  email: string;
  username: string;
};

// Les deux parcours utilisent la même identité ; seul l'état du profil varie.
export type ApplicationTestUser = OnboardingTestUser;

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

/**
 * Crée le socle commun d'un compte E2E vérifié sans envoyer d'e-mail réel.
 * Le booléen d'onboarding permet de tester aussi bien le premier lancement que
 * les pages privées d'un joueur déjà initialisé.
 */
async function createTestUser(
  hasCompletedOnboarding: boolean,
): Promise<OnboardingTestUser> {
  assertLocalDatabase();

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const id = `e2e-player-${suffix}`;
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
          hasCompletedOnboarding,
          onboardingCompletedAt: hasCompletedOnboarding ? new Date() : null,
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

/** Crée un compte vérifié qui doit encore effectuer son premier recrutement. */
export async function createOnboardingTestUser(): Promise<OnboardingTestUser> {
  return createTestUser(false);
}

/**
 * Crée le profil minimal nécessaire au shell. L'équipe n'est volontairement
 * pas injectée afin que ce test de navigation reste indépendant du domaine.
 */
export async function createApplicationTestUser(): Promise<ApplicationTestUser> {
  return createTestUser(true);
}

/** La suppression du compte nettoie aussi ses données grâce aux cascades Prisma. */
export async function deleteOnboardingTestUser(
  user: OnboardingTestUser | undefined,
): Promise<void> {
  if (!user) return;

  assertLocalDatabase();
  await prisma.user.deleteMany({ where: { id: user.id } });
}

/** Alias explicite utilisé par les tests du shell applicatif. */
export async function deleteApplicationTestUser(
  user: ApplicationTestUser | undefined,
): Promise<void> {
  return deleteOnboardingTestUser(user);
}
