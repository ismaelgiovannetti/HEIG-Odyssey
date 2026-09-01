import { z } from "zod";
import {
  BaseStatsSchema,
  MoveSchema,
  PokemonTypeEnum,
} from "../content/schemas";
import {
  PC_BOX_CAPACITY,
  PC_BOX_COUNT,
  PC_CAPACITY,
  PC_COLUMNS,
  PC_ROWS,
  TEAM_CAPACITY,
} from "./team-contract";

// Valider la réponse évite d'afficher un rangement incomplet puis de le renvoyer
// au serveur. Aucun import Prisma ou moteur de combat n'entre dans le navigateur.
const EntrySchema = z.object({
  id: z.string().min(1),
  speciesId: z.string().min(1),
  name: z.string(),
  nickname: z.string().nullable(),
  level: z.number().int().min(1).max(100),
  experience: z.number().nonnegative(),
  currentHp: z.number().nonnegative(),
  maxHp: z.number().positive(),
  isShiny: z.boolean(),
  teamPosition: z.number().int().min(1).max(TEAM_CAPACITY).nullable(),
  boxNumber: z.number().int().min(1).max(PC_BOX_COUNT).nullable(),
  boxSlot: z.number().int().min(1).max(PC_BOX_CAPACITY).nullable(),
  types: z.array(PokemonTypeEnum).min(1).max(2),
  dexNumber: z.number().int().positive().optional(),
  ability: z.string().nullable(),
  nature: z.string().nullable(),
  stats: BaseStatsSchema.nullable(),
  moves: z
    .array(MoveSchema.extend({ pp: z.number().int().nonnegative() }))
    .max(4),
});

const SnapshotSchema = z
  .object({
    success: z.literal(true),
    revision: z.number().int().nonnegative(),
    count: z.number().int().nonnegative(),
    pokemon: z.array(EntrySchema).max(PC_CAPACITY + TEAM_CAPACITY),
    pc: z.object({
      columns: z.literal(PC_COLUMNS),
      rows: z.literal(PC_ROWS),
      boxes: z
        .array(z.object({ number: z.number().int(), name: z.string() }))
        .length(PC_BOX_COUNT),
    }),
  })
  .refine((data) => {
    const positions = new Set<string>();
    const ids = new Set<string>();
    const teamSlots: number[] = [];
    for (const entry of data.pokemon) {
      if (ids.has(entry.id)) return false;
      ids.add(entry.id);
      if (entry.teamPosition !== null) {
        if (entry.boxNumber !== null || entry.boxSlot !== null) return false;
        teamSlots.push(entry.teamPosition);
      } else if (entry.boxNumber === null || entry.boxSlot === null)
        return false;
      const position =
        entry.teamPosition === null
          ? `pc:${entry.boxNumber}:${entry.boxSlot}`
          : `team:${entry.teamPosition}`;
      if (positions.has(position)) return false;
      positions.add(position);
    }
    return (
      data.count === ids.size &&
      teamSlots.sort((a, b) => a - b).every((slot, i) => slot === i + 1) &&
      data.pc.boxes.every((box, i) => box.number === i + 1)
    );
  });

export type CollectionSnapshot = z.infer<typeof SnapshotSchema>;

export class TeamRequestError extends Error {
  constructor(
    message: string,
    readonly needsReload = false,
    readonly needsLogin = false,
  ) {
    super(message);
  }
}

/** Les erreurs techniques ne sont pas recopiées dans l'interface ni dans les logs. */
export async function readTeamResponse(
  response: Response,
): Promise<CollectionSnapshot> {
  if (response.status === 401)
    throw new TeamRequestError(
      "Votre session a expiré. Reconnectez-vous pour continuer.",
      true,
      true,
    );
  if (response.status === 403)
    throw new TeamRequestError(
      "Accès refusé. Vérifiez votre session et votre adresse e-mail.",
      true,
      true,
    );
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = z
      .object({
        code: z.string().optional(),
        details: z.array(z.string()).optional(),
      })
      .safeParse(body);
    if (
      response.status === 409 &&
      failure.success &&
      failure.data.code === "COLLECTION_CHANGED"
    ) {
      throw new TeamRequestError(
        "Votre collection a changé dans une autre fenêtre ou après une récompense. Rechargez-la avant de réessayer.",
        true,
      );
    }
    if (
      response.status === 409 &&
      failure.success &&
      failure.data.code === "PC_FULL"
    ) {
      throw new TeamRequestError(
        "Le PC est plein. Gardez davantage de Pokémon dans votre équipe.",
      );
    }
    if (response.status === 400) {
      // Seules les raisons fonctionnelles prévues par l'API sont présentées.
      const reasons = failure.success
        ? failure.data.details?.slice(0, 3).join(" ")
        : undefined;
      throw new TeamRequestError(
        reasons ||
          "Cette composition est refusée. Vérifiez les places et gardez un Pokémon apte au combat.",
      );
    }
    if (response.status === 404)
      throw new TeamRequestError(
        "Un Pokémon n'est plus disponible. Rechargez votre collection.",
        true,
      );
    throw new TeamRequestError(
      "Impossible de confirmer l'état de la collection. Rechargez-la avant de continuer.",
      true,
    );
  }
  const parsed = SnapshotSchema.safeParse(body);
  if (!parsed.success)
    throw new TeamRequestError(
      "La réponse de la collection est incomplète. Rechargez-la avant de continuer.",
      true,
    );
  return parsed.data;
}
