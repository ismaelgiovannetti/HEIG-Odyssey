import { describe, expect, it } from "vitest";
import { buildTeamLayout } from "@/lib/team/team-layout";
import { PC_CAPACITY, UpdateTeamBodySchema, type UpdateTeamInput } from "@/lib/team/team-contract";
import { PcCapacityExceededError, TeamCompositionInvalidError, TeamPokemonNotOwnedError } from "@/lib/team/team-errors";
import { teamPokemon } from "../helpers/team-fixtures";

const owned = [
  teamPokemon({ id: "p1", teamPosition: 1, boxNumber: null, boxSlot: null }),
  teamPokemon({ id: "p2", boxNumber: 1, boxSlot: 1 }),
  teamPokemon({ id: "p3", boxNumber: 2, boxSlot: 70 }),
];
const input: UpdateTeamInput = { expectedRevision: 0, teamPokemonIds: ["p1"] };

describe("rangement de la collection", () => {
  it("préserve les cases existantes et place le sortant dans la première case libre", () => {
    const result = buildTeamLayout(owned, { ...input, teamPokemonIds: ["p2"] });
    expect(result).toContainEqual({ pokemonId: "p1", teamPosition: null, boxNumber: 1, boxSlot: 1 });
    expect(result).toContainEqual({ pokemonId: "p3", teamPosition: null, boxNumber: 2, boxSlot: 70 });
  });

  it("accepte le déplacement explicite jusqu'à la dernière case de la dernière boîte", () => {
    const result = buildTeamLayout(owned, { ...input, pcPlacements: [
      { pokemonId: "p2", boxNumber: 15, boxSlot: 70 }, { pokemonId: "p3", boxNumber: 1, boxSlot: 1 },
    ] });
    expect(result).toContainEqual({ pokemonId: "p2", teamPosition: null, boxNumber: 15, boxSlot: 70 });
    expect(result).toHaveLength(owned.length);
  });

  it.each([
    [{ pokemonId: "p2", boxNumber: 1, boxSlot: 1 }], // p3 oublié
    [{ pokemonId: "p2", boxNumber: 1, boxSlot: 1 }, { pokemonId: "p3", boxNumber: 1, boxSlot: 1 }], // case partagée
    [{ pokemonId: "p2", boxNumber: 1, boxSlot: 1 }, { pokemonId: "p2", boxNumber: 1, boxSlot: 2 }], // créature répétée
    [{ pokemonId: "p1", boxNumber: 1, boxSlot: 1 }, { pokemonId: "p3", boxNumber: 1, boxSlot: 2 }], // déjà en équipe
  ].map((pcPlacements) => ({ pcPlacements })))("refuse un rangement incomplet ou dupliqué (%#)", ({ pcPlacements }) => {
    expect(() => buildTeamLayout(owned, { ...input, pcPlacements })).toThrow(TeamCompositionInvalidError);
  });

  it("refuse aussi une créature étrangère placée uniquement dans le PC", () => {
    expect(() => buildTeamLayout(owned, { ...input, pcPlacements: [{ pokemonId: "foreign", boxNumber: 1, boxSlot: 1 }] })).toThrow(TeamPokemonNotOwnedError);
  });

  it.each([0, 16, 1.5])("refuse le numéro de boîte %s", (boxNumber) => {
    expect(UpdateTeamBodySchema.safeParse({ ...input, pcPlacements: [{ pokemonId: "p2", boxNumber, boxSlot: 1 }] }).success).toBe(false);
  });
  it.each([0, 71, 1.5])("refuse le numéro de case %s", (boxSlot) => {
    expect(UpdateTeamBodySchema.safeParse({ ...input, pcPlacements: [{ pokemonId: "p2", boxNumber: 1, boxSlot }] }).success).toBe(false);
  });

  it("gère 1 050 créatures stockées et refuse un dépôt supplémentaire", () => {
    const pc = Array.from({ length: PC_CAPACITY }, (_, i) => teamPokemon({ id: `pc-${i}`, boxNumber: Math.floor(i / 70) + 1, boxSlot: i % 70 + 1 }));
    const team = [owned[0], teamPokemon({ id: "p4", teamPosition: 2, boxNumber: null, boxSlot: null })];
    expect(buildTeamLayout([...team, ...pc], { ...input, teamPokemonIds: ["p1", "p4"] })).toHaveLength(1052);
    expect(() => buildTeamLayout([...team, ...pc], input)).toThrow(PcCapacityExceededError);
  });
});
