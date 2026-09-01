import { describe, expect, it } from "vitest";
import { buildTeamLayout } from "@/lib/team/team-layout";
import { PC_BOX_COUNT, PC_BOX_CAPACITY, PC_COLUMNS, PC_ROWS, PC_CAPACITY, UpdateTeamBodySchema, type UpdateTeamInput } from "@/lib/team/team-contract";
import { PcCapacityExceededError, TeamCompositionInvalidError, TeamPokemonNotOwnedError } from "@/lib/team/team-errors";
import { teamPokemon } from "../helpers/team-fixtures";

const owned = [
  teamPokemon({ id: "p1", teamPosition: 1, boxNumber: null, boxSlot: null }),
  teamPokemon({ id: "p2", boxNumber: 1, boxSlot: 1 }),
  teamPokemon({ id: "p3", boxNumber: 2, boxSlot: 35 }),
];
const input: UpdateTeamInput = { expectedRevision: 0, teamPokemonIds: ["p1"] };

describe("rangement de la collection", () => {
  it("partage le format de vingt boîtes de sept colonnes et cinq lignes", () => {
    // Valeurs attendues explicites : une modification involontaire du contrat sera détectée.
    expect({ boxes: PC_BOX_COUNT, columns: PC_COLUMNS, rows: PC_ROWS, perBox: PC_BOX_CAPACITY, total: PC_CAPACITY })
      .toEqual({ boxes: 20, columns: 7, rows: 5, perBox: 35, total: 700 });
    expect(UpdateTeamBodySchema.safeParse({ ...input, pcPlacements: [{ pokemonId: "p2", boxNumber: 20, boxSlot: 35 }] }).success).toBe(true);
  });

  it("préserve les cases existantes et place le sortant dans la première case libre", () => {
    const result = buildTeamLayout(owned, { ...input, teamPokemonIds: ["p2"] });
    expect(result).toContainEqual({ pokemonId: "p1", teamPosition: null, boxNumber: 1, boxSlot: 1 });
    expect(result).toContainEqual({ pokemonId: "p3", teamPosition: null, boxNumber: 2, boxSlot: 35 });
  });

  it("accepte le déplacement explicite jusqu'à la dernière case de la dernière boîte", () => {
    const result = buildTeamLayout(owned, { ...input, pcPlacements: [
      { pokemonId: "p2", boxNumber: 20, boxSlot: 35 }, { pokemonId: "p3", boxNumber: 1, boxSlot: 1 },
    ] });
    expect(result).toContainEqual({ pokemonId: "p2", teamPosition: null, boxNumber: 20, boxSlot: 35 });
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

  it.each([0, 21, 1.5])("refuse le numéro de boîte %s", (boxNumber) => {
    expect(UpdateTeamBodySchema.safeParse({ ...input, pcPlacements: [{ pokemonId: "p2", boxNumber, boxSlot: 1 }] }).success).toBe(false);
  });
  it.each([0, 36, 1.5])("refuse le numéro de case %s", (boxSlot) => {
    expect(UpdateTeamBodySchema.safeParse({ ...input, pcPlacements: [{ pokemonId: "p2", boxNumber: 1, boxSlot }] }).success).toBe(false);
  });

  it("gère 700 créatures stockées et refuse un dépôt supplémentaire", () => {
    const pc = Array.from({ length: PC_CAPACITY }, (_, i) => teamPokemon({ id: `pc-${i}`, boxNumber: Math.floor(i / 35) + 1, boxSlot: i % 35 + 1 }));
    const team = [owned[0], teamPokemon({ id: "p4", teamPosition: 2, boxNumber: null, boxSlot: null })];
    expect(buildTeamLayout([...team, ...pc], { ...input, teamPokemonIds: ["p1", "p4"] })).toHaveLength(PC_CAPACITY + 2);
    expect(() => buildTeamLayout([...team, ...pc], input)).toThrow(PcCapacityExceededError);
  });
});
