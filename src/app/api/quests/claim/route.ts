import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getApplicationOrigin } from "@/lib/auth/environment";
import { getRequestId, logger } from "@/lib/logger";
import {
  claimQuestReward,
  QuestNotFoundError,
  QuestNotCompletedError,
  QuestRewardAlreadyClaimedError,
} from "@/lib/quests/quest-progress-service";

const ClaimQuestBodySchema = z.object({
  rotationId: z.string().trim().min(1).max(128),
}).strict();

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
      return json(
        { success: false, error: "Authentification requise." },
        401,
      );
    }

    // Défense anti-CSRF : l'origine attendue vient de la configuration validée,
    // et non de l'en-tête Host potentiellement réécrit par un reverse proxy.
    if (req.headers.get("origin") !== getApplicationOrigin()) {
      return json({ success: false, error: "Origine de la requête refusée." }, 403);
    }

    if (
      req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
    ) {
      return json({ success: false, error: "Un corps JSON est requis." }, 415);
    }

    const raw = await req.json().catch(() => null);
    const parsed = ClaimQuestBodySchema.safeParse(raw);

    if (!parsed.success) {
      return json(
        { success: false, error: "Paramètres de réclamation invalides." },
        400,
      );
    }

    const result = await claimQuestReward(session.user.id, parsed.data.rotationId);

    return json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof QuestNotFoundError) {
      return json(
        { success: false, error: error.message },
        404,
      );
    }

    if (error instanceof QuestNotCompletedError || error instanceof QuestRewardAlreadyClaimedError) {
      return json(
        { success: false, error: error.message },
        400,
      );
    }

    logger.error("Échec de la réclamation d'une quête", { requestId, action: "quests.claim" }, error);
    return json(
      { success: false, error: "Impossible de réclamer la récompense." },
      500,
    );
  }
}
