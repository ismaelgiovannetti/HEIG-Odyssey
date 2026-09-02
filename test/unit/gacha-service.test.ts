import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  determineSpeciesRarity,
  rollGachaPull,
  executeGachaPull,
  GachaIdempotencyConflictError,
  GachaPcFullError,
  InsufficientFundsError,
  BannerNotFoundError,
} from "@/lib/gacha/gacha-service";
import type { GachaBannerConfig, Species } from "@/lib/content/schemas";

describe("Gacha Service & Probabilities (T-US12-01, T-US12-02, T-US12-04)", () => {
  const mockBanner: GachaBannerConfig = {
    id: "banner-test",
    name: "Portail Test",
    description: "Bannière de test",
    costPokedollars: 100,
    rates: {
      common: 0.70,
      rare: 0.25,
      epic: 0.05,
      shinyRate: 0.01,
    },
    poolSpecies: ["starly", "turtwig", "garchomp"],
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("determineSpeciesRarity (T-US12-01)", () => {
    it("classe correctement les créatures communes, rares et épiques", () => {
      const commonSpecies: Species = {
        id: "starly",
        dexNumber: 396,
        name: "Étourmi",
        generation: 4,
        types: ["Normal", "Flying"],
        baseStats: { hp: 40, attack: 55, defense: 30, specialAttack: 30, specialDefense: 30, speed: 60 },
        stage: 1,
        isLegendary: false,
        isMythical: false,
        isStarterEligible: false,
        defaultMoves: ["tackle"],
        possibleAbilities: ["Keen Eye"],
      };

      const rareStarter: Species = {
        id: "turtwig",
        dexNumber: 387,
        name: "Tortipouss",
        generation: 4,
        types: ["Grass"],
        baseStats: { hp: 55, attack: 68, defense: 64, specialAttack: 45, specialDefense: 55, speed: 31 },
        stage: 1,
        isLegendary: false,
        isMythical: false,
        isStarterEligible: true,
        defaultMoves: ["tackle"],
        possibleAbilities: ["Overgrow"],
      };

      const epicSpecies: Species = {
        id: "garchomp",
        dexNumber: 445,
        name: "Carchacrok",
        generation: 4,
        types: ["Dragon", "Ground"],
        baseStats: { hp: 108, attack: 130, defense: 95, specialAttack: 80, specialDefense: 85, speed: 102 },
        stage: 3,
        isLegendary: false,
        isMythical: false,
        isStarterEligible: false,
        defaultMoves: ["dragonclaw"],
        possibleAbilities: ["Sand Veil"],
      };

      expect(determineSpeciesRarity(commonSpecies)).toBe("COMMON");
      expect(determineSpeciesRarity(rareStarter)).toBe("RARE");
      expect(determineSpeciesRarity(epicSpecies)).toBe("EPIC");
    });
  });

  describe("Distribution statistique du tirage pondéré (T-US12-04)", () => {
    it("respecte les probabilités configurées sur 10 000 tirages", () => {
      const counts = { COMMON: 0, RARE: 0, EPIC: 0, SHINY: 0 };
      const TOTAL_SIMULATIONS = 10000;

      for (let i = 0; i < TOTAL_SIMULATIONS; i++) {
        const pull = rollGachaPull(mockBanner);
        counts[pull.rarity]++;
        if (pull.isShiny) counts.SHINY++;
      }

      const commonPercent = counts.COMMON / TOTAL_SIMULATIONS;
      const rarePercent = counts.RARE / TOTAL_SIMULATIONS;
      const epicPercent = counts.EPIC / TOTAL_SIMULATIONS;
      const shinyPercent = counts.SHINY / TOTAL_SIMULATIONS;

      // Tolérance statistique ± 3%
      expect(commonPercent).toBeGreaterThan(0.66);
      expect(commonPercent).toBeLessThan(0.74);

      expect(rarePercent).toBeGreaterThan(0.21);
      expect(rarePercent).toBeLessThan(0.29);

      expect(epicPercent).toBeGreaterThan(0.03);
      expect(epicPercent).toBeLessThan(0.07);

      expect(shinyPercent).toBeGreaterThan(0.005);
      expect(shinyPercent).toBeLessThan(0.02);
    });
  });

  describe("executeGachaPull - Transaction et Solde (T-US12-02, T-US12-04)", () => {
    it("refuse le tirage si le solde de Pokédollars est insuffisant", async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "profile-poor" }]),
        userProfile: {
          findUnique: vi.fn().mockResolvedValue({ userId: "user-poor", pokedollars: 50 }),
        },
      };
      const mockPrisma = {
        gachaPull: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      await expect(
        executeGachaPull(
          { userId: "user-poor", bannerId: "banner-standard" },
          mockPrisma as any
        )
      ).rejects.toThrow(InsufficientFundsError);
    });

    it("débite le solde, enregistre la créature dans le PC et trace le GachaPull", async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "profile-1" }]),
        userProfile: {
          findUnique: vi.fn().mockResolvedValue({ userId: "user-1", pokedollars: 500 }),
          update: vi.fn().mockResolvedValue({ pokedollars: 200 }),
        },
        userPokemon: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockResolvedValue({ id: "new-pkmn-123" }),
        },
        gachaBanner: {
          upsert: vi.fn().mockResolvedValue({ id: "banner-standard" }),
        },
        gachaPull: {
          create: vi.fn().mockResolvedValue({ id: "pull-rec-123" }),
        },
      };

      const mockPrisma = {
        gachaPull: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      const result = await executeGachaPull(
        { userId: "user-1", bannerId: "banner-standard" },
        mockPrisma as any
      );

      expect(result.success).toBe(true);
      expect(result.pullId).toBe("pull-rec-123");
      expect(result.pokemon.id).toBe("new-pkmn-123");
      expect(result.costPaid).toBe(300);
      expect(result.newBalance).toBe(200);
      expect(result.isDuplicate).toBe(false);

      expect(mockTx.userProfile.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: {
          pokedollars: { decrement: 300 },
          collectionRevision: { increment: 1 },
        },
      });

      expect(mockTx.userPokemon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          level: 5,
          teamPosition: null,
          boxNumber: 1,
          boxSlot: 1,
          evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
          moves: expect.any(Array),
        }),
      });
    });

    it("détecte correctement un doublon si l'espèce est déjà possédée", async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "profile-1" }]),
        userProfile: {
          findUnique: vi.fn().mockResolvedValue({ userId: "user-1", pokedollars: 500 }),
          update: vi.fn().mockResolvedValue({ pokedollars: 200 }),
        },
        userPokemon: {
          findMany: vi.fn().mockResolvedValue([{ boxNumber: 1, boxSlot: 1 }]),
          count: vi.fn().mockResolvedValue(2), // Déjà 2 exemplaires
          create: vi.fn().mockResolvedValue({ id: "new-pkmn-dup" }),
        },
        gachaBanner: {
          upsert: vi.fn().mockResolvedValue({ id: "banner-standard" }),
        },
        gachaPull: {
          create: vi.fn().mockResolvedValue({ id: "pull-rec-dup" }),
        },
      };

      const mockPrisma = {
        gachaPull: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      const result = await executeGachaPull(
        { userId: "user-1", bannerId: "banner-standard" },
        mockPrisma as any
      );

      expect(result.isDuplicate).toBe(true);
    });

    it("retourne le résultat mémorisé sans double débit si l'idempotencyKey est rejouée", async () => {
      const mockPrisma = {
        gachaPull: {
          findUnique: vi.fn().mockResolvedValue({
            id: "cached-pull-1",
            userId: "user-1",
            bannerId: "banner-standard",
            speciesId: "riolu",
            isShiny: false,
            costPaid: 100,
          }),
        },
        userProfile: {
          findUnique: vi.fn().mockResolvedValue({ pokedollars: 400 }),
        },
        $transaction: vi.fn(),
      };

      const result = await executeGachaPull(
        { userId: "user-1", bannerId: "banner-standard", idempotencyKey: "replay_key_1" },
        mockPrisma as any
      );

      expect(result.success).toBe(true);
      expect(result.isCachedPull).toBe(true);
      expect(result.pokemon.speciesId).toBe("riolu");
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("refuse de rejouer la clé d'idempotence d'un autre joueur", async () => {
      const mockPrisma = {
        gachaPull: {
          findUnique: vi.fn().mockResolvedValue({
            id: "foreign-pull",
            userId: "other-user",
            bannerId: "banner-standard",
            speciesId: "riolu",
          }),
        },
      };

      await expect(
        executeGachaPull(
          { userId: "user-1", bannerId: "banner-standard", idempotencyKey: "foreign-key" },
          mockPrisma as any,
        ),
      ).rejects.toThrow(GachaIdempotencyConflictError);
    });

    it("annule le tirage lorsque les vingt boîtes du PC sont pleines", async () => {
      const occupied = Array.from({ length: 20 * 35 }, (_, index) => ({
        boxNumber: Math.floor(index / 35) + 1,
        boxSlot: (index % 35) + 1,
      }));
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "profile-full" }]),
        userProfile: {
          findUnique: vi.fn().mockResolvedValue({ userId: "user-full", pokedollars: 500 }),
          update: vi.fn(),
        },
        userPokemon: {
          findMany: vi.fn().mockResolvedValue(occupied),
          count: vi.fn(),
          create: vi.fn(),
        },
      };
      const mockPrisma = {
        gachaPull: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      await expect(
        executeGachaPull(
          { userId: "user-full", bannerId: "banner-standard" },
          mockPrisma as any,
        ),
      ).rejects.toThrow(GachaPcFullError);
      expect(mockTx.userProfile.update).not.toHaveBeenCalled();
      expect(mockTx.userPokemon.create).not.toHaveBeenCalled();
    });

    it("échoue si la bannière demandée n'existe pas", async () => {
      const mockPrisma = {
        gachaPull: { findUnique: vi.fn().mockResolvedValue(null) },
      };

      await expect(
        executeGachaPull(
          { userId: "user-1", bannerId: "banner-inexistante" },
          mockPrisma as any
        )
      ).rejects.toThrow(BannerNotFoundError);
    });
  });
});
