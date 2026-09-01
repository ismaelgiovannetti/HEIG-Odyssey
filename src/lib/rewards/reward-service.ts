import { prisma } from "../prisma";
import { loadCampaign, getSpecies } from "../content/loader";
import { calculateMaxHp } from "../team/team-validator";
import { BattleResult, OutboxStatus, type Prisma } from "@prisma/client";
import type { CampaignStage } from "../content/schemas";
import { snapshotBattleParticipants } from "../combat/battle-participants";
import { createDomainEvent, type BattleCompletedPayload } from "../events/contracts";
import { triggerOutboxFlush } from "../events/publisher";

export interface GrantBattleRewardsParams {
  userId: string;
  battleId: string;
  stageId: string;
  winner: "p1" | "p2";
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
  playerPokemonIds,
}: GrantBattleRewardsParams): Promise<BattleRewardResult> {
  const participantIds = snapshotBattleParticipants(playerPokemonIds);
  // Un résultat déjà enregistré ne doit jamais attribuer de nouveaux gains.
  const existingBattle = await prisma.battleRecord.findUnique({
    where: { idempotencyKey: battleId },
  });

  if (existingBattle) {
    if (existingBattle.userId !== userId) throw new Error("BATTLE_REWARD_OWNER_MISMATCH");
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
    w.stages.map((s) => ({ ...s, worldId: w.id }))
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

  const moneyReward = winner === "p1" ? stageConfig?.rewardMoney || 50 : 0;
  const xpReward = winner === "p1" ? stageConfig?.rewardXp || 100 : 0;

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
    if (participants.length !== participantIds.length) throw new Error("BATTLE_PARTICIPANTS_UNAVAILABLE");

    // Seuls ces participants reçoivent l'expérience, pas leurs éventuels remplaçants.
    if (winner === "p1" && xpReward > 0) {
      const xpPerMember = Math.max(1, Math.floor(xpReward / participants.length));

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
        const hpIv = ivs && typeof ivs === "object" && !Array.isArray(ivs) && typeof ivs.hp === "number" ? ivs.hp : 15;
        const newMaxHp = species
          ? calculateMaxHp(species.baseStats.hp, currentLevel, hpIv, 0)
          : member.maxHp;

        // Le gain de PV maximum accompagne la montée de niveau.
        const newCurrentHp = Math.min(newMaxHp, member.currentHp + (newMaxHp - member.maxHp));

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
        turnsCount: 1,
        rewardsClaimed: true,
        moneyGained: moneyReward,
        xpGained: xpReward,
        completedAt: new Date(),
      },
    });

    // Enregistrement transactionnel de l'événement Outbox (T-US17-02)
    const battleEventPayload: BattleCompletedPayload = {
      userId,
      battleId,
      battleType: "CAMPAIGN",
      stageId,
      worldId,
      opponentId: stageConfig?.trainerId || stageId,
      result: winner === "p1" ? "VICTORY" : "DEFEAT",
      winner,
      turnsCount: 1,
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
        payload: domainEvent as unknown as Prisma.InputJsonValue,
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

  // Déclenchement de la publication vers Redis Streams (T-US17-03)
  triggerOutboxFlush();

  return txResult;
}

export interface GrantTrainingRewardsParams {
  userId: string;
  battleId: string;
  difficulty: "easy" | "normal" | "hard";
  winner: "p1" | "p2";
  playerPokemonIds: readonly string[];
  turnsCount?: number;
}

const TRAINING_REWARDS: Record<string, { money: number; xp: number }> = {
  easy: { money: 50, xp: 100 },
  normal: { money: 80, xp: 180 },
  hard: { money: 130, xp: 320 },
};

/**
 * Attribue les récompenses pour un combat d'entraînement et émet training.completed (T-US09-03).
 */
export async function grantTrainingRewards({
  userId,
  battleId,
  difficulty,
  winner,
  playerPokemonIds,
  turnsCount = 1,
}: GrantTrainingRewardsParams): Promise<BattleRewardResult> {
  const participantIds = snapshotBattleParticipants(playerPokemonIds);

  const existingBattle = await prisma.battleRecord.findUnique({
    where: { idempotencyKey: battleId },
  });

  if (existingBattle) {
    if (existingBattle.userId !== userId) throw new Error("BATTLE_REWARD_OWNER_MISMATCH");
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

  const baseReward = TRAINING_REWARDS[difficulty] || TRAINING_REWARDS.easy;
  const moneyReward = winner === "p1" ? baseReward.money : 0;
  const xpReward = winner === "p1" ? baseReward.xp : 0;

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

      const hpIv = (pokemon.ivs as any)?.hp || 15;
      const newMax = calculateMaxHp(species.baseStats.hp, hpIv, currentLvl);

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
        payload: domainEvent as unknown as Prisma.InputJsonValue,
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


