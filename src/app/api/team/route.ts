import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readProtectedJsonBody } from "@/lib/http/request-security";
import { getRequestId, logger } from "@/lib/logger";
import {
  ReleasePokemonBodySchema,
  UpdateTeamBodySchema,
} from "@/lib/team/team-contract";
import {
  getPlayerCollection, releasePokemon, updateActiveTeam, TeamCompositionInvalidError,
  TeamPokemonInBattleError, TeamPokemonNotOwnedError, TeamRevisionConflictError,
  TeamOnboardingRequiredError,
  PcCapacityExceededError,
} from "@/lib/team/team-service";

// Les réponses contiennent une collection privée, y compris après une erreur.
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function handleError(
  error: unknown,
  operation: "lecture" | "sauvegarde" | "relâchement",
  requestId: string,
) {
  if (error instanceof TeamPokemonNotOwnedError) return json({ success: false, error: error.message }, 404);
  if (error instanceof TeamPokemonInBattleError) return json({ success: false, error: error.message }, 409);
  if (error instanceof TeamCompositionInvalidError) {
    return json({ success: false, error: error.message, details: error.reasons }, 400);
  }
  if (error instanceof TeamRevisionConflictError) return json({ success: false, code: "COLLECTION_CHANGED", error: error.message }, 409);
  if (error instanceof PcCapacityExceededError) return json({ success: false, code: "PC_FULL", error: error.message }, 409);
  if (error instanceof TeamOnboardingRequiredError) return json({ success: false, error: error.message }, 403);

  // Pas de corps de requête, cookie ou erreur Prisma dans les journaux publics.
  logger.error(
    `Échec de la ${operation} de la collection`,
    {
      requestId,
      action:
        operation === "lecture"
          ? "team.read"
          : operation === "relâchement"
            ? "team.release"
            : "team.update",
    },
    error,
  );
  return json({ success: false, error: "Impossible de traiter la collection pour le moment." }, 500);
}

/** GET n'accepte aucun userId : la session est la seule source de l'identité. */
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user.id) return json({ success: false, error: "Authentification requise." }, 401);
    if (!session.user.emailVerified) return json({ success: false, error: "Vérifiez votre adresse e-mail." }, 403);
    return json({ success: true, ...await getPlayerCollection(session.user.id) });
  } catch (error) {
    return handleError(error, "lecture", requestId);
  }
}

export async function PUT(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user.id) return json({ success: false, error: "Authentification requise." }, 401);
    if (!session.user.emailVerified) return json({ success: false, error: "Vérifiez votre adresse e-mail." }, 403);

    const body = await readProtectedJsonBody(req, 256 * 1024);
    if (!body.ok) return json({ success: false, error: body.error }, body.status);
    const parsed = UpdateTeamBodySchema.safeParse(body.value);
    if (!parsed.success) return json({ success: false, error: "Requête invalide.", details: parsed.error.issues }, 400);

    // Le client fournit uniquement le rangement et la version qu'il a consultée.
    return json({ success: true, ...await updateActiveTeam(session.user.id, parsed.data) });
  } catch (error) {
    return handleError(error, "sauvegarde", requestId);
  }
}

/** DELETE ne reçoit que l'identifiant possédé et la version affichée au joueur. */
export async function DELETE(req: Request) {
  const requestId = getRequestId(req);

  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user.id) return json({ success: false, error: "Authentification requise." }, 401);
    if (!session.user.emailVerified) return json({ success: false, error: "Vérifiez votre adresse e-mail." }, 403);

    const body = await readProtectedJsonBody(req, 256 * 1024);
    if (!body.ok) return json({ success: false, error: body.error }, body.status);
    const parsed = ReleasePokemonBodySchema.safeParse(body.value);
    if (!parsed.success) return json({ success: false, error: "Requête invalide." }, 400);

    return json({ success: true, ...await releasePokemon(session.user.id, parsed.data) });
  } catch (error) {
    return handleError(error, "relâchement", requestId);
  }
}
