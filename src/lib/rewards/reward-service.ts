import "server-only";

import { prisma } from "../prisma";
import { loadCampaign, getSpecies } from "../content/loader";
import { calculateMaxHp } from "../team/team-validator";
import { BattleResult, OutboxStatus, type Prisma } from "@prisma/client";
import { snapshotBattleParticipants } from "../combat/battle-participants";
import {
  createDomainEvent,
  type BattleCompletedPayload,
} from "../events/contracts";
import { triggerOutboxFlush } from "../events/publisher";
import {
  calculateTrainingReward,
  type TrainingDifficulty,
} from "../training/difficulty";

export {
  calculateTrainingReward,
  calculateTrainingBaseXp,
  calculateDefeatedPokemonXp,
  DIFFICULTY_REWARD_MULTIPLIERS,
  DIFFICULTY_XP_MULTIPLIERS,
  TRAINING_BASE_REWARD,
} from "../training/difficulty";

export interface GrantBattleRewardsParams {
  userId: string;
  battleId: string;
  stageId: string;
  winner: "p1" | "p2";
  turnsCount?: number;
  // Identifiants capturés par le serveur au lancement, jamais par le navigateur.
  playerPokemonIds: readonly string[];
}

export interface BattleRewardResult {
  isAlreadyClaimed: boolean;
  moneyEarned: number;
  xpEarned: number;
  newBalance: number;
  stageCompleted: boolean;
  unlockedNextStageId: string | null;
  teamLeveledUp: Array<{
    pokemonId: string;
    speciesId: string;
    name: string;
    oldLevel: number;
    newLevel: number;
    newCurrentHp: number;
    newMaxHp: number;
  }>;
}

export function calculateXpForNextLevel(currentLevel: number): number {
  // Seuil de la courbe d'expérience moyenne : différence entre deux niveaux au cube.
  return Math.floor(Math.pow(currentLevel + 1, 3) - Math.pow(currentLevel, 3));
}

export async function grantBattleRewards({
  userId,
  battleId,
  stageId,
  winner,
  turnsCount = 1,
  playerPokemonIds,
}: GrantBattleRewardsParams): Promise<BattleRewardResult> {
  const participantIds = snapshotBattleParticipants(playerPokemonIds);
  // Un résultat déjà enregistré ne doit jamais attribuer de nouveaux gains.
  const existingBattle = await prisma.battleRecord.findUnique({
    where: { idempotencyKey: battleId },
  });

  if (existingBattle) {
    if (existingBattle.userId !== userId)
      throw new Error("BATTLE_REWARD_OWNER_MISMATCH");
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    return {
      isAlreadyClaimed: true,
      moneyEarned: existingBattle.moneyGained,
      xpEarned: existingBattle.xpGained,
      newBalance: profile?.pokedollars ?? 0,
      stageCompleted: existingBattle.result === BattleResult.VICTORY,
      unlockedNextStageId: null,
      teamLeveledUp: [],
    };
  }

  // La liste aplatie conserve le monde propriétaire de chaque étape : la
  // suivante peut ainsi appartenir au monde suivant sans perdre cette clé.
  const worlds = loadCampaign();
  const allStages = worlds.flatMap((w) =>
    w.stages.map((s) => ({ ...s, worldId: w.id })),
  );

  let stageConfig: (typeof allStages)[number] | null = null;
  let nextStageId: string | null = null;
  let nextWorldId: string = "bachelor-1";
  let worldId = "bachelor-1";

  const foundIdx = allStages.findIndex((s) => s.id === stageId);
  if (foundIdx !== -1) {
    stageConfig = allStages[foundIdx];
    worldId = stageConfig.worldId;
    if (foundIdx + 1 < allStages.length) {
      // L'ordre du contenu constitue l'unique ordre de progression, y compris
      // à la frontière entre deux mondes.
      nextStageId = allStages[foundIdx + 1].id;
      nextWorldId = allStages[foundIdx + 1].worldId;
    }
  }

  // Un appel interne ne peut pas transformer un identifiant inconnu en gains
  // de secours : le contenu de campagne validé reste la source de vérité.
  if (!stageConfig) {
    throw new Error("CAMPAIGN_STAGE_NOT_FOUND");
  }

  const moneyReward = winner === "p1" ? stageConfig.rewardMoney : 0;
  const xpReward = winner === "p1" ? stageConfig.rewardXp : 0;

  const txResult = await prisma.$transaction(async (tx) => {
    // Monnaie, expérience, progression et résultat font partie de la même transaction.
    const updatedProfile = await tx.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        pokedollars: moneyReward,
        hasCompletedOnboarding: true,
      },
      update: {
        pokedollars: { increment: moneyReward },
      },
    });

    const teamLeveledUp: BattleRewardResult["teamLeveledUp"] = [];

    // On retrouve les participants réels, même s'ils sont désormais rangés dans le PC.
    // Ce contrôle d'appartenance protège également les appels internes au service.
    const participants = await tx.userPokemon.findMany({
      where: { userId, id: { in: [...participantIds] } },
      orderBy: { id: "asc" },
    });
    if (participants.length !== participantIds.length)
      throw new Error("BATTLE_PARTICIPANTS_UNAVAILABLE");

    // Seuls ces participants reçoivent l'expérience, pas leurs éventuels remplaçants.
    if (winner === "p1" && xpReward > 0) {
      const xpPerMember = Math.max(
        1,
        Math.floor(xpReward / participants.length),
      );

      for (const member of participants) {
        let currentLevel = member.level;
        let currentExp = member.experience + xpPerMember;
        let leveledUp = false;

        while (currentLevel < 100) {
          const needed = calculateXpForNextLevel(currentLevel);
          if (currentExp >= needed) {
            currentExp -= needed;
            currentLevel += 1;
            leveledUp = true;
          } else {
            break;
          }
        }

        const species = getSpecies(member.speciesId);
        const ivs = member.ivs;
        const hpIv =
          ivs &&
          typeof ivs === "object" &&
          !Array.isArray(ivs) &&
          typeof ivs.hp === "number"
            ? ivs.hp
            : 15;
        const newMaxHp = species
          ? calculateMaxHp(species.baseStats.hp, currentLevel, hpIv, 0)
          : member.maxHp;

        // Le gain de PV maximum accompagne la montée de niveau.
        const newCurrentHp = Math.min(
          newMaxHp,
          member.currentHp + (newMaxHp - member.maxHp),
        );

        await tx.userPokemon.update({
          where: { id: member.id },
          data: {
            level: currentLevel,
            experience: currentExp,
            maxHp: newMaxHp,
            currentHp: Math.max(1, newCurrentHp),
          },
        });

        if (leveledUp) {
          teamLeveledUp.push({
            pokemonId: member.id,
            speciesId: member.speciesId,
            name: member.nickname || member.speciesId,
            oldLevel: member.level,
            newLevel: currentLevel,
            newCurrentHp,
            newMaxHp,
          });
        }
      }
    }

    // Une victoire valide termine l'étape et débloque la suivante.
    if (winner === "p1") {
      await tx.campaignProgress.upsert({
        where: {
          userId_stageId: {
            userId,
            stageId,
          },
        },
        create: {
          userId,
          worldId,
          stageId,
          isCompleted: true,
          firstClearedAt: new Date(),
        },
        update: {
          isCompleted: true,
          firstClearedAt: new Date(),
        },
      });

      // La dernière étape du monde n'a pas de successeur dans cette liste.
      if (nextStageId) {
        await tx.campaignProgress.upsert({
          where: {
            userId_stageId: {
              userId,
              stageId: nextStageId,
            },
          },
          create: {
            userId,
            worldId: nextWorldId,
            stageId: nextStageId,
            isCompleted: false,
          },
          update: {},
        });
      }
    }

    // La clé unique du combat empêche de valider deux attributions de gains.
    await tx.battleRecord.create({
      data: {
        userId,
        battleType: "CAMPAIGN",
        opponentId: stageConfig?.trainerId || stageId,
        opponentTeamSnapshot: {},
        playerTeamSnapshot: { pokemonIds: [...participantIds] },
        idempotencyKey: battleId,
        result: winner === "p1" ? BattleResult.VICTORY : BattleResult.DEFEAT,
        turnsCount,
        rewardsClaimed: true,
        moneyGained: moneyReward,
        xpGained: xpReward,
        completedAt: new Date(),
      },
    });

    // L'événement est enregistré dans l'Outbox avec les gains de la transaction.
    const battleEventPayload: BattleCompletedPayload = {
      userId,
      battleId,
      battleType: "CAMPAIGN",
      stageId,
      worldId,
      opponentId: stageConfig?.trainerId || stageId,
      result: winner === "p1" ? "VICTORY" : "DEFEAT",
      winner,
      turnsCount,
      xpGained: xpReward,
      moneyGained: moneyReward,
      playerPokemonIds: [...participantIds],
      playerTeamSpecies: participants.map((p) => p.speciesId),
    };

    const domainEvent = createDomainEvent({
      eventType: "battle.completed",
      aggregateType: "BATTLE",
      aggregateId: battleId,
      payload: battleEventPayload,
    });

    await tx.outboxEvent.create({
      data: {
        eventId: domainEvent.eventId,
        eventType: domainEvent.eventType,
        aggregateType: domainEvent.aggregateType,
        aggregateId: domainEvent.aggregateId,
        // Les métadonnées de l'enveloppe ont leurs propres colonnes Outbox.
        // Seul le payload est stocké pour éviter une double encapsulation à la publication.
        payload: domainEvent.payload as Prisma.InputJsonValue,
        status: OutboxStatus.PENDING,
      },
    });

    return {
      isAlreadyClaimed: false,
      moneyEarned: moneyReward,
      xpEarned: xpReward,
      newBalance: updatedProfile.pokedollars,
      stageCompleted: winner === "p1",
      unlockedNextStageId: nextStageId,
      teamLeveledUp,
    };
  });

  // La publication vers Redis démarre après la validation de la transaction.
  triggerOutboxFlush();

  return txResult;
}

export interface GrantTrainingRewardsParams {
  userId: string;
  battleId: string;
  difficulty: TrainingDifficulty;
  winner: "p1" | "p2";
  playerPokemonIds: readonly string[];
  turnsCount?: number;
  opponentTeam?: Array<{
    speciesId?: string;
    level: number;
    isFainted?: boolean;
  }>;
  opponentAverageLevel?: number;
}

/**
 * Attribue les récompenses pour un combat d'entraînement et émet training.completed.
 */
export async function grantTrainingRewards({
  userId,
  battleId,
  difficulty,
  winner,
  playerPokemonIds,
  turnsCount = 1,
  opponentTeam,
  opponentAverageLevel,
}: GrantTrainingRewardsParams): Promise<BattleRewardResult> {
  const participantIds = snapshotBattleParticipants(playerPokemonIds);

  const existingBattle = await prisma.battleRecord.findUnique({
    where: { idempotencyKey: battleId },
  });

  if (existingBattle) {
    if (existingBattle.userId !== userId)
      throw new Error("BATTLE_REWARD_OWNER_MISMATCH");
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    return {
      isAlreadyClaimed: true,
      moneyEarned: existingBattle.moneyGained,
      xpEarned: existingBattle.xpGained,
      newBalance: profile?.pokedollars || 0,
      stageCompleted: false,
      unlockedNextStageId: null,
      teamLeveledUp: [],
    };
  }

  const hydratedOpponents = opponentTeam?.map((p) => {
    const species = p.speciesId ? getSpecies(p.speciesId) : undefined;
    const bst = species
      ? species.baseStats.hp +
        species.baseStats.attack +
        species.baseStats.defense +
        species.baseStats.specialAttack +
        species.baseStats.specialDefense +
        species.baseStats.speed
      : undefined;
    return {
      level: p.level,
      stage: species?.stage,
      baseStatTotal: bst,
      isFainted: p.isFainted,
    };
  });

  const txResult = await prisma.$transaction(async (tx) => {
    const participants = await tx.userPokemon.findMany({
      where: {
        userId,
        id: { in: [...participantIds] },
      },
      orderBy: { id: "asc" },
    });

    if (participants.length !== participantIds.length) {
      throw new Error("BATTLE_REWARD_FOREIGN_PARTICIPANT");
    }

    let trainingOptions: Parameters<typeof calculateTrainingReward>[1];
    if (hydratedOpponents && hydratedOpponents.length > 0) {
      trainingOptions = { opponentTeam: hydratedOpponents };
    } else if (typeof opponentAverageLevel === "number") {
      trainingOptions = {
        opponentAverageLevel,
        teamSize: participantIds.length,
      };
    } else {
      const avgLvl =
        participants.length > 0
          ? Math.round(
              participants.reduce((sum, p) => sum + p.level, 0) /
                participants.length,
            )
          : 5;
      trainingOptions = {
        opponentAverageLevel: avgLvl,
        teamSize: participants.length,
      };
    }

    const reward = calculateTrainingReward(difficulty, trainingOptions);
    const moneyReward = winner === "p1" ? reward.money : 0;
    const xpReward = winner === "p1" ? reward.xp : 0;

    const teamLeveledUp: BattleRewardResult["teamLeveledUp"] = [];

    for (const pokemon of participants) {
      const species = getSpecies(pokemon.speciesId);
      if (!species) continue;

      let currentLvl = pokemon.level;
      let currentExp = pokemon.experience + xpReward;
      let leveledUp = false;

      while (currentLvl < 100) {
        const nextLevelThreshold = calculateXpForNextLevel(currentLvl);
        if (currentExp >= nextLevelThreshold) {
          currentExp -= nextLevelThreshold;
          currentLvl += 1;
          leveledUp = true;
        } else {
          break;
        }
      }

      const ivs = pokemon.ivs;
      const evs = pokemon.evs;
      const hpIv =
        ivs &&
        typeof ivs === "object" &&
        !Array.isArray(ivs) &&
        typeof ivs.hp === "number"
          ? ivs.hp
          : 15;
      const hpEv =
        evs &&
        typeof evs === "object" &&
        !Array.isArray(evs) &&
        typeof evs.hp === "number"
          ? evs.hp
          : 0;
      const newMax = calculateMaxHp(
        species.baseStats.hp,
        currentLvl,
        hpIv,
        hpEv,
      );

      if (leveledUp || xpReward > 0) {
        await tx.userPokemon.update({
          where: { id: pokemon.id },
          data: {
            level: currentLvl,
            experience: currentExp,
            maxHp: newMax,
            currentHp: newMax,
          },
        });
      }

      if (leveledUp) {
        teamLeveledUp.push({
          pokemonId: pokemon.id,
          speciesId: pokemon.speciesId,
          name: pokemon.nickname || species.name,
          oldLevel: pokemon.level,
          newLevel: currentLvl,
          newCurrentHp: newMax,
          newMaxHp: newMax,
        });
      }
    }

    const updatedProfile = await tx.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        pokedollars: moneyReward,
        hasCompletedOnboarding: true,
      },
      update: {
        pokedollars: { increment: moneyReward },
      },
    });

    await tx.battleRecord.create({
      data: {
        userId,
        battleType: "TRAINING",
        opponentId: `training-${difficulty}`,
        opponentTeamSnapshot: {},
        playerTeamSnapshot: { pokemonIds: [...participantIds] },
        idempotencyKey: battleId,
        result: winner === "p1" ? BattleResult.VICTORY : BattleResult.DEFEAT,
        turnsCount,
        rewardsClaimed: true,
        moneyGained: moneyReward,
        xpGained: xpReward,
        completedAt: new Date(),
      },
    });

    const trainingEventPayload = {
      userId,
      battleId,
      battleType: "TRAINING" as const,
      difficulty,
      opponentId: `training-${difficulty}`,
      result: (winner === "p1" ? "VICTORY" : "DEFEAT") as "VICTORY" | "DEFEAT",
      winner,
      turnsCount,
      xpGained: xpReward,
      moneyGained: moneyReward,
      playerPokemonIds: [...participantIds],
      playerTeamSpecies: participants.map((p) => p.speciesId),
    };

    const domainEvent = createDomainEvent({
      eventType: "training.completed",
      aggregateType: "TRAINING",
      aggregateId: battleId,
      payload: trainingEventPayload,
    });

    await tx.outboxEvent.create({
      data: {
        eventId: domainEvent.eventId,
        eventType: domainEvent.eventType,
        aggregateType: domainEvent.aggregateType,
        aggregateId: domainEvent.aggregateId,
        payload: domainEvent.payload as Prisma.InputJsonValue,
        status: OutboxStatus.PENDING,
      },
    });

    return {
      isAlreadyClaimed: false,
      moneyEarned: moneyReward,
      xpEarned: xpReward,
      newBalance: updatedProfile.pokedollars,
      stageCompleted: false,
      unlockedNextStageId: null,
      teamLeveledUp,
    };
  });

  triggerOutboxFlush();

  return txResult;
}
