import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import { prisma } from "../../../src/lib/prisma";
import { calculateMaxHp } from "../../../src/lib/team/team-validator";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const E2E_PASSWORD = "MainLoop-E2E!2026";

export type BattleReadyTestUser = {
  id: string;
  email: string;
  username: string;
  pokemonId: string;
};

/** Même garde que les autres fixtures E2E : jamais sur une base distante. */
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
 * Crée un compte onboardé avec une équipe active d'un seul Pokémon délibérément
 * surpuissant (niveau 50, Tonnerre) : contre le premier dresseur de campagne
 * (Bidoof niveau 6, IA aléatoire), la victoire est écrasante et déterministe,
 * ce qui évite toute dépendance à l'aléatoire de l'IA pour vérifier le résultat
 * et les gains d'un combat dans la boucle principale.
 */
export async function createBattleReadyTestUser(): Promise<BattleReadyTestUser> {
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
          hasCompletedOnboarding: true,
          onboardingCompletedAt: new Date(),
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

  const maxHp = calculateMaxHp(35, 50, 31, 0);
  const pokemon = await prisma.userPokemon.create({
    data: {
      userId: id,
      speciesId: "pikachu",
      level: 50,
      experience: 0,
      currentHp: maxHp,
      maxHp,
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      moves: [
        {
          // Le nom affiché en combat est redérivé du Dex (anglais), pas de ce champ.
          id: "thunderbolt",
          name: "Thunderbolt",
          type: "Electric",
          category: "special",
          power: 90,
          accuracy: 100,
          pp: 15,
          maxPp: 15,
          priority: 0,
        },
      ],
      nature: "Hardy",
      gender: "M",
      isShiny: false,
      teamPosition: 1,
      boxNumber: null,
      boxSlot: null,
    },
  });

  return { id, email, username, pokemonId: pokemon.id };
}

/** La suppression du compte nettoie aussi son équipe grâce aux cascades Prisma. */
export async function deleteBattleReadyTestUser(
  user: BattleReadyTestUser | undefined,
): Promise<void> {
  if (!user) return;

  assertLocalDatabase();
  await prisma.user.deleteMany({ where: { id: user.id } });
}
