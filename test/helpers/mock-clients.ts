import type { Prisma, PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import type { Mock } from "vitest";

/**
 * Adapte un double de test partiel à l'interface Prisma attendue en production.
 * Le cast reste centralisé à la frontière du mock plutôt que dispersé dans les tests.
 */
export function asPrismaClient(client: object): PrismaClient {
  return client as unknown as PrismaClient;
}

/** Adapte un double de test partiel à un client de transaction Prisma. */
export function asPrismaTransactionClient(
  client: object,
): Prisma.TransactionClient {
  return client as unknown as Prisma.TransactionClient;
}

/** Adapte les seules commandes Redis simulées par un test au client de production. */
export function asRedisClient(client: object): Redis {
  return client as unknown as Redis;
}

type InteractiveTransaction = (
  callback: (
    transaction: Prisma.TransactionClient,
  ) => unknown | Promise<unknown>,
) => Promise<unknown>;

/** Branche un client Prisma simulé sur l'API de transaction interactive. */
export function mockInteractiveTransaction(
  client: PrismaClient,
  transactionClient: object,
): void {
  const transactionMock =
    client.$transaction as unknown as Mock<InteractiveTransaction>;
  transactionMock.mockImplementation(async (callback) =>
    callback(asPrismaTransactionClient(transactionClient)),
  );
}
