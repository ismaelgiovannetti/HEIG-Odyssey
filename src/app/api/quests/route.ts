import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getUserQuests,
  isQuestProgressPendingForBattle,
} from "@/lib/quests/quest-progress-service";
import { getRequestId, logger } from "@/lib/logger";

const BattleIdSchema = z.string().trim().min(1).max(128);

// La progression est propre au joueur connecté et ne doit jamais être mise en cache.
function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return json(
        { success: false, error: "Authentification requise." },
        401,
      );
    }

    const rawBattleId = new URL(req.url).searchParams.get("afterBattleId");
    let afterBattleId: string | null = null;
    if (rawBattleId !== null) {
      const parsedBattleId = BattleIdSchema.safeParse(rawBattleId);
      if (!parsedBattleId.success) {
        return json(
          { success: false, error: "Identifiant de combat invalide." },
          400,
        );
      }
      afterBattleId = parsedBattleId.data;
    }

    // Le reçu est écrit dans la même transaction que les progressions. Cette
    // vérification doit donc précéder leur lecture : un Promise.all pourrait
    // lire un ancien compteur puis observer le reçu après son commit.
    const syncPending = afterBattleId
      ? await isQuestProgressPendingForBattle(
          session.user.id,
          afterBattleId,
        )
      : false;
    const questsState = await getUserQuests(session.user.id);

    return json({
      success: true,
      data: questsState,
      syncPending,
    });
  } catch (error) {
    logger.error("Échec de la récupération des quêtes", { requestId, action: "quests.list" }, error);
    return json(
      { success: false, error: "Impossible de récupérer les quêtes." },
      500,
    );
  }
}
