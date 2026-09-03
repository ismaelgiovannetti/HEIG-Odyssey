import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BattleEngine } from "@/lib/combat/battle-engine";
import { registerBattleSession } from "@/lib/combat/battle-session-store";
import { arenaThemeForStage } from "@/lib/campaign/arena-theme";
import { canUserAccessStage } from "@/lib/campaign/campaign-service";
import { getTrainer } from "@/lib/content/loader";
import {
  validateTeamComposition,
  userPokemonToTrainerPokemon,
} from "@/lib/team/team-validator";

import {
  computeAverageTeamLevel,
  generateTrainingOpponent,
  type TrainingDifficulty,
} from "@/lib/combat/training-generator";
import type { Trainer } from "@/lib/content/schemas";
import { readProtectedJsonBody } from "@/lib/http/request-security";
import { getRequestId, logger } from "@/lib/logger";
import { consumeFixedWindowRateLimit } from "@/lib/security/rate-limit";

const BattleTargetIdSchema = z.string().trim().min(1).max(100);

const StartBattleBodySchema = z
  .object({
    stageId: BattleTargetIdSchema.optional(),
    mode: z.enum(["campaign", "training"]).optional(),
    difficulty: z.enum(["easy", "normal", "hard"]).optional(),
  })
  .strict()
  .superRefine(({ stageId, mode, difficulty }, context) => {
    if (mode === "training") {
      if (stageId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Le mode entraînement ne requiert pas de stageId.",
        });
      }
      return;
    }

    // La difficulté appartient exclusivement à l'entraînement. En campagne,
    // le profil d'IA est imposé par la configuration serveur du dresseur.
    if (difficulty) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La difficulté ne peut être choisie qu'en entraînement.",
      });
    }

    // En campagne, le serveur résout toujours le dresseur depuis une étape autorisée.
    if (!stageId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indiquez une étape de campagne.",
      });
    }
  });

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentification requise.";
const BATTLE_START_FAILED_MESSAGE = "Impossible de démarrer le combat.";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    // La session serveur est l'unique source de vérité pour l'identité du joueur.
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return NextResponse.json(
        { success: false, error: AUTHENTICATION_REQUIRED_MESSAGE },
        { status: 401 },
      );
    }

    const rateLimit = await consumeFixedWindowRateLimit(
      "battle-start",
      session.user.id,
      { window: 60, max: 12 },
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Trop de combats démarrés. Réessayez plus tard." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter) },
        },
      );
    }

    const body = await readProtectedJsonBody(req, 8 * 1024);
    if (!body.ok) {
      return NextResponse.json(
        { success: false, error: body.error },
        { status: body.status },
      );
    }

    const parsed = StartBattleBodySchema.safeParse(body.value);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Corps de requête invalide", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { stageId, mode, difficulty } = parsed.data;
    const userId = session.user.id;

    // L'équipe chargée appartient obligatoirement au compte authentifié.
    const activeTeam = await prisma.userPokemon.findMany({
      where: {
        userId,
        teamPosition: { not: null },
      },
      orderBy: { teamPosition: "asc" },
    });

    const validation = validateTeamComposition(activeTeam);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: "Équipe invalide", details: validation.errors },
        { status: 400 }
      );
    }

    let opponentTrainer: Trainer | undefined;
    const isTraining = mode === "training";
    const selectedDifficulty: TrainingDifficulty = difficulty || "easy";

    if (isTraining) {
      const avgLevel = computeAverageTeamLevel(activeTeam);
      opponentTrainer = generateTrainingOpponent({
        averageLevel: avgLevel,
        difficulty: selectedDifficulty,
        teamSize: activeTeam.length,
      });
    } else {
      // Une étape de campagne impose le dresseur défini dans le contenu et exige l'autorisation d'accès.
      const accessCheck = await canUserAccessStage(userId, stageId!);
      if (!accessCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: accessCheck.reason ?? "Accès refusé à cette étape de campagne.",
          },
          { status: 403 }
        );
      }

      if (!accessCheck.trainerId) {
        return NextResponse.json(
          { success: false, error: "Dresseur ou étape introuvable" },
          { status: 404 }
        );
      }

      opponentTrainer = getTrainer(accessCheck.trainerId);
    }

    if (!opponentTrainer) {
      return NextResponse.json(
        { success: false, error: "Dresseur ou étape introuvable" },
        { status: 404 }
      );
    }

    // Le format stocké en base est converti vers celui attendu par le moteur.
    const p1Team = activeTeam.map(userPokemonToTrainerPokemon);

    // Le moteur reçoit uniquement l'équipe du propriétaire authentifié.
    const engine = new BattleEngine({
      p1: {
        name: "Joueur",
        team: p1Team,
      },
      p2: {
        name: opponentTrainer.name,
        avatar: opponentTrainer.sprite,
        team: opponentTrainer.team,
      },
    });

    // La session de combat mémorise son propriétaire pour chaque action future.
    registerBattleSession(
      engine,
      userId,
      activeTeam.map((pokemon) => pokemon.id),
      stageId,
      opponentTrainer.aiProfile,
      {
        battleType: isTraining ? "TRAINING" : "CAMPAIGN",
        difficulty: isTraining ? selectedDifficulty : undefined,
      }
    );


    const initialState = engine.getState();

    return NextResponse.json({
      success: true,
      battleId: engine.battleId,
      // Décor de l'arène : type du monde en campagne, générique en entraînement.
      arena: isTraining ? "training" : arenaThemeForStage(stageId),
      trainer: {
        id: opponentTrainer.id,
        name: opponentTrainer.name,
        title: opponentTrainer.title,
        sprite: opponentTrainer.sprite,
        introCatchline: opponentTrainer.introCatchline,
        victoryCatchline: opponentTrainer.victoryCatchline,
        defeatCatchline: opponentTrainer.defeatCatchline,
        musicTrack: opponentTrainer.musicTrack,
      },
      state: initialState,
    });
  } catch (error) {
    // Aucun détail technique ni identifiant interne n'est renvoyé au navigateur.
    logger.error("Échec du démarrage du combat", { requestId, action: "battle.start" }, error);
    return NextResponse.json(
      { success: false, error: BATTLE_START_FAILED_MESSAGE },
      { status: 500 }
    );
  }
}
