import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  claimQuestReward,
  QuestNotFoundError,
  QuestNotCompletedError,
  QuestRewardAlreadyClaimedError,
} from "@/lib/quests/quest-progress-service";

const ClaimQuestBodySchema = z.object({
  rotationId: z.string().min(1),
}).strict();

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 }
      );
    }

    const raw = await req.json().catch(() => null);
    const parsed = ClaimQuestBodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Paramètres de réclamation invalides." },
        { status: 400 }
      );
    }

    const result = await claimQuestReward(session.user.id, parsed.data.rotationId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof QuestNotFoundError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    if (error instanceof QuestNotCompletedError || error instanceof QuestRewardAlreadyClaimedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error("[API /api/quests/claim] Erreur inattendue :", error);
    return NextResponse.json(
      { success: false, error: "Impossible de réclamer la récompense." },
      { status: 500 }
    );
  }
}
