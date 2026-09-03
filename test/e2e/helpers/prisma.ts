import { PrismaClient } from "@prisma/client";

/** Client réservé aux fixtures E2E, indépendant des garde-fous Next.js. */
export const prisma = new PrismaClient({
  log: process.env.DEBUG_E2E_DATABASE ? ["query", "error", "warn"] : ["error"],
});
