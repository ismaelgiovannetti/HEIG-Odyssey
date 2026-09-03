import type { UserPokemon } from "@prisma/client";

/** Créature de test complète, sans dépendre des valeurs d'un compte réel. */
export function teamPokemon(
  overrides: Partial<UserPokemon> & { id: string },
): UserPokemon {
  return {
    userId: "user-1",
    speciesId: "turtwig",
    nickname: null,
    level: 5,
    experience: 0,
    currentHp: 21,
    maxHp: 21,
    ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: [
      {
        id: "tackle",
        name: "Charge",
        type: "Normal",
        category: "physical",
        power: 35,
        accuracy: 95,
        pp: 35,
        maxPp: 35,
        priority: 0,
      },
    ],
    ability: "Overgrow",
    nature: "Hardy",
    gender: "GENDERLESS",
    isShiny: false,
    teamPosition: null,
    boxNumber: 1,
    boxSlot: 1,
    caughtAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}
