import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BattleEngine } from "@/lib/combat/battle-engine";
import { registerBattleSession } from "@/lib/combat/battle-session-store";
import { getTrainer, loadCampaign } from "@/lib/content/loader";
import {
  validateTeamComposition,
  userPokemonToTrainerPokemon,
} from "@/lib/team/team-validator";

const StartBattleBodySchema = z.object({
  userId: z.string().min(1),
  stageId: z.string().optional(),
  trainerId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = StartBattleBodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Corps de requête invalide", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { userId, stageId, trainerId } = parsed.data;

    // 1. Fetch player's active team from DB
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

    // 2. Determine Opponent Trainer
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
        { success: false, error: `Dresseur ${targetTrainerId} non configuré` },
        { status: 404 }
      );
    }

    // 3. Convert player team
    const p1Team = activeTeam.map(userPokemonToTrainerPokemon);

    // 4. Initialize BattleEngine
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

    // 5. Register in session store
    registerBattleSession(engine, userId, stageId, opponentTrainer.aiProfile);

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
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
