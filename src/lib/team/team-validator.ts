import type { UserPokemon } from "@prisma/client";
import { MoveSchema, type TrainerPokemon } from "../content/schemas";
import { getSpecies } from "../content/loader";
import { readStoredStat } from "../pokemon/stored-stat";

const StoredTeamMovesSchema = MoveSchema.array().min(1).max(4);

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateTeamComposition(team: UserPokemon[]): ValidationResult {
  const errors: string[] = [];

  if (!team || team.length === 0) {
    errors.push(
      "L'équipe active ne peut pas être vide (1 à 6 Pokémon requis).",
    );
    return { isValid: false, errors };
  }

  if (team.length > 6) {
    errors.push("L'équipe active ne peut pas contenir plus de 6 Pokémon.");
  }

  const positions = new Set<number>();
  for (const member of team) {
    if (member.teamPosition === null || member.teamPosition === undefined) {
      errors.push(
        `Le Pokémon ${member.id} n'a pas de position d'équipe définie.`,
      );
      continue;
    }

    if (member.teamPosition < 1 || member.teamPosition > 6) {
      errors.push(
        `Position invalide (${member.teamPosition}) pour le Pokémon ${member.id}.`,
      );
    }

    if (positions.has(member.teamPosition)) {
      errors.push(
        `Position d'équipe en doublon : slot ${member.teamPosition}.`,
      );
    }
    positions.add(member.teamPosition);
  }

  // Ensure positions are 1..N without gaps
  const sortedPositions = Array.from(positions).sort((a, b) => a - b);
  for (let i = 0; i < sortedPositions.length; i++) {
    if (sortedPositions[i] !== i + 1) {
      errors.push(
        `Les positions d'équipe doivent être consécutives de 1 à ${sortedPositions.length}.`,
      );
      break;
    }
  }

  // At least 1 Pokémon must have currentHp > 0
  const hasConsciousPokemon = team.some((p) => p.currentHp > 0);
  if (!hasConsciousPokemon) {
    errors.push(
      "L'équipe ne contient aucun Pokémon en état de combattre (tous K.O.).",
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function calculateMaxHp(
  baseHp: number,
  level: number,
  ivHp = 15,
  evHp = 0,
): number {
  // Official Gen 4 HP formula (except Shedinja which has 1 HP)
  if (baseHp === 1) return 1;
  return (
    Math.floor(((2 * baseHp + ivHp + Math.floor(evHp / 4)) * level) / 100) +
    level +
    10
  );
}

export function calculateStat(
  baseStat: number,
  level: number,
  iv = 15,
  ev = 0,
  natureMultiplier = 1.0,
): number {
  // Official Gen 4 standard stat formula
  const val =
    Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  return Math.floor(val * natureMultiplier);
}

export function userPokemonToTrainerPokemon(
  userPkmn: UserPokemon,
): TrainerPokemon {
  const spec = getSpecies(userPkmn.speciesId);
  const moves = StoredTeamMovesSchema.parse(userPkmn.moves);

  return {
    speciesId: userPkmn.speciesId,
    nickname: userPkmn.nickname || spec?.name || userPkmn.speciesId,
    level: userPkmn.level,
    isShiny: userPkmn.isShiny,
    moves,
    ivs: {
      hp: readStoredStat(userPkmn.ivs, "hp", 15),
      atk: readStoredStat(userPkmn.ivs, "atk", 15),
      def: readStoredStat(userPkmn.ivs, "def", 15),
      spa: readStoredStat(userPkmn.ivs, "spa", 15),
      spd: readStoredStat(userPkmn.ivs, "spd", 15),
      spe: readStoredStat(userPkmn.ivs, "spe", 15),
    },
    nature: userPkmn.nature || "Hardy",
  };
}
