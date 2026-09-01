import type { CollectionEntry } from "@/lib/team/collection-entry";
import type { CollectionSnapshot } from "@/lib/team/team-client";
import type { TeamDraft } from "@/lib/team/team-draft";
import { PC_BOX_COUNT, PC_COLUMNS, PC_ROWS } from "@/lib/team/team-contract";

/** Données locales aux tests : aucun compte, cookie ou appel à la base réelle. */
export function teamPokemon(
  overrides: Partial<CollectionEntry> = {},
): CollectionEntry {
  return {
    id: "alpha",
    speciesId: "bulbasaur",
    name: "Bulbizarre",
    nickname: null,
    level: 5,
    experience: 0,
    currentHp: 20,
    maxHp: 20,
    isShiny: false,
    teamPosition: null,
    boxNumber: 1,
    boxSlot: 1,
    types: ["Grass", "Poison"],
    dexNumber: 1,
    ability: "Overgrow",
    nature: "Hardy",
    stats: {
      hp: 20,
      attack: 10,
      defense: 11,
      specialAttack: 12,
      specialDefense: 12,
      speed: 9,
    },
    moves: [
      {
        id: "tackle",
        name: "Charge",
        type: "Normal",
        category: "physical",
        power: 35,
        accuracy: 95,
        pp: 0,
        maxPp: 35,
        priority: 0,
      },
    ],
    ...overrides,
  };
}

export function teamSnapshot(): CollectionSnapshot {
  const pokemon = [
    teamPokemon({ teamPosition: 1, boxNumber: null, boxSlot: null }),
    teamPokemon({
      id: "bravo",
      speciesId: "charmander",
      name: "Salamèche",
      types: ["Fire"],
      teamPosition: 2,
      boxNumber: null,
      boxSlot: null,
    }),
    teamPokemon({
      id: "charlie",
      speciesId: "squirtle",
      name: "Carapuce",
      types: ["Water"],
      boxSlot: 1,
    }),
    teamPokemon({
      id: "delta",
      speciesId: "shinx",
      name: "Lixy",
      types: ["Electric"],
      boxSlot: 2,
      isShiny: true,
    }),
    teamPokemon({
      id: "echo",
      speciesId: "pidgey",
      name: "Roucool",
      types: ["Normal", "Flying"],
      boxNumber: 2,
      boxSlot: 35,
    }),
  ];
  return {
    success: true,
    revision: 7,
    count: pokemon.length,
    pokemon,
    pc: {
      columns: PC_COLUMNS,
      rows: PC_ROWS,
      boxes: Array.from({ length: PC_BOX_COUNT }, (_, i) => ({
        number: i + 1,
        name: `Boîte ${i + 1}`,
      })),
    },
  };
}

/** Simule uniquement la réponse autoritaire, sans réutiliser le code de déplacement testé. */
export function snapshotAfterSave(
  snapshot: CollectionSnapshot,
  draft: TeamDraft,
): CollectionSnapshot {
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    pokemon: snapshot.pokemon.map((entry) => {
      const teamIndex = draft.team.indexOf(entry.id);
      const pc = draft.pc.find((p) => p.pokemonId === entry.id);
      return {
        ...entry,
        teamPosition: teamIndex < 0 ? null : teamIndex + 1,
        boxNumber: pc?.boxNumber ?? null,
        boxSlot: pc?.boxSlot ?? null,
      };
    }),
  };
}
