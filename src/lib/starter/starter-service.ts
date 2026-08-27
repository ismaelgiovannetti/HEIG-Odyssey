import { prisma } from "../prisma";
import { loadStarters, getSpecies } from "../content/loader";
import { calculateMaxHp } from "../team/team-validator";

export interface StarterClaimResult {
  success: boolean;
  pokemon: {
    id: string;
    speciesId: string;
    name: string;
    level: number;
    currentHp: number;
    maxHp: number;
    teamPosition: number;
    moves: any;
    isShiny: boolean;
  };
  unlockedStageId: string;
}

export async function selectStarter(
  userId: string,
  speciesId: string,
  nickname?: string
): Promise<StarterClaimResult> {
  const starters = loadStarters();
  const starterConfig = starters.find((s) => s.speciesId === speciesId.toLowerCase());

  if (!starterConfig) {
    throw new Error(`La créature ${speciesId} n'est pas éligible comme starter gratuit.`);
  }

  const species = getSpecies(starterConfig.speciesId);
  if (!species) {
    throw new Error(`Données de l'espèce ${speciesId} introuvables.`);
  }

  const initialIvs = {
    hp: Math.floor(Math.random() * 16) + 16, // 16-31
    atk: Math.floor(Math.random() * 16) + 16,
    def: Math.floor(Math.random() * 16) + 16,
    spa: Math.floor(Math.random() * 16) + 16,
    spd: Math.floor(Math.random() * 16) + 16,
    spe: Math.floor(Math.random() * 16) + 16,
  };

  const initialEvs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const maxHp = calculateMaxHp(species.baseStats.hp, 5, initialIvs.hp, 0);

  // 1/512 shiny chance for starter recruitment
  const isShiny = Math.random() < 1 / 512;

  // Execute atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Verify user profile onboarding status
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

    // 2. Create or update UserProfile
    await tx.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        hasCompletedOnboarding: true,
        onboardingCompletedAt: new Date(),
        pokedollars: 100, // Initial balance
      },
      update: {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: new Date(),
      },
    });

    // 3. Create starter UserPokemon assigned to team slot 1
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
        moves: starterConfig.moves as any,
        ability: species.possibleAbilities[0] || "Overgrow",
        nature: "Hardy",
        gender: "GENDERLESS",
        isShiny,
        teamPosition: 1, // First active slot
      },
    });

    // 4. Unlock first campaign stage (Bachelor 1 - Stage 1)
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

  return result;
}
