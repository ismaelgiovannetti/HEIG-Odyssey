import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  userCount: vi.fn(),
  userFindMany: vi.fn(),
  sessionGroupBy: vi.fn(),
  battleRecordCount: vi.fn(),
  battleRecordAggregate: vi.fn(),
  userProfileAggregate: vi.fn(),
  userPokemonCount: vi.fn(),
  userPokemonGroupBy: vi.fn(),
  gachaPullCount: vi.fn(),
  gachaPullAggregate: vi.fn(),
  gachaBannerFindMany: vi.fn(),
  campaignProgressGroupBy: vi.fn(),
  userQuestProgressCount: vi.fn(),
  outboxMessageCount: vi.fn(),
  processedDomainEventCount: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/loader", () => ({
  getSpecies: vi.fn((id: string) => ({ name: `Pokémon ${id}` })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      count: prismaMocks.userCount,
      findMany: prismaMocks.userFindMany,
    },
    session: {
      groupBy: prismaMocks.sessionGroupBy,
    },
    battleRecord: {
      count: prismaMocks.battleRecordCount,
      aggregate: prismaMocks.battleRecordAggregate,
    },
    userProfile: {
      aggregate: prismaMocks.userProfileAggregate,
    },
    userPokemon: {
      count: prismaMocks.userPokemonCount,
      groupBy: prismaMocks.userPokemonGroupBy,
    },
    gachaPull: {
      count: prismaMocks.gachaPullCount,
      aggregate: prismaMocks.gachaPullAggregate,
    },
    gachaBanner: {
      findMany: prismaMocks.gachaBannerFindMany,
    },
    campaignProgress: {
      groupBy: prismaMocks.campaignProgressGroupBy,
    },
    userQuestProgress: {
      count: prismaMocks.userQuestProgressCount,
    },
    outboxEvent: {
      count: prismaMocks.outboxMessageCount,
    },
    processedDomainEvent: {
      count: prismaMocks.processedDomainEventCount,
    },
  },
}));

import { fetchAdminDashboardData } from "@/lib/admin/admin-analytics-service";

describe("fetchAdminDashboardData", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Default mock returns
    prismaMocks.userCount.mockResolvedValue(10);
    prismaMocks.sessionGroupBy.mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" },
    ]);
    prismaMocks.battleRecordCount.mockResolvedValue(20);
    prismaMocks.battleRecordAggregate.mockResolvedValue({
      _sum: { moneyGained: 5000 },
      _avg: { turnsCount: 4.2 },
    });
    prismaMocks.userProfileAggregate.mockResolvedValue({
      _sum: { pokedollars: 15000 },
      _avg: { pokedollars: 1500 },
    });
    prismaMocks.userPokemonCount.mockResolvedValue(30);
    prismaMocks.userPokemonGroupBy.mockResolvedValue([
      { speciesId: "pikachu", _count: { speciesId: 5 } },
    ]);
    prismaMocks.gachaPullCount.mockResolvedValue(100);
    prismaMocks.gachaPullAggregate.mockResolvedValue({
      _sum: { costPaid: 10000 },
    });
    prismaMocks.gachaBannerFindMany.mockResolvedValue([
      { id: "standard", name: "Standard", _count: { pulls: 50 } },
    ]);
    prismaMocks.campaignProgressGroupBy.mockResolvedValue([
      { worldId: "world-1", stageId: "stage-1", _count: { stageId: 8 } },
    ]);
    prismaMocks.userQuestProgressCount.mockResolvedValue(15);
    prismaMocks.outboxMessageCount.mockResolvedValue(0);
    prismaMocks.processedDomainEventCount.mockResolvedValue(42);

    prismaMocks.userFindMany.mockResolvedValue([
      {
        id: "u1",
        name: "Ash",
        username: "ash_ketchum",
        email: "ash@example.com",
        role: "user",
        emailVerified: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        profile: { pokedollars: 2000, hasCompletedOnboarding: true },
        _count: { pokemon: 6, battles: 10 },
        pokemon: [
          {
            speciesId: "pikachu",
            level: 25,
            isShiny: false,
            currentHp: 60,
            maxHp: 60,
          },
        ],
      },
    ]);
  });

  it("calcule et assemble toutes les métriques du dashboard", async () => {
    const data = await fetchAdminDashboardData();

    expect(data.overview.totalUsers).toBe(10);
    expect(data.overview.activeUsers7d).toBe(2);
    expect(data.overview.totalPokemon).toBe(30);
    expect(data.overview.totalPulls).toBe(100);
    expect(data.combats.topTeamSpecies[0]).toEqual({
      speciesId: "pikachu",
      speciesName: "Pokémon pikachu",
      count: 5,
    });
    expect(data.players).toHaveLength(1);
    expect(data.players[0].name).toBe("Ash");
    expect(data.players[0].activeTeam[0]).toEqual({
      speciesId: "pikachu",
      speciesName: "Pokémon pikachu",
      level: 25,
      isShiny: false,
      currentHp: 60,
      maxHp: 60,
    });
    expect(data.system.processedDomainEvents).toBe(42);
  });
});
