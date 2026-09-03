import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readProtectedJsonBody } from "@/lib/http/request-security";
import { getRequestId, logger } from "@/lib/logger";
import {
  claimQuestReward,
  QuestNotFoundError,
  QuestNotCompletedError,
  QuestRewardAlreadyClaimedError,
} from "@/lib/quests/quest-progress-service";
import { ClaimQuestBodySchema } from "@/lib/quests/quest-contract";

// Une réclamation modifie le solde du joueur : aucune réponse ne doit être cachée.
function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return json({ success: false, error: "Authentification requise." }, 401);
    }

    const body = await readProtectedJsonBody(req, 8 * 1024);
    if (!body.ok) {
      return json({ success: false, error: body.error }, body.status);
    }

    const parsed = ClaimQuestBodySchema.safeParse(body.value);

    if (!parsed.success) {
      return json(
        { success: false, error: "Paramètres de réclamation invalides." },
        400,
      );
    }

    const result = await claimQuestReward(
      session.user.id,
      parsed.data.rotationId,
    );

    return json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof QuestNotFoundError) {
      return json({ success: false, error: error.message }, 404);
    }

    if (
      error instanceof QuestNotCompletedError ||
      error instanceof QuestRewardAlreadyClaimedError
    ) {
      return json({ success: false, error: error.message }, 400);
    }

    logger.error(
      "Échec de la réclamation d'une quête",
      { requestId, action: "quests.claim" },
      error,
    );
    return json(
      { success: false, error: "Impossible de réclamer la récompense." },
      500,
    );
  }
}
