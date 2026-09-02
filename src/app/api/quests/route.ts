import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserQuests } from "@/lib/quests/quest-progress-service";
import { getRequestId, logger } from "@/lib/logger";

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

    const questsState = await getUserQuests(session.user.id);

    return json({
      success: true,
      data: questsState,
    });
  } catch (error) {
    logger.error("Échec de la récupération des quêtes", { requestId, action: "quests.list" }, error);
    return json(
      { success: false, error: "Impossible de récupérer les quêtes." },
      500,
    );
  }
}
