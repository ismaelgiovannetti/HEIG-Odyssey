import { Dex } from "@pkmn/sim";
import type { UserPokemon } from "@prisma/client";
import { z } from "zod";
import { getSpecies } from "../content/loader";
import { MoveSchema, type BaseStats, type Move, type PokemonType } from "../content/schemas";
import { calculateStat } from "./team-validator";

const dex = Dex.forGen(4);
// Une attaque apprise peut avoir épuisé ses PP ; elle ne disparaît pas du résumé.
const StoredMovesSchema = z.array(MoveSchema.extend({ pp: z.number().int().min(0) })).max(4);

export interface CollectionEntry {
  id: string;
  speciesId: string;
  name: string;
  nickname: string | null;
  level: number;
  experience: number;
  currentHp: number;
  maxHp: number;
  isShiny: boolean;
  teamPosition: number | null;
  boxNumber: number | null;
  boxSlot: number | null;
  types: PokemonType[];
  dexNumber?: number;
  ability: string | null;
  nature: string | null;
  moves: Move[];
  stats: BaseStats | null;
}

function statValue(value: unknown, key: string, fallback: number): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const stat = (value as Record<string, unknown>)[key];
  return typeof stat === "number" && Number.isFinite(stat) ? stat : fallback;
}

/** Expose uniquement les données utiles à la consultation, jamais l'identité du compte. */
export function toCollectionEntry(pokemon: UserPokemon): CollectionEntry {
  const species = getSpecies(pokemon.speciesId);
  const nature = dex.natures.get(pokemon.nature || "Hardy");
  const compute = (base: number, key: "atk" | "def" | "spa" | "spd" | "spe") => calculateStat(
    base, pokemon.level, statValue(pokemon.ivs, key, 15), statValue(pokemon.evs, key, 0),
    nature.plus === key ? 1.1 : nature.minus === key ? 0.9 : 1,
  );

  return {
    id: pokemon.id,
    speciesId: pokemon.speciesId,
    name: pokemon.nickname || species?.name || pokemon.speciesId,
    nickname: pokemon.nickname,
    level: pokemon.level,
    experience: pokemon.experience,
    currentHp: pokemon.currentHp,
    maxHp: pokemon.maxHp,
    isShiny: pokemon.isShiny,
    teamPosition: pokemon.teamPosition,
    boxNumber: pokemon.boxNumber,
    boxSlot: pokemon.boxSlot,
    types: species?.types || ["Normal"],
    dexNumber: species?.dexNumber,
    ability: pokemon.ability,
    nature: pokemon.nature,
    // Les attaques viennent de la créature possédée, pas des attaques par défaut de l'espèce.
    moves: StoredMovesSchema.parse(pokemon.moves),
    stats: species ? {
      hp: pokemon.maxHp,
      attack: compute(species.baseStats.attack, "atk"),
      defense: compute(species.baseStats.defense, "def"),
      specialAttack: compute(species.baseStats.specialAttack, "spa"),
      specialDefense: compute(species.baseStats.specialDefense, "spd"),
      speed: compute(species.baseStats.speed, "spe"),
    } : null,
  };
}
