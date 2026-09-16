import "server-only";

import { prisma } from "@/lib/prisma";
import { getSpecies } from "@/lib/content/loader";

export interface AdminKpiOverview {
  totalUsers: number;
  verifiedUsers: number;
  adminCount: number;
  activeUsers7d: number;
  totalBattles: number;
  battlesWon: number;
  battlesDefeat: number;
  battlesEscaped: number;
  globalWinRate: number;
  totalPokedollars: number;
  avgPokedollars: number;
  totalPokemon: number;
  totalShinies: number;
  totalPulls: number;
  totalPullsShinies: number;
  observedShinyRate: number;
}

export interface AdminCombatStats {
  campaignBattles: number;
  trainingBattles: number;
  avgTurns: number;
  topTeamSpecies: { speciesId: string; speciesName: string; count: number }[];
  campaignStageCompletions: {
    worldId: string;
    stageId: string;
    count: number;
  }[];
}

export interface AdminGachaStats {
  totalPulls: number;
  totalShiniesPulls: number;
  observedShinyRate: number;
  totalSpentPokedollars: number;
  totalEarnedBattlePokedollars: number;
  bannerBreakdown: {
    bannerId: string;
    bannerName: string;
    totalPulls: number;
    shinyCount: number;
  }[];
}

export interface AdminQuestsStats {
  totalAssigned: number;
  totalCompleted: number;
  totalClaimed: number;
  completionRate: number;
}

export interface AdminSystemStats {
  outboxPending: number;
  outboxPublished: number;
  outboxFailed: number;
  processedDomainEvents: number;
}

export interface AdminPlayerItem {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  pokedollars: number;
  hasCompletedOnboarding: boolean;
  pokemonCount: number;
  shinyCount: number;
  battlesTotal: number;
  battlesWon: number;
  winRate: number;
  activeTeam: {
    speciesId: string;
    speciesName: string;
    level: number;
    isShiny: boolean;
    currentHp: number;
    maxHp: number;
  }[];
}

export interface AdminDashboardData {
  overview: AdminKpiOverview;
  combats: AdminCombatStats;
  gacha: AdminGachaStats;
  quests: AdminQuestsStats;
  system: AdminSystemStats;
  players: AdminPlayerItem[];
  generatedAt: string;
}

export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Overview & Users KPIs
  const [
    totalUsers,
    verifiedUsers,
    adminCount,
    activeSessions,
    totalBattles,
    battlesWon,
    battlesDefeat,
    battlesEscaped,
    pokedollarsAggregate,
    totalPokemon,
    totalShinies,
    totalPulls,
    totalPullsShinies,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.session.groupBy({
      by: ["userId"],
      where: { updatedAt: { gte: sevenDaysAgo } },
    }),
    prisma.battleRecord.count(),
    prisma.battleRecord.count({ where: { result: "VICTORY" } }),
    prisma.battleRecord.count({ where: { result: "DEFEAT" } }),
    prisma.battleRecord.count({ where: { result: "ESCAPED" } }),
    prisma.userProfile.aggregate({
      _sum: { pokedollars: true },
      _avg: { pokedollars: true },
    }),
    prisma.userPokemon.count(),
    prisma.userPokemon.count({ where: { isShiny: true } }),
    prisma.gachaPull.count(),
    prisma.gachaPull.count({ where: { isShiny: true } }),
  ]);

  const finishedBattles = battlesWon + battlesDefeat + battlesEscaped;
  const globalWinRate =
    finishedBattles > 0 ? Math.round((battlesWon / finishedBattles) * 100) : 0;
  const totalPokedollars = pokedollarsAggregate._sum.pokedollars ?? 0;
  const avgPokedollars = Math.round(pokedollarsAggregate._avg.pokedollars ?? 0);
  const observedShinyRate =
    totalPulls > 0
      ? Number(((totalPullsShinies / totalPulls) * 100).toFixed(2))
      : 1.0;

  const overview: AdminKpiOverview = {
    totalUsers,
    verifiedUsers,
    adminCount,
    activeUsers7d: activeSessions.length,
    totalBattles,
    battlesWon,
    battlesDefeat,
    battlesEscaped,
    globalWinRate,
    totalPokedollars,
    avgPokedollars,
    totalPokemon,
    totalShinies,
    totalPulls,
    totalPullsShinies,
    observedShinyRate,
  };

  // 2. Combat & Campaign Stats
  const [
    campaignBattles,
    trainingBattles,
    turnsAggregate,
    topTeamPokemon,
    campaignProgressStages,
  ] = await Promise.all([
    prisma.battleRecord.count({ where: { battleType: "CAMPAIGN" } }),
    prisma.battleRecord.count({ where: { battleType: "TRAINING" } }),
    prisma.battleRecord.aggregate({
      _avg: { turnsCount: true },
      where: { turnsCount: { gt: 0 } },
    }),
    prisma.userPokemon.groupBy({
      by: ["speciesId"],
      where: { teamPosition: { not: null } },
      _count: { speciesId: true },
      orderBy: { _count: { speciesId: "desc" } },
      take: 6,
    }),
    prisma.campaignProgress.groupBy({
      by: ["worldId", "stageId"],
      where: { isCompleted: true },
      _count: { stageId: true },
    }),
  ]);

  const combats: AdminCombatStats = {
    campaignBattles,
    trainingBattles,
    avgTurns: Math.round(turnsAggregate._avg.turnsCount ?? 0),
    topTeamSpecies: topTeamPokemon.map((item) => ({
      speciesId: item.speciesId,
      speciesName: getSpecies(item.speciesId)?.name ?? item.speciesId,
      count: item._count.speciesId,
    })),
    campaignStageCompletions: campaignProgressStages.map((s) => ({
      worldId: s.worldId,
      stageId: s.stageId,
      count: s._count.stageId,
    })),
  };

  // 3. Gacha & Economy Stats
  const [pullsAggregate, battleMoneyAggregate, bannerList] = await Promise.all([
    prisma.gachaPull.aggregate({
      _sum: { costPaid: true },
    }),
    prisma.battleRecord.aggregate({
      _sum: { moneyGained: true },
    }),
    prisma.gachaBanner.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { pulls: true } },
      },
    }),
  ]);

  const bannerBreakdown = await Promise.all(
    bannerList.map(async (banner) => {
      const shinyCount = await prisma.gachaPull.count({
        where: { bannerId: banner.id, isShiny: true },
      });
      return {
        bannerId: banner.id,
        bannerName: banner.name,
        totalPulls: banner._count.pulls,
        shinyCount,
      };
    }),
  );

  const gacha: AdminGachaStats = {
    totalPulls,
    totalShiniesPulls: totalPullsShinies,
    observedShinyRate,
    totalSpentPokedollars: pullsAggregate._sum.costPaid ?? 0,
    totalEarnedBattlePokedollars: battleMoneyAggregate._sum.moneyGained ?? 0,
    bannerBreakdown,
  };

  // 4. Quests Stats
  const [totalAssigned, totalCompleted, totalClaimed] = await Promise.all([
    prisma.userQuestProgress.count(),
    prisma.userQuestProgress.count({ where: { isCompleted: true } }),
    prisma.userQuestProgress.count({ where: { rewardClaimed: true } }),
  ]);

  const quests: AdminQuestsStats = {
    totalAssigned,
    totalCompleted,
    totalClaimed,
    completionRate:
      totalAssigned > 0
        ? Math.round((totalCompleted / totalAssigned) * 100)
        : 0,
  };

  // 5. System Outbox Stats
  const [outboxPending, outboxPublished, outboxFailed, processedDomainEvents] =
    await Promise.all([
      prisma.outboxEvent.count({ where: { status: "PENDING" } }),
      prisma.outboxEvent.count({ where: { status: "PUBLISHED" } }),
      prisma.outboxEvent.count({ where: { status: "FAILED" } }),
      prisma.processedDomainEvent.count(),
    ]);

  const system: AdminSystemStats = {
    outboxPending,
    outboxPublished,
    outboxFailed,
    processedDomainEvents,
  };

  // 6. Players List (Limit to 100 most recent for performance)
  const users = await prisma.user.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      profile: {
        select: {
          pokedollars: true,
          hasCompletedOnboarding: true,
        },
      },
      _count: {
        select: {
          pokemon: true,
          battles: true,
        },
      },
      pokemon: {
        where: { teamPosition: { not: null } },
        orderBy: { teamPosition: "asc" },
        select: {
          speciesId: true,
          level: true,
          isShiny: true,
          currentHp: true,
          maxHp: true,
        },
      },
    },
  });

  const players: AdminPlayerItem[] = await Promise.all(
    users.map(async (u) => {
      const [shinyCount, victoriesCount] = await Promise.all([
        prisma.userPokemon.count({
          where: { userId: u.id, isShiny: true },
        }),
        prisma.battleRecord.count({
          where: { userId: u.id, result: "VICTORY" },
        }),
      ]);

      const battlesTotal = u._count.battles;
      const winRate =
        battlesTotal > 0
          ? Math.round((victoriesCount / battlesTotal) * 100)
          : 0;

      return {
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt.toISOString(),
        pokedollars: u.profile?.pokedollars ?? 0,
        hasCompletedOnboarding: u.profile?.hasCompletedOnboarding ?? false,
        pokemonCount: u._count.pokemon,
        shinyCount,
        battlesTotal,
        battlesWon: victoriesCount,
        winRate,
        activeTeam: u.pokemon.map((p) => ({
          speciesId: p.speciesId,
          speciesName: getSpecies(p.speciesId)?.name ?? p.speciesId,
          level: p.level,
          isShiny: p.isShiny,
          currentHp: p.currentHp,
          maxHp: p.maxHp,
        })),
      };
    }),
  );

  return {
    overview,
    combats,
    gacha,
    quests,
    system,
    players,
    generatedAt: new Date().toISOString(),
  };
}
