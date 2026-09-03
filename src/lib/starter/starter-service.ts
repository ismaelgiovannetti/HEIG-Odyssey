import "server-only";

import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { loadStarters, getSpecies } from "../content/loader";
import { calculateMaxHp } from "../team/team-validator";
import {
  StarterClaimResultSchema,
  type StarterClaimResult,
} from "./starter-contract";

export type { StarterClaimResult } from "./starter-contract";

export async function selectStarter(
  userId: string,
  speciesId: string,
  nickname?: string,
): Promise<StarterClaimResult> {
  const starters = loadStarters();
  const starterConfig = starters.find(
    (s) => s.speciesId === speciesId.toLowerCase(),
  );

  if (!starterConfig) {
    throw new Error(
      `La créature ${speciesId} n'est pas éligible comme starter gratuit.`,
    );
  }

  const species = getSpecies(starterConfig.speciesId);
  if (!species) {
    throw new Error(`Données de l'espèce ${speciesId} introuvables.`);
  }

  const initialIvs = {
    hp: randomInt(16, 32), // 16-31
    atk: randomInt(16, 32),
    def: randomInt(16, 32),
    spa: randomInt(16, 32),
    spd: randomInt(16, 32),
    spe: randomInt(16, 32),
  };

  const initialEvs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const maxHp = calculateMaxHp(species.baseStats.hp, 5, initialIvs.hp, 0);

  // Une créature de départ a une chance sur 512 d'être chromatique.
  const isShiny = randomInt(512) === 0;
  const persistedMoves: Prisma.InputJsonArray = starterConfig.moves.map(
    (move) => ({
      id: move.id,
      name: move.name,
      type: move.type,
      category: move.category,
      power: move.power,
      accuracy: move.accuracy,
      pp: move.pp,
      maxPp: move.maxPp,
      priority: move.priority,
      ...(move.description ? { description: move.description } : {}),
    }),
  );

  // Le profil, la créature et la première étape sont créés atomiquement.
  const result = await prisma.$transaction(async (tx) => {
    const existingProfile = await tx.userProfile.findUnique({
      where: { userId },
    });

    if (existingProfile?.hasCompletedOnboarding) {
      throw new Error("L'onboarding a déjà été complété pour ce compte.");
    }

    const existingPokemonCount = await tx.userPokemon.count({
      where: { userId },
    });

    if (existingPokemonCount > 0) {
      throw new Error("Ce joueur possède déjà des créatures.");
    }

    await tx.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        hasCompletedOnboarding: true,
        onboardingCompletedAt: new Date(),
        pokedollars: 100,
      },
      update: {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: new Date(),
      },
    });

    const createdPokemon = await tx.userPokemon.create({
      data: {
        userId,
        speciesId: starterConfig.speciesId,
        nickname: nickname?.trim() || starterConfig.name,
        level: 5,
        experience: 0,
        currentHp: maxHp,
        maxHp: maxHp,
        ivs: initialIvs,
        evs: initialEvs,
        moves: persistedMoves,
        ability: species.possibleAbilities[0] || "Overgrow",
        nature: "Hardy",
        gender: "GENDERLESS",
        isShiny,
        teamPosition: 1,
      },
    });

    await tx.campaignProgress.upsert({
      where: {
        userId_stageId: {
          userId,
          stageId: "bachelor-1-stage-1",
        },
      },
      create: {
        userId,
        worldId: "bachelor-1",
        stageId: "bachelor-1-stage-1",
        isCompleted: false,
      },
      update: {},
    });

    return {
      success: true,
      pokemon: {
        id: createdPokemon.id,
        speciesId: createdPokemon.speciesId,
        name: createdPokemon.nickname || starterConfig.name,
        level: createdPokemon.level,
        currentHp: createdPokemon.currentHp,
        maxHp: createdPokemon.maxHp,
        teamPosition: createdPokemon.teamPosition || 1,
        moves: createdPokemon.moves,
        isShiny: createdPokemon.isShiny,
      },
      unlockedStageId: "bachelor-1-stage-1",
    };
  });

  return StarterClaimResultSchema.parse(result);
}
