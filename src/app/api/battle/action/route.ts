import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  BattleActionRejectedError,
  BattleSessionUnavailableError,
  processBattleTurn,
} from "@/lib/combat/battle-session-store";

const BattleActionBodySchema = z.object({
  battleId: z.string().trim().min(1).max(100),
  expectedTurn: z.number().int().nonnegative(),
  expectedPhase: z.enum(["action_selection", "switch_required"]),
  action: z.union([
    z.object({
      type: z.literal("move"),
      moveIndex: z.number().int().min(0).max(3),
    }).strict(),
    z.object({
      type: z.literal("switch"),
      targetPokemonIndex: z.number().int().min(0).max(5),
    }).strict(),
  ]),
}).strict();

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentification requise.";
const BATTLE_UNAVAILABLE_MESSAGE = "Combat introuvable ou expiré.";
const BATTLE_ACTION_FAILED_MESSAGE = "Impossible de traiter l'action de combat.";

export async function POST(req: Request) {
  try {
    // Better Auth valide le cookie avant toute lecture ou mutation du combat.
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return NextResponse.json(
        { success: false, error: AUTHENTICATION_REQUIRED_MESSAGE },
        { status: 401 },
      );
    }

    const raw: unknown = await req.json().catch(() => null);
    const parsed = BattleActionBodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Action invalide", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { battleId, action } = parsed.data;

    // Le stockage compare cet identifiant au propriétaire enregistré du combat.
    const result = await processBattleTurn(
      battleId,
      session.user.id,
      action,
      { turn: parsed.data.expectedTurn, phase: parsed.data.expectedPhase },
    );

    return NextResponse.json({
      success: true,
      turn: result.turnResult.turn,
      events: result.turnResult.events,
      state: result.turnResult.state,
      rewards: result.rewards,
    });
  } catch (error) {
    if (error instanceof BattleSessionUnavailableError) {
      return NextResponse.json(
        { success: false, error: BATTLE_UNAVAILABLE_MESSAGE },
        { status: 404 },
      );
    }

    if (error instanceof BattleActionRejectedError) {
      return NextResponse.json(
        {
          success: false,
          error: "Le combat a déjà avancé. L'état affiché a été actualisé.",
          state: error.state,
        },
        { status: 409 },
      );
    }

    // Les erreurs inattendues restent côté serveur sans exposer leur message.
    console.error("Échec du traitement d'une action de combat.");
    return NextResponse.json(
      { success: false, error: BATTLE_ACTION_FAILED_MESSAGE },
      { status: 500 },
    );
  }
}
