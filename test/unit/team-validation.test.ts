import { describe, it, expect } from "vitest";
import {
  validateTeamComposition,
  calculateMaxHp,
  userPokemonToTrainerPokemon,
} from "@/lib/team/team-validator";
import type { UserPokemon } from "@prisma/client";

describe("Team Validation & Stats Calculation (US-05)", () => {
  const mockPokemon = (
    id: string,
    teamPosition: number,
    currentHp = 20,
  ): UserPokemon => ({
    id,
    userId: "user-1",
    speciesId: "turtwig",
    nickname: "Tortipouss",
    level: 5,
    experience: 0,
    currentHp,
    maxHp: 20,
    ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: [
      {
        id: "tackle",
        name: "Charge",
        type: "Normal",
        category: "physical",
        power: 35,
        accuracy: 100,
        pp: 35,
        maxPp: 35,
        priority: 0,
      },
    ],
    ability: "Overgrow",
    nature: "Hardy",
    gender: "M",
    isShiny: false,
    teamPosition,
    // Une créature active n'occupe aucune case du PC.
    boxNumber: null,
    boxSlot: null,
    caughtAt: new Date(),
  });

  it("should validate a valid 1-member team", () => {
    const team = [mockPokemon("p1", 1)];
    const result = validateTeamComposition(team);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should validate a valid 6-member team with positions 1 to 6", () => {
    const team = [
      mockPokemon("p1", 1),
      mockPokemon("p2", 2),
      mockPokemon("p3", 3),
      mockPokemon("p4", 4),
      mockPokemon("p5", 5),
      mockPokemon("p6", 6),
    ];
    const result = validateTeamComposition(team);
    expect(result.isValid).toBe(true);
  });

  it("should reject an empty team", () => {
    const result = validateTeamComposition([]);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain("vide");
  });

  it("should reject a team with more than 6 members", () => {
    const team = [
      mockPokemon("p1", 1),
      mockPokemon("p2", 2),
      mockPokemon("p3", 3),
      mockPokemon("p4", 4),
      mockPokemon("p5", 5),
      mockPokemon("p6", 6),
      mockPokemon("p7", 7),
    ];
    const result = validateTeamComposition(team);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("plus de 6"))).toBe(true);
  });

  it("should reject duplicate team positions", () => {
    const team = [mockPokemon("p1", 1), mockPokemon("p2", 1)];
    const result = validateTeamComposition(team);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("doublon"))).toBe(true);
  });

  it("should reject team positions with gaps (e.g. 1 and 3)", () => {
    const team = [mockPokemon("p1", 1), mockPokemon("p2", 3)];
    const result = validateTeamComposition(team);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("consécutives"))).toBe(true);
  });

  it("should reject a team where all Pokémon are fainted (0 HP)", () => {
    const team = [mockPokemon("p1", 1, 0), mockPokemon("p2", 2, 0)];
    const result = validateTeamComposition(team);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("K.O."))).toBe(true);
  });

  it("should correctly compute Gen 4 max HP", () => {
    // Turtwig: Base HP 55, Level 5, IV 15, EV 0 -> floor(((2*55 + 15)*5)/100) + 5 + 10 = floor(625/100) + 15 = 6 + 15 = 21
    const hp = calculateMaxHp(55, 5, 15, 0);
    expect(hp).toBe(21);

    // Shedinja: Base HP 1 -> always 1 HP
    expect(calculateMaxHp(1, 50, 31, 252)).toBe(1);
  });

  it("should convert UserPokemon to TrainerPokemon format", () => {
    const userPkmn = mockPokemon("p1", 1);
    const trainerPkmn = userPokemonToTrainerPokemon(userPkmn);

    expect(trainerPkmn.speciesId).toBe("turtwig");
    expect(trainerPkmn.level).toBe(5);
    expect(trainerPkmn.moves.length).toBe(1);
    expect(trainerPkmn.ivs.hp).toBe(15);
  });

  it("rejects malformed persisted moves instead of forwarding them to the battle engine", () => {
    const userPkmn = mockPokemon("p1", 1);
    userPkmn.moves = [{ id: "incomplete-move" }];

    expect(() => userPokemonToTrainerPokemon(userPkmn)).toThrow();
  });
});
