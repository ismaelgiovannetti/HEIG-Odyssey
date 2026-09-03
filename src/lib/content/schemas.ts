import { z } from "zod";

// ----------------------------------------------------
// 1. Schéma des capacités
// ----------------------------------------------------
export const PokemonTypeEnum = z.enum([
  "Normal",
  "Fire",
  "Water",
  "Grass",
  "Electric",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Steel",
  "Dark",
]);

export type PokemonType = z.infer<typeof PokemonTypeEnum>;

export const MoveSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: PokemonTypeEnum,
  category: z.enum(["physical", "special", "status"]),
  power: z.number().int().min(0),
  accuracy: z.number().int().min(0).max(100),
  pp: z.number().int().min(1),
  maxPp: z.number().int().min(1),
  priority: z.number().int().default(0),
  description: z.string().optional(),
});

export type Move = z.infer<typeof MoveSchema>;

// ----------------------------------------------------
// 2. Schéma des espèces
// ----------------------------------------------------
export const BaseStatsSchema = z.object({
  hp: z.number().int().positive(),
  attack: z.number().int().positive(),
  defense: z.number().int().positive(),
  specialAttack: z.number().int().positive(),
  specialDefense: z.number().int().positive(),
  speed: z.number().int().positive(),
});

export type BaseStats = z.infer<typeof BaseStatsSchema>;

export const SpeciesSchema = z.object({
  id: z.string().min(1),
  dexNumber: z.number().int().min(1).max(493),
  name: z.string().min(1),
  generation: z.number().int().min(1).max(4),
  types: z.array(PokemonTypeEnum).min(1).max(2),
  baseStats: BaseStatsSchema,
  stage: z.number().int().min(1).max(3).default(1),
  isLegendary: z.boolean().default(false),
  isMythical: z.boolean().default(false),
  isStarterEligible: z.boolean().default(false),
  defaultMoves: z.array(z.string()).min(1).max(4),
  possibleAbilities: z.array(z.string()).min(1),
});

export type Species = z.infer<typeof SpeciesSchema>;

export const SpeciesConfigSchema = z.object({
  version: z.string(),
  species: z.array(SpeciesSchema).min(1),
});

// ----------------------------------------------------
// 3. Configuration des Pokémon de départ
// ----------------------------------------------------
export const StarterOptionSchema = z.object({
  speciesId: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().default(5),
  moves: z.array(MoveSchema).min(1).max(4),
  description: z.string().optional(),
});

export type StarterOption = z.infer<typeof StarterOptionSchema>;

export const StartersConfigSchema = z.object({
  version: z.string(),
  description: z.string(),
  starters: z.array(StarterOptionSchema).min(1),
});

// ----------------------------------------------------
// 4. Schéma des dresseurs et adversaires
// ----------------------------------------------------
export const AIProfileEnum = z.enum(["random", "heuristic", "expectiminimax"]);
export type AIProfile = z.infer<typeof AIProfileEnum>;

export const TrainerPokemonSchema = z.object({
  speciesId: z.string().min(1),
  nickname: z.string().optional(),
  level: z.number().int().min(1).max(100),
  isShiny: z.boolean().optional().default(false),
  moves: z.array(MoveSchema).min(1).max(4),
  ivs: z
    .object({
      hp: z.number().int().min(0).max(31).default(15),
      atk: z.number().int().min(0).max(31).default(15),
      def: z.number().int().min(0).max(31).default(15),
      spa: z.number().int().min(0).max(31).default(15),
      spd: z.number().int().min(0).max(31).default(15),
      spe: z.number().int().min(0).max(31).default(15),
    })
    .optional()
    .default({}),
  nature: z.string().optional().default("Hardy"),
});

export type TrainerPokemon = z.infer<typeof TrainerPokemonSchema>;
export type TrainerPokemonInput = z.input<typeof TrainerPokemonSchema>;

export const TrainerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  aiProfile: AIProfileEnum,
  sprite: z.string().min(1),
  introCatchline: z.string().min(1),
  victoryCatchline: z.string().min(1),
  defeatCatchline: z.string().min(1),
  musicTrack: z.string().default("battle-theme-1"),
  team: z.array(TrainerPokemonSchema).min(1).max(6),
});

export type Trainer = z.infer<typeof TrainerSchema>;

export const TrainersConfigSchema = z.object({
  version: z.string(),
  trainers: z.array(TrainerSchema).min(1),
});

// ----------------------------------------------------
// 5. Schéma de progression de la campagne
// ----------------------------------------------------
export const CampaignDegreeEnum = z.enum(["BACHELOR", "MASTER", "DOCTORAT"]);

export const CampaignStageSchema = z.object({
  id: z.string().min(1),
  stageNumber: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string(),
  recommendedLevel: z.number().int().positive(),
  trainerId: z.string().min(1),
  prerequisiteStageId: z.string().nullable().default(null),
  rewardMoney: z.number().int().min(0),
  rewardXp: z.number().int().min(0),
});

export type CampaignStage = z.infer<typeof CampaignStageSchema>;

export const CampaignWorldSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  degree: CampaignDegreeEnum,
  description: z.string(),
  stages: z.array(CampaignStageSchema).min(1),
});

export type CampaignWorld = z.infer<typeof CampaignWorldSchema>;

export const CampaignConfigSchema = z.object({
  version: z.string(),
  worlds: z.array(CampaignWorldSchema).min(1),
});

// ----------------------------------------------------
// 6. Schéma des bannières de recrutement
// ----------------------------------------------------
export const GachaBannerConfigSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    costPokedollars: z.number().int().positive(),
    rates: z.object({
      common: z.number().min(0).max(1),
      rare: z.number().min(0).max(1),
      epic: z.number().min(0).max(1),
      shinyRate: z.number().min(0).max(1),
    }),
    poolSpecies: z.array(z.string()).min(1),
    isActive: z.boolean().default(true),
  })
  .superRefine((banner, context) => {
    const rarityTotal =
      banner.rates.common + banner.rates.rare + banner.rates.epic;
    if (Math.abs(rarityTotal - 1) > 1e-9) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rates"],
        message: "Common, rare and epic rates must add up to 1",
      });
    }

    if (new Set(banner.poolSpecies).size !== banner.poolSpecies.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["poolSpecies"],
        message: "A gacha pool cannot contain duplicate species",
      });
    }
  });

export type GachaBannerConfig = z.infer<typeof GachaBannerConfigSchema>;

export const GachaConfigSchema = z.object({
  version: z.string(),
  banners: z.array(GachaBannerConfigSchema).min(1),
});
