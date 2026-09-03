import { z } from "zod";

import {
  BaseStatsSchema,
  MoveSchema,
  PokemonTypeEnum,
} from "@/lib/content/schemas";

export const StarterChooseBodySchema = z
  .object({
    speciesId: z.string().trim().min(1).max(128),
    nickname: z.string().trim().min(1).max(20).optional(),
  })
  .strict();

export const StarterViewSchema = z.object({
  speciesId: z.string().min(1),
  dexNumber: z.number().int().min(1).max(493).optional(),
  name: z.string().min(1),
  generation: z.number().int().min(1).max(4).optional(),
  types: z.array(PokemonTypeEnum).min(1).max(2),
  level: z.number().int().min(1).max(100),
  description: z.string().optional(),
  moves: z.array(MoveSchema).min(1).max(4),
  baseStats: BaseStatsSchema.optional(),
});

export const StarterCatalogResponseSchema = z.object({
  success: z.literal(true),
  count: z.number().int().nonnegative(),
  starters: z.array(StarterViewSchema).min(1),
});

export const StarterClaimResultSchema = z.object({
  success: z.literal(true),
  pokemon: z.object({
    id: z.string().min(1),
    speciesId: z.string().min(1),
    name: z.string().min(1),
    level: z.number().int().min(1).max(100),
    currentHp: z.number().int().nonnegative(),
    maxHp: z.number().int().positive(),
    teamPosition: z.number().int().min(1).max(6),
    moves: z.array(MoveSchema).min(1).max(4),
    isShiny: z.boolean(),
  }),
  unlockedStageId: z.string().min(1),
});

export const ApiFailureSchema = z.object({
  success: z.literal(false),
  error: z.string().min(1).optional(),
});

export type StarterView = z.infer<typeof StarterViewSchema>;
export type StarterClaimResult = z.infer<typeof StarterClaimResultSchema>;

export function parseStarterCatalog(value: unknown): StarterView[] | null {
  const parsed = StarterCatalogResponseSchema.safeParse(value);
  if (!parsed.success || parsed.data.count !== parsed.data.starters.length) {
    return null;
  }
  return parsed.data.starters;
}
