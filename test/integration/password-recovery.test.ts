import { randomUUID } from "node:crypto";

import { hashPassword, verifyPassword } from "better-auth/crypto";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// L'e-mail est capturé en mémoire : l'intégration vérifie Better Auth et
// PostgreSQL sans envoyer de vrai message ni dépendre de Resend.
const emailMocks = vi.hoisted(() => ({
  deliverPasswordResetEmail: vi.fn(),
}));

vi.hoisted(() => {
  // Le test ne doit dépendre d'aucun secret réel. Ces valeurs servent seulement
  // à initialiser Better Auth sur l'origine locale de la base d'intégration.
  process.env.BETTER_AUTH_SECRET ??=
    "integration-only-auth-secret-at-least-32-characters";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
});

vi.mock("@/lib/email/password-reset-email", () => ({
  deliverPasswordResetEmail: emailMocks.deliverPasswordResetEmail,
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ORIGINAL_PASSWORD = "OriginalPassword!2026";
const NEW_PASSWORD = "FreshPassword!2026";
const createdUserIds = new Set<string>();

type RecoveryTestUser = {
  id: string;
  email: string;
};

// Ces tests créent puis effacent des comptes : cette garde interdit toute
// exécution accidentelle contre PostgreSQL de préproduction ou de production.
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

async function createRecoveryTestUser(): Promise<RecoveryTestUser> {
  assertLocalDatabase();

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const id = `integration-recovery-${suffix}`;
  const email = `recovery_${suffix}@example.test`;
  const password = await hashPassword(ORIGINAL_PASSWORD);

  await prisma.user.create({
    data: {
      id,
      name: `recovery_${suffix}`,
      username: `recovery_${suffix}`,
      email,
      emailVerified: true,
      profile: { create: {} },
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
  createdUserIds.add(id);

  return { id, email };
}

async function requestRecovery(email: string) {
  return auth.api.requestPasswordReset({
    body: { email, redirectTo: "/reset-password" },
  });
}

function getDeliveredToken(): string {
  const lastCall = emailMocks.deliverPasswordResetEmail.mock.lastCall;
  const resetUrl = lastCall?.[0]?.resetUrl;

  if (typeof resetUrl !== "string") {
    throw new Error("PASSWORD_RESET_EMAIL_NOT_CAPTURED");
  }

  const pathSegments = new URL(resetUrl).pathname.split("/");
  const token = pathSegments.at(-1);

  if (!token) {
    throw new Error("PASSWORD_RESET_TOKEN_NOT_FOUND");
  }

  return token;
}

async function getCredentialPassword(userId: string): Promise<string> {
  const account = await prisma.account.findFirstOrThrow({
    where: { userId, providerId: "credential" },
    select: { password: true },
  });

  if (!account.password) {
    throw new Error("CREDENTIAL_PASSWORD_NOT_FOUND");
  }

  return account.password;
}

beforeEach(() => {
  vi.resetAllMocks();
  emailMocks.deliverPasswordResetEmail.mockResolvedValue(undefined);
});

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

describe("récupération réelle du compte", () => {
  it("renvoie la même réponse pour une adresse connue ou inconnue", async () => {
    const user = await createRecoveryTestUser();

    const knownResponse = await requestRecovery(user.email);
    const unknownResponse = await requestRecovery(
      `absent-${randomUUID()}@example.test`,
    );

    expect(unknownResponse).toEqual(knownResponse);
    expect(emailMocks.deliverPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it("refuse un jeton expiré sans modifier le mot de passe", async () => {
    const user = await createRecoveryTestUser();
    await requestRecovery(user.email);
    const token = getDeliveredToken();

    // Simule le passage du temps sans ralentir la suite de tests.
    await prisma.verification.updateMany({
      where: { identifier: `reset-password:${token}` },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await expect(
      auth.api.resetPassword({ body: { token, newPassword: NEW_PASSWORD } }),
    ).rejects.toThrow();

    const storedPassword = await getCredentialPassword(user.id);
    expect(
      await verifyPassword({
        hash: storedPassword,
        password: ORIGINAL_PASSWORD,
      }),
    ).toBe(true);
    expect(
      await verifyPassword({ hash: storedPassword, password: NEW_PASSWORD }),
    ).toBe(false);
  });

  it("consomme le jeton une seule fois et révoque les sessions existantes", async () => {
    const user = await createRecoveryTestUser();
    await prisma.session.create({
      data: {
        userId: user.id,
        token: `session-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await requestRecovery(user.email);
    const token = getDeliveredToken();

    await expect(
      auth.api.resetPassword({ body: { token, newPassword: NEW_PASSWORD } }),
    ).resolves.toMatchObject({ status: true });
    await expect(
      auth.api.resetPassword({ body: { token, newPassword: NEW_PASSWORD } }),
    ).rejects.toThrow();

    const storedPassword = await getCredentialPassword(user.id);
    expect(
      await verifyPassword({ hash: storedPassword, password: NEW_PASSWORD }),
    ).toBe(true);
    expect(
      await verifyPassword({
        hash: storedPassword,
        password: ORIGINAL_PASSWORD,
      }),
    ).toBe(false);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refuse un mot de passe faible sans consommer le jeton valable", async () => {
    const user = await createRecoveryTestUser();
    await requestRecovery(user.email);
    const token = getDeliveredToken();

    await expect(
      auth.api.resetPassword({
        body: { token, newPassword: "motdepassefaible" },
      }),
    ).rejects.toThrow();

    await expect(
      auth.api.resetPassword({ body: { token, newPassword: NEW_PASSWORD } }),
    ).resolves.toMatchObject({ status: true });
  });
});
