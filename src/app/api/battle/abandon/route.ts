import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { abandonBattleSession } from "@/lib/combat/battle-session-store";
import { getRequestId, logger } from "@/lib/logger";

const AbandonBodySchema = z
  .object({ battleId: z.string().trim().min(1).max(100) })
  .strict();

/**
 * Le client appelle cette route (fetch keepalive ou `navigator.sendBeacon`)
 * lorsqu'il quitte l'arène sans terminer le combat. La session est libérée pour
 * ne plus verrouiller l'édition des attaques / de l'équipe / des évolutions.
 */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user.id) {
      // Réponse neutre : abandonner un combat inexistant n'a pas d'effet.
      return NextResponse.json({ success: true });
    }

    const raw: unknown = await req.json().catch(() => null);
    const parsed = AbandonBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Requête invalide" },
        { status: 400 },
      );
    }

    abandonBattleSession(parsed.data.battleId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      "Échec de l'abandon d'un combat",
      { requestId, action: "battle.abandon" },
      error,
    );
    // L'abandon est best-effort : la fenêtre d'inactivité serveur prend le relais.
    return NextResponse.json({ success: true });
  }
}
