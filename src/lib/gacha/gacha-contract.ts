import { z } from "zod";

export const PokemonRaritySchema = z.enum(["COMMON", "RARE", "EPIC"]);
export type PokemonRarity = z.infer<typeof PokemonRaritySchema>;

export const GachaPullBodySchema = z
  .object({
    bannerId: z.string().trim().min(1).max(128),
    idempotencyKey: z.string().trim().min(8).max(128),
  })
  .strict();

export const GachaExecutionResultSchema = z.object({
  success: z.literal(true),
  pullId: z.string().min(1),
  bannerId: z.string().min(1),
  pokemon: z.object({
    id: z.string().min(1),
    speciesId: z.string().min(1),
    name: z.string().min(1),
    level: z.number().int().min(1).max(100),
    isShiny: z.boolean(),
    rarity: PokemonRaritySchema,
    nature: z.string().min(1),
    ivs: z.record(z.number().int().min(0).max(31)),
    currentHp: z.number().int().nonnegative(),
    maxHp: z.number().int().positive(),
  }),
  costPaid: z.number().int().nonnegative(),
  newBalance: z.number().int().nonnegative(),
  isDuplicate: z.boolean(),
  isCachedPull: z.boolean().optional(),
});

export const GachaPullSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: GachaExecutionResultSchema,
});

export const GachaFailureResponseSchema = z.object({
  success: z.literal(false),
  code: z.string().optional(),
  error: z.string().min(1).optional(),
});

export type GachaExecutionResult = z.infer<typeof GachaExecutionResultSchema>;

export type ParsedGachaPullResponse =
  | { success: true; data: GachaExecutionResult }
  | { success: false; error?: string };

export function parseGachaPullResponse(
  value: unknown,
): ParsedGachaPullResponse {
  const success = GachaPullSuccessResponseSchema.safeParse(value);
  if (success.success) return success.data;

  const failure = GachaFailureResponseSchema.safeParse(value);
  return failure.success
    ? { success: false, error: failure.data.error }
    : { success: false };
}
