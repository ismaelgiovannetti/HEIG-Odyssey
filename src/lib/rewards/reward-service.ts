import { prisma } from "../prisma";
import { loadCampaign, getSpecies } from "../content/loader";
import { calculateMaxHp } from "../team/team-validator";
import { BattleResult } from "@prisma/client";

export interface GrantBattleRewardsParams {
  userId: string;
  battleId: string;
  stageId: string;
  winner: "p1" | "p2";
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
  // Medium-Fast leveling curve approximation: (Level + 1)^3 - Level^3
  return Math.floor(Math.pow(currentLevel + 1, 3) - Math.pow(currentLevel, 3));
}

export async function grantBattleRewards({
  userId,
  battleId,
  stageId,
  winner,
}: GrantBattleRewardsParams): Promise<BattleRewardResult> {
  // 1. Check idempotency: if battleRecord already exists for this battleId
  const existingBattle = await prisma.battleRecord.findUnique({
    where: { idempotencyKey: battleId },
  });

  if (existingBattle) {
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

  // Find stage rewards and cross-world next stage in campaign configuration
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
      nextStageId = allStages[foundIdx + 1].id;
      nextWorldId = allStages[foundIdx + 1].worldId;
    }
  }

  const moneyReward = winner === "p1" ? stageConfig?.rewardMoney || 50 : 0;
  const xpReward = winner === "p1" ? stageConfig?.rewardXp || 100 : 0;

  return await prisma.$transaction(async (tx) => {
    // 1. Update User Profile balance
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

    // 2. Grant XP and level up player's active team
    if (winner === "p1" && xpReward > 0) {
      const activeTeam = await tx.userPokemon.findMany({
        where: { userId, teamPosition: { not: null } },
        orderBy: { teamPosition: "asc" },
      });

      // Distribute XP among conscious/active members
      const xpPerMember = Math.max(1, Math.floor(xpReward / Math.max(1, activeTeam.length)));

      for (const member of activeTeam) {
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
        const ivs = (member.ivs as any) || { hp: 15 };
        const newMaxHp = species
          ? calculateMaxHp(species.baseStats.hp, currentLevel, ivs.hp ?? 15, 0)
          : member.maxHp;

        // Restore some HP on level up or maintain ratio
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

    // 3. Update CampaignProgress
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

      // Unlock next stage if exists
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

    // 4. Record Battle in BattleRecord for strict idempotency
    await tx.battleRecord.create({
      data: {
        userId,
        battleType: "CAMPAIGN",
        opponentId: stageConfig?.trainerId || stageId,
        opponentTeamSnapshot: {},
        playerTeamSnapshot: {},
        idempotencyKey: battleId,
        result: winner === "p1" ? BattleResult.VICTORY : BattleResult.DEFEAT,
        turnsCount: 1,
        rewardsClaimed: true,
        moneyGained: moneyReward,
        xpGained: xpReward,
        completedAt: new Date(),
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
}
