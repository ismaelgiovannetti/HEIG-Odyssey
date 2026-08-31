import { z } from "zod";

// Contrat commun au serveur et à la future interface : les cases commencent à 1.
export const PC_BOX_COUNT = 15;
export const PC_COLUMNS = 7;
export const PC_ROWS = 10;
export const PC_BOX_CAPACITY = PC_COLUMNS * PC_ROWS;
export const PC_CAPACITY = PC_BOX_COUNT * PC_BOX_CAPACITY;
export const TEAM_CAPACITY = 6;

const PokemonIdSchema = z.string().trim().min(1).max(128);

export const PcPlacementSchema = z.object({
  pokemonId: PokemonIdSchema,
  boxNumber: z.number().int().min(1).max(PC_BOX_COUNT),
  boxSlot: z.number().int().min(1).max(PC_BOX_CAPACITY),
}).strict();

// Les stats, attaques et identifiants de compte ne sont jamais modifiables ici.
export const UpdateTeamBodySchema = z.object({
  expectedRevision: z.number().int().min(0).max(2_147_483_646),
  teamPokemonIds: z.array(PokemonIdSchema).min(1).max(TEAM_CAPACITY),
  // Sans ce champ, on conserve le rangement du PC et on y replace les sortants.
  // Avec ce champ, chaque créature hors équipe doit avoir une case explicite.
  pcPlacements: z.array(PcPlacementSchema).max(PC_CAPACITY).optional(),
}).strict().refine(
  (value) => new Set(value.teamPokemonIds).size === value.teamPokemonIds.length,
  { message: "Une créature ne peut pas occuper plusieurs places dans l'équipe.", path: ["teamPokemonIds"] },
);

export type UpdateTeamInput = z.infer<typeof UpdateTeamBodySchema>;
export type PcPlacement = z.infer<typeof PcPlacementSchema>;
