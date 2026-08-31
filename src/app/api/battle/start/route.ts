import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BattleEngine } from "@/lib/combat/battle-engine";
import { registerBattleSession } from "@/lib/combat/battle-session-store";
import { getTrainer, loadCampaign } from "@/lib/content/loader";
import {
  validateTeamComposition,
  userPokemonToTrainerPokemon,
} from "@/lib/team/team-validator";

const BattleTargetIdSchema = z.string().trim().min(1).max(100);

const StartBattleBodySchema = z
  .object({
    stageId: BattleTargetIdSchema.optional(),
    trainerId: BattleTargetIdSchema.optional(),
  })
  .strict()
  .superRefine(({ stageId, trainerId }, context) => {
    // Une étape détermine son dresseur. Accepter les deux permettrait de
    // combattre un adversaire faible pour obtenir les gains d'une autre étape.
    if (Boolean(stageId) === Boolean(trainerId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indiquez soit une étape, soit un dresseur.",
      });
    }
  });

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentification requise.";
const BATTLE_START_FAILED_MESSAGE = "Impossible de démarrer le combat.";

export async function POST(req: Request) {
  try {
    // La session serveur est l'unique source de vérité pour l'identité du joueur.
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return NextResponse.json(
        { success: false, error: AUTHENTICATION_REQUIRED_MESSAGE },
        { status: 401 },
      );
    }

    const raw: unknown = await req.json().catch(() => null);
    const parsed = StartBattleBodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Corps de requête invalide", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { stageId, trainerId } = parsed.data;
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

    // Une étape de campagne impose le dresseur défini dans le contenu.
    let targetTrainerId = trainerId;
    if (stageId && !targetTrainerId) {
      const worlds = loadCampaign();
      for (const w of worlds) {
        const found = w.stages.find((s) => s.id === stageId);
        if (found) {
          targetTrainerId = found.trainerId;
          break;
        }
      }
    }

    if (!targetTrainerId) {
      return NextResponse.json(
        { success: false, error: "Dresseur ou étape introuvable" },
        { status: 404 }
      );
    }

    const opponentTrainer = getTrainer(targetTrainerId);
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
    // Les identifiants proviennent de la même lecture que l'équipe donnée au moteur.
    // Déplacer ensuite un participant vers le PC ne transfère pas son XP à son remplaçant.
    registerBattleSession(
      engine, userId, activeTeam.map((pokemon) => pokemon.id), stageId, opponentTrainer.aiProfile,
    );

    const initialState = engine.getState();

    return NextResponse.json({
      success: true,
      battleId: engine.battleId,
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
  } catch {
    // Aucun détail technique ni identifiant interne n'est renvoyé au navigateur.
    console.error("Échec du démarrage du combat.");
    return NextResponse.json(
      { success: false, error: BATTLE_START_FAILED_MESSAGE },
      { status: 500 }
    );
  }
}
