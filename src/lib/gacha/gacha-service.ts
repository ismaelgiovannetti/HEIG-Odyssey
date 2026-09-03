import { Prisma } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { loadGachaBanners, getSpecies, loadSpecies } from "../content/loader";
import { hydrateMoves } from "../content/moves";
import type { GachaBannerConfig, Species } from "../content/schemas";
import { PC_BOX_CAPACITY, PC_BOX_COUNT } from "../team/team-contract";
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

export class GachaPcFullError extends Error {
  constructor(message = "Votre PC est plein. Libérez une place avant de recruter une nouvelle créature.") {
    super(message);
    this.name = "GachaPcFullError";
  }
}

export class GachaIdempotencyConflictError extends Error {
  constructor(message = "Cette tentative de tirage ne correspond pas à la requête courante.") {
    super(message);
    this.name = "GachaIdempotencyConflictError";
  }
}

const OFFICIAL_STARTER_DEX = new Set([1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393]);
const INITIAL_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/** Fraction uniforme issue du CSPRNG système, dans l'intervalle [0, 1). */
function secureRandomFraction(): number {
  return randomBytes(6).readUIntBE(0, 6) / 0x1_0000_0000_0000;
}

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
  rng: () => number = secureRandomFraction,
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
  const { userId, bannerId, idempotencyKey, rng = secureRandomFraction } = params;

  // 1. Récupération de la bannière demandée
  const banners = loadGachaBanners();
  const banner = banners.find((b) => b.id === bannerId && b.isActive);

  if (!banner) {
    throw new BannerNotFoundError();
  }

  const resolvedIdempotencyKey = idempotencyKey || `pull_${userId}_${randomUUID()}`;

  // 2. Vérification d'idempotence préalable
  const existingPull = await client.gachaPull.findUnique({
    where: { idempotencyKey: resolvedIdempotencyKey },
  });

  if (existingPull) {
    // Une clé est rejouable uniquement par son propriétaire et pour le même portail.
    if (existingPull.userId !== userId || existingPull.bannerId !== banner.id) {
      throw new GachaIdempotencyConflictError();
    }
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
  const maxHp = calculateMaxHp(roll.species.baseStats.hp, 5, roll.ivs.hp, 0);
  const moves = hydrateMoves(roll.species.defaultMoves);

  const result = await client.$transaction(async (tx: any) => {
    // Le verrou sérialise débit et rangement pour un même joueur. Deux clics
    // simultanés ne peuvent donc ni rendre le solde négatif ni partager une case.
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "user_profile" WHERE "userId" = ${userId} FOR UPDATE`,
    );

    // A. Contrôle du solde après acquisition du verrou.
    const profile = await tx.userProfile.findUnique({
      where: { userId },
    });

    if (!profile || profile.pokedollars < banner.costPokedollars) {
      throw new InsufficientFundsError();
    }

    // B. La première case libre est déterminée dans la même transaction que
    // la création ; la collection reste donc immédiatement lisible par /team.
    const storedPokemon = await tx.userPokemon.findMany({
      where: { userId, teamPosition: null },
      select: { boxNumber: true, boxSlot: true },
    });
    const occupied = new Set(
      storedPokemon
        .filter((pokemon: { boxNumber: number | null; boxSlot: number | null }) =>
          pokemon.boxNumber !== null && pokemon.boxSlot !== null)
        .map((pokemon: { boxNumber: number | null; boxSlot: number | null }) =>
          `${pokemon.boxNumber}:${pokemon.boxSlot}`),
    );
    let pcPlacement: { boxNumber: number; boxSlot: number } | null = null;
    for (let boxNumber = 1; boxNumber <= PC_BOX_COUNT && !pcPlacement; boxNumber += 1) {
      for (let boxSlot = 1; boxSlot <= PC_BOX_CAPACITY; boxSlot += 1) {
        if (!occupied.has(`${boxNumber}:${boxSlot}`)) {
          pcPlacement = { boxNumber, boxSlot };
          break;
        }
      }
    }
    if (!pcPlacement) throw new GachaPcFullError();

    // C. Détection de doublon dans la collection.
    const existingCount = await tx.userPokemon.count({
      where: {
        userId,
        speciesId: roll.speciesId,
      },
    });
    const isDuplicate = existingCount > 0;

    // D. Enregistrement complet de la nouvelle créature dans le stockage (PC).
    const newPokemon = await tx.userPokemon.create({
      data: {
        userId,
        speciesId: roll.speciesId,
        level: 5,
        experience: 0,
        currentHp: maxHp,
        maxHp,
        ivs: roll.ivs,
        evs: INITIAL_EVS,
        moves,
        ability: roll.species.possibleAbilities[0],
        nature: roll.nature,
        gender: "GENDERLESS",
        isShiny: roll.isShiny,
        teamPosition: null,
        boxNumber: pcPlacement.boxNumber,
        boxSlot: pcPlacement.boxSlot,
      },
    });

    // E. Le contenu JSON fait autorité. L'upsert maintient la clé étrangère
    // même sur une base déployée avant l'ajout des nouveaux portails.
    await tx.gachaBanner.upsert({
      where: { id: banner.id },
      update: {
        name: banner.name,
        description: banner.description,
        costPokedollars: banner.costPokedollars,
        rates: banner.rates,
        poolSpecies: banner.poolSpecies,
        isActive: banner.isActive,
      },
      create: {
        id: banner.id,
        name: banner.name,
        description: banner.description,
        costPokedollars: banner.costPokedollars,
        rates: banner.rates,
        poolSpecies: banner.poolSpecies,
        isActive: banner.isActive,
      },
    });

    // F. Enregistrement du tirage avant le débit final.
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

    // Le solde et la version de collection changent ensemble : un onglet
    // /team déjà ouvert détectera proprement la nouvelle créature.
    const updatedProfile = await tx.userProfile.update({
      where: { userId },
      data: {
        pokedollars: { decrement: banner.costPokedollars },
        collectionRevision: { increment: 1 },
      },
    });

    return {
      pullId: gachaPullRecord.id,
      pokemonId: newPokemon.id,
      newBalance: updatedProfile.pokedollars,
      isDuplicate,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

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
