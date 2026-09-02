import { prisma } from "../prisma";
import { loadGachaBanners, getSpecies, loadSpecies } from "../content/loader";
import type { GachaBannerConfig, Species } from "../content/schemas";
import { calculateMaxHp } from "../team/team-validator";

export const POKEMON_NATURES = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
  "Bold", "Docile", "Relaxed", "Impish", "Lax",
  "Timid", "Hasty", "Serious", "Jolly", "Naive",
  "Modest", "Mild", "Quiet", "Bashful", "Rash",
  "Calm", "Gentle", "Sassy", "Careful", "Quirky",
] as const;

export type PokemonNature = (typeof POKEMON_NATURES)[number];

export type PokemonRarity = "COMMON" | "RARE" | "EPIC";

export class BannerNotFoundError extends Error {
  constructor(message = "Bannière de recrutement introuvable.") {
    super(message);
    this.name = "BannerNotFoundError";
  }
}

export class InsufficientFundsError extends Error {
  constructor(message = "Solde de Pokédollars insuffisant pour effectuer ce tirage.") {
    super(message);
    this.name = "InsufficientFundsError";
  }
}

const OFFICIAL_STARTER_DEX = new Set([1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393]);

/**
 * Détermine la rareté intrinsèque d'une espèce selon ses caractéristiques (T-US12-01).
 */
export function determineSpeciesRarity(species: Species): PokemonRarity {
  const baseStatTotal =
    species.baseStats.hp +
    species.baseStats.attack +
    species.baseStats.defense +
    species.baseStats.specialAttack +
    species.baseStats.specialDefense +
    species.baseStats.speed;

  if (species.isLegendary || species.isMythical || species.stage >= 3 || baseStatTotal >= 500) {
    return "EPIC";
  }

  if (species.stage === 2 || OFFICIAL_STARTER_DEX.has(species.dexNumber) || baseStatTotal >= 400) {
    return "RARE";
  }

  return "COMMON";
}

export interface GachaRollResult {
  speciesId: string;
  species: Species;
  rarity: PokemonRarity;
  isShiny: boolean;
  ivs: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
  nature: PokemonNature;
}

/**
 * Effectue un tirage aléatoire pondéré selon les taux configurés dans la bannière (T-US12-02).
 */
export function rollGachaPull(
  banner: GachaBannerConfig,
  rng: () => number = Math.random
): GachaRollResult {
  const speciesMap = loadSpecies();
  const availableSpecies: Array<{ species: Species; rarity: PokemonRarity }> = [];

  for (const spId of banner.poolSpecies) {
    const sp = speciesMap.get(spId);
    if (sp) {
      availableSpecies.push({ species: sp, rarity: determineSpeciesRarity(sp) });
    }
  }

  if (availableSpecies.length === 0) {
    throw new Error(`Aucune espèce disponible dans le pool de la bannière ${banner.id}`);
  }

  // 1. Détermination de la rareté cible
  const rarityRoll = rng();
  let targetRarity: PokemonRarity = "COMMON";

  if (rarityRoll < banner.rates.epic) {
    targetRarity = "EPIC";
  } else if (rarityRoll < banner.rates.epic + banner.rates.rare) {
    targetRarity = "RARE";
  } else {
    targetRarity = "COMMON";
  }

  // 2. Sélection des espèces candidates selon la rareté
  let candidates = availableSpecies.filter((s) => s.rarity === targetRarity);
  if (candidates.length === 0) {
    // Repli sur le pool complet si aucune espèce de cette rareté exacte
    candidates = availableSpecies;
  }

  const selectedIndex = Math.floor(rng() * candidates.length);
  const selected = candidates[selectedIndex];

  // 3. Tirage chromatique (Shiny)
  const isShiny = rng() < (banner.rates.shinyRate ?? 0.01);

  // 4. Tirage des IVs (0 à 31) et de la nature
  const ivs = {
    hp: Math.floor(rng() * 32),
    atk: Math.floor(rng() * 32),
    def: Math.floor(rng() * 32),
    spa: Math.floor(rng() * 32),
    spd: Math.floor(rng() * 32),
    spe: Math.floor(rng() * 32),
  };

  const natureIndex = Math.floor(rng() * POKEMON_NATURES.length);
  const nature = POKEMON_NATURES[natureIndex];

  return {
    speciesId: selected.species.id,
    species: selected.species,
    rarity: selected.rarity,
    isShiny,
    ivs,
    nature,
  };
}

export interface ExecuteGachaPullParams {
  userId: string;
  bannerId: string;
  idempotencyKey?: string;
  rng?: () => number;
}

export interface GachaExecutionResult {
  success: boolean;
  pullId: string;
  bannerId: string;
  pokemon: {
    id: string;
    speciesId: string;
    name: string;
    level: number;
    isShiny: boolean;
    rarity: PokemonRarity;
    nature: string;
    ivs: Record<string, number>;
    currentHp: number;
    maxHp: number;
  };
  costPaid: number;
  newBalance: number;
  isDuplicate: boolean;
  isCachedPull?: boolean;
}

/**
 * Exécute un tirage gacha transactionnel avec déduction du solde et stockage sécurisé (T-US12-02).
 */
export async function executeGachaPull(
  params: ExecuteGachaPullParams,
  client: any = prisma
): Promise<GachaExecutionResult> {
  const { userId, bannerId, idempotencyKey, rng = Math.random } = params;

  // 1. Récupération de la bannière demandée
  const banners = loadGachaBanners();
  const banner = banners.find((b) => b.id === bannerId && b.isActive);

  if (!banner) {
    throw new BannerNotFoundError();
  }

  const resolvedIdempotencyKey = idempotencyKey || `pull_${userId}_${Date.now()}_${Math.random()}`;

  // 2. Vérification d'idempotence préalable
  const existingPull = await client.gachaPull.findUnique({
    where: { idempotencyKey: resolvedIdempotencyKey },
    include: { banner: true },
  });

  if (existingPull) {
    const profile = await client.userProfile.findUnique({ where: { userId } });
    const species = getSpecies(existingPull.speciesId);

    return {
      success: true,
      pullId: existingPull.id,
      bannerId: existingPull.bannerId,
      pokemon: {
        id: `replayed_${existingPull.id}`,
        speciesId: existingPull.speciesId,
        name: species?.name || existingPull.speciesId,
        level: 5,
        isShiny: existingPull.isShiny,
        rarity: species ? determineSpeciesRarity(species) : "COMMON",
        nature: "Hardy",
        ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
        currentHp: 20,
        maxHp: 20,
      },
      costPaid: existingPull.costPaid,
      newBalance: profile?.pokedollars || 0,
      isDuplicate: false,
      isCachedPull: true,
    };
  }

  // 3. Tirage et Transaction atomique
  const roll = rollGachaPull(banner, rng);
  const maxHp = calculateMaxHp(roll.species.baseStats.hp, roll.ivs.hp, 5);

  const result = await client.$transaction(async (tx: any) => {
    // A. Contrôle et débit du solde
    const profile = await tx.userProfile.findUnique({
      where: { userId },
    });

    if (!profile || profile.pokedollars < banner.costPokedollars) {
      throw new InsufficientFundsError();
    }

    const updatedProfile = await tx.userProfile.update({
      where: { userId },
      data: {
        pokedollars: {
          decrement: banner.costPokedollars,
        },
      },
    });

    // B. Détection de doublon dans la collection
    const existingCount = await tx.userPokemon.count({
      where: {
        userId,
        speciesId: roll.speciesId,
      },
    });
    const isDuplicate = existingCount > 0;

    // C. Enregistrement de la nouvelle créature dans le stockage (PC)
    const newPokemon = await tx.userPokemon.create({
      data: {
        userId,
        speciesId: roll.speciesId,
        level: 5,
        experience: 0,
        currentHp: maxHp,
        maxHp,
        ivs: roll.ivs,
        teamPosition: null, // Placé directement dans le PC
      },
    });

    // D. Enregistrement du tirage gacha
    const gachaPullRecord = await tx.gachaPull.create({
      data: {
        userId,
        bannerId: banner.id,
        speciesId: roll.speciesId,
        isShiny: roll.isShiny,
        costPaid: banner.costPokedollars,
        idempotencyKey: resolvedIdempotencyKey,
      },
    });

    return {
      pullId: gachaPullRecord.id,
      pokemonId: newPokemon.id,
      newBalance: updatedProfile.pokedollars,
      isDuplicate,
    };
  });

  return {
    success: true,
    pullId: result.pullId,
    bannerId: banner.id,
    pokemon: {
      id: result.pokemonId,
      speciesId: roll.speciesId,
      name: roll.species.name,
      level: 5,
      isShiny: roll.isShiny,
      rarity: roll.rarity,
      nature: roll.nature,
      ivs: roll.ivs,
      currentHp: maxHp,
      maxHp,
    },
    costPaid: banner.costPokedollars,
    newBalance: result.newBalance,
    isDuplicate: result.isDuplicate,
  };
}

/**
 * Récupère la liste de toutes les bannières actives pour la boutique (T-US12-05).
 */
export function getActiveBanners(): GachaBannerConfig[] {
  return loadGachaBanners().filter((b) => b.isActive);
}
