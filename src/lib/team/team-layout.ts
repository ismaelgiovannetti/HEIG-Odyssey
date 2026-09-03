import type { UserPokemon } from "@prisma/client";
import {
  PC_BOX_CAPACITY,
  PC_CAPACITY,
  type UpdateTeamInput,
} from "./team-contract";
import {
  PcCapacityExceededError,
  TeamCompositionInvalidError,
  TeamPokemonNotOwnedError,
} from "./team-errors";
import { validateTeamComposition } from "./team-validator";

export interface PokemonLocation {
  pokemonId: string;
  teamPosition: number | null;
  boxNumber: number | null;
  boxSlot: number | null;
}

/** Prépare tout le rangement sans écrire : aucun déplacement partiel n'est autorisé. */
export function buildTeamLayout(
  owned: UserPokemon[],
  input: UpdateTeamInput,
): PokemonLocation[] {
  const byId = new Map(owned.map((pokemon) => [pokemon.id, pokemon]));
  const teamIds = new Set(input.teamPokemonIds);
  const submittedIds = [
    ...input.teamPokemonIds,
    ...(input.pcPlacements ?? []).map((p) => p.pokemonId),
  ];

  // Même message pour une créature inexistante et pour celle d'un autre joueur.
  if (submittedIds.some((id) => !byId.has(id)))
    throw new TeamPokemonNotOwnedError();
  if (new Set(submittedIds).size !== submittedIds.length) {
    throw new TeamCompositionInvalidError([
      "Chaque créature doit apparaître une seule fois.",
    ]);
  }

  const team = input.teamPokemonIds.map((id, index) => ({
    ...byId.get(id)!,
    teamPosition: index + 1,
  }));
  const validation = validateTeamComposition(team);
  if (!validation.isValid)
    throw new TeamCompositionInvalidError(validation.errors);

  const stored = owned.filter((pokemon) => !teamIds.has(pokemon.id));
  if (stored.length > PC_CAPACITY) throw new PcCapacityExceededError();

  const locations: PokemonLocation[] = team.map((pokemon) => ({
    pokemonId: pokemon.id,
    teamPosition: pokemon.teamPosition,
    boxNumber: null,
    boxSlot: null,
  }));

  if (input.pcPlacements !== undefined) {
    if (input.pcPlacements.length !== stored.length) {
      throw new TeamCompositionInvalidError([
        "Chaque créature hors équipe doit être placée dans le PC.",
      ]);
    }
    const cells = new Set(
      input.pcPlacements.map((p) => `${p.boxNumber}:${p.boxSlot}`),
    );
    if (cells.size !== input.pcPlacements.length) {
      throw new TeamCompositionInvalidError([
        "Deux créatures ne peuvent pas occuper la même case du PC.",
      ]);
    }
    return [
      ...locations,
      ...input.pcPlacements.map((p) => ({ ...p, teamPosition: null })),
    ];
  }

  // Une sauvegarde limitée à l'équipe ne doit pas trier de nouveau tout le PC.
  const occupied = new Set<number>();
  const returning: UserPokemon[] = [];
  for (const pokemon of stored) {
    if (pokemon.boxNumber !== null && pokemon.boxSlot !== null) {
      occupied.add(
        (pokemon.boxNumber - 1) * PC_BOX_CAPACITY + pokemon.boxSlot - 1,
      );
      locations.push({
        pokemonId: pokemon.id,
        teamPosition: null,
        boxNumber: pokemon.boxNumber,
        boxSlot: pokemon.boxSlot,
      });
    } else {
      returning.push(pokemon);
    }
  }

  // Les sortants prennent les premières cases libres, sans écraser leurs occupants.
  let cell = 0;
  for (const pokemon of returning) {
    while (occupied.has(cell)) cell += 1;
    if (cell >= PC_CAPACITY) throw new PcCapacityExceededError();
    occupied.add(cell);
    locations.push({
      pokemonId: pokemon.id,
      teamPosition: null,
      boxNumber: Math.floor(cell / PC_BOX_CAPACITY) + 1,
      boxSlot: (cell % PC_BOX_CAPACITY) + 1,
    });
  }
  return locations;
}
