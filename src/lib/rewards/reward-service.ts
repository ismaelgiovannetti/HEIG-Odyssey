import { prisma } from "../prisma";
import { loadCampaign, getSpecies } from "../content/loader";
import { calculateMaxHp } from "../team/team-validator";
import { BattleResult } from "@prisma/client";
import type { CampaignStage } from "../content/schemas";
import { snapshotBattleParticipants } from "../combat/battle-participants";

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

  // Les gains sont lus dans le contenu serveur, pas dans la requête du joueur.
  const worlds = loadCampaign();
  let stageConfig: CampaignStage | null = null;
  let nextStageId: string | null = null;
  let worldId = "bachelor-1";

  for (const world of worlds) {
    const foundIdx = world.stages.findIndex((s) => s.id === stageId);
    if (foundIdx !== -1) {
      stageConfig = world.stages[foundIdx];
      worldId = world.id;
      if (foundIdx + 1 < world.stages.length) {
        nextStageId = world.stages[foundIdx + 1].id;
      }
      break;
    }
  }

  const moneyReward = winner === "p1" ? stageConfig?.rewardMoney || 50 : 0;
  const xpReward = winner === "p1" ? stageConfig?.rewardXp || 100 : 0;

  return await prisma.$transaction(async (tx) => {
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
            worldId,
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
