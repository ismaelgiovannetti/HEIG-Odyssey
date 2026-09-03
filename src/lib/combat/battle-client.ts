import { z } from "zod";

// Le navigateur valide les réponses avant de les afficher. Une réponse
// incomplète ne doit jamais devenir un état de combat partiellement utilisable.
const BattleMoveSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  category: z.enum(["physical", "special", "status"]),
  power: z.number().nonnegative(),
  accuracy: z.number().nonnegative(),
  pp: z.number().int().nonnegative(),
  maxPp: z.number().int().nonnegative(),
  disabled: z.boolean().optional(),
});

const BattlePokemonSchema = z.object({
  id: z.string().min(1),
  speciesId: z.string().min(1),
  name: z.string().min(1),
  nickname: z.string().optional(),
  level: z.number().int().min(1).max(100),
  types: z.array(z.string().min(1)).min(1).max(2),
  currentHp: z.number().nonnegative(),
  maxHp: z.number().positive(),
  hpPercent: z.number().min(0).max(100),
  // Champ purement décoratif : une valeur inattendue (« fnt » d'un combattant
  // K.O., statut d'une génération ultérieure...) ne doit jamais invalider tout
  // le tour et figer l'arène. On retombe alors sur « aucune altération ».
  status: z
    .enum(["brn", "par", "slp", "psn", "tox", "frz"])
    .nullable()
    .catch(null),
  moves: z.array(BattleMoveSchema).max(4),
  isShiny: z.boolean(),
  isActive: z.boolean(),
  isFainted: z.boolean(),
  baseStats: z.object({
    hp: z.number(),
    attack: z.number(),
    defense: z.number(),
    specialAttack: z.number(),
    specialDefense: z.number(),
    speed: z.number(),
  }),
});

const BattleSideSchema = z.object({
  sideId: z.enum(["p1", "p2"]),
  name: z.string(),
  avatar: z.string().optional(),
  team: z.array(BattlePokemonSchema).min(1).max(6),
  activePokemonIndex: z.number().int().min(0).max(5),
});

export const BattleStateSchema = z.object({
  battleId: z.string().min(1),
  turn: z.number().int().nonnegative(),
  phase: z.enum(["action_selection", "switch_required", "finished"]),
  p1: BattleSideSchema,
  p2: BattleSideSchema,
  winner: z.enum(["p1", "p2"]).nullable(),
  logs: z.array(z.string()),
});

const TrainerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().optional(),
  sprite: z.string().optional(),
  introCatchline: z.string().optional(),
  victoryCatchline: z.string().optional(),
  defeatCatchline: z.string().optional(),
  musicTrack: z.string().optional(),
});

const RewardSchema = z.object({
  isAlreadyClaimed: z.boolean(),
  moneyEarned: z.number().int().nonnegative(),
  xpEarned: z.number().int().nonnegative(),
  newBalance: z.number().int().nonnegative(),
  stageCompleted: z.boolean(),
  unlockedNextStageId: z.string().nullable(),
  teamLeveledUp: z.array(z.object({
    pokemonId: z.string().min(1),
    speciesId: z.string().min(1),
    name: z.string().min(1),
    oldLevel: z.number().int().min(1).max(100),
    newLevel: z.number().int().min(1).max(100),
    newCurrentHp: z.number().nonnegative(),
    newMaxHp: z.number().positive(),
  })),
});

export const EventSchema = z.object({
  type: z.string().min(1),
  turn: z.number().int().nonnegative(),
  message: z.string(),
  side: z.enum(["p1", "p2"]).optional(),
  currentHp: z.number().optional(),
  maxHp: z.number().optional(),
  multiplier: z.number().optional(),
  status: z.string().optional(),
  hitCount: z.number().optional(),
  residual: z.boolean().optional(),
  fromEffect: z.string().optional(),
}).passthrough();

const StartResponseSchema = z.object({
  success: z.literal(true),
  battleId: z.string().min(1),
  // Thème du décor d'arène ; valeur libre tolérée, l'interface retombe sur un
  // décor neutre si elle ne la connaît pas.
  arena: z.string().min(1).optional(),
  trainer: TrainerSchema,
  state: BattleStateSchema,
});

const ActionResponseSchema = z.object({
  success: z.literal(true),
  turn: z.number().int().nonnegative(),
  events: z.array(EventSchema),
  state: BattleStateSchema,
  rewards: RewardSchema.optional(),
});

const FailureSchema = z.object({
  error: z.string().trim().min(1).max(300).optional(),
});

const ConflictSchema = FailureSchema.extend({
  state: BattleStateSchema,
});

export type BattleStartPayload = z.infer<typeof StartResponseSchema>;
export type BattleActionPayload = z.infer<typeof ActionResponseSchema>;
export type BattleRewardPayload = z.infer<typeof RewardSchema>;
export type BattleStatePayload = z.infer<typeof BattleStateSchema>;
export type BattlePokemonPayload = z.infer<typeof BattlePokemonSchema>;

export class BattleRequestError extends Error {
  constructor(
    message: string,
    readonly needsLogin = false,
  ) {
    super(message);
    this.name = "BattleRequestError";
  }
}

export class BattleStateConflictError extends BattleRequestError {
  constructor(
    message: string,
    readonly state: BattleStatePayload,
  ) {
    super(message);
    this.name = "BattleStateConflictError";
  }
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/** Convertit une réponse d'échec en message neutre exploitable par l'interface. */
function failureMessage(response: Response, body: unknown): BattleRequestError {
  if (response.status === 401 || response.status === 403) {
    return new BattleRequestError(
      "Votre session n'est plus utilisable. Reconnectez-vous pour continuer.",
      true,
    );
  }
  const parsed = FailureSchema.safeParse(body);
  return new BattleRequestError(
    parsed.success && parsed.data.error
      ? parsed.data.error
      : "Le serveur n'a pas pu traiter le combat.",
  );
}

/** Lit le combat créé par le serveur sans faire confiance à sa forme JSON. */
export async function readBattleStartResponse(
  response: Response,
): Promise<BattleStartPayload> {
  const body = await readJson(response);
  if (!response.ok) throw failureMessage(response, body);
  const parsed = StartResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new BattleRequestError(
      "La préparation reçue est incomplète. Relancez le combat.",
    );
  }
  return parsed.data;
}

/** Valide chaque nouveau tour avant de remplacer l'état visible. */
export async function readBattleActionResponse(
  response: Response,
): Promise<BattleActionPayload> {
  const body = await readJson(response);
  if (response.status === 409) {
    const conflict = ConflictSchema.safeParse(body);
    if (conflict.success) {
      throw new BattleStateConflictError(
        conflict.data.error ?? "Le combat a avancé. L'affichage a été actualisé.",
        conflict.data.state,
      );
    }
  }
  if (!response.ok) throw failureMessage(response, body);
  const parsed = ActionResponseSchema.safeParse(body);
  if (!parsed.success) {
    // Les chemins Zod suffisent au diagnostic sans journaliser l'état du joueur.
    if (process.env.NODE_ENV === "development") {
      console.error("Réponse de combat invalide :", parsed.error.issues);
    }
    throw new BattleRequestError(
      "L'état du combat reçu est incomplet. Revenez à l'espace précédent.",
    );
  }
  return parsed.data;
}
