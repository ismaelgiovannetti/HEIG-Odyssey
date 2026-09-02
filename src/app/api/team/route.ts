import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApplicationOrigin } from "@/lib/auth/environment";
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

function handleError(error: unknown, operation: "lecture" | "sauvegarde" | "relâchement") {
  if (error instanceof TeamPokemonNotOwnedError) return json({ success: false, error: error.message }, 404);
  if (error instanceof TeamPokemonInBattleError) return json({ success: false, error: error.message }, 409);
  if (error instanceof TeamCompositionInvalidError) {
    return json({ success: false, error: error.message, details: error.reasons }, 400);
  }
  if (error instanceof TeamRevisionConflictError) return json({ success: false, code: "COLLECTION_CHANGED", error: error.message }, 409);
  if (error instanceof PcCapacityExceededError) return json({ success: false, code: "PC_FULL", error: error.message }, 409);
  if (error instanceof TeamOnboardingRequiredError) return json({ success: false, error: error.message }, 403);

  // Pas de corps de requête, cookie ou erreur Prisma dans les journaux publics.
  console.error(`Échec de la ${operation} de la collection.`);
  return json({ success: false, error: "Impossible de traiter la collection pour le moment." }, 500);
}

/** GET n'accepte aucun userId : la session est la seule source de l'identité. */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user.id) return json({ success: false, error: "Authentification requise." }, 401);
    if (!session.user.emailVerified) return json({ success: false, error: "Vérifiez votre adresse e-mail." }, 403);
    return json({ success: true, ...await getPlayerCollection(session.user.id) });
  } catch (error) {
    return handleError(error, "lecture");
  }
}

/** Lit au maximum 256 Kio, même si Content-Length est absent ou mensonger. */
async function readBody(req: Request): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256 * 1024) {
        await reader.cancel();
        throw new RangeError("TEAM_BODY_TOO_LARGE");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user.id) return json({ success: false, error: "Authentification requise." }, 401);
    if (!session.user.emailVerified) return json({ success: false, error: "Vérifiez votre adresse e-mail." }, 403);

    // L'origine validée vient de la configuration, jamais de l'en-tête Host du proxy.
    if (req.headers.get("origin") !== getApplicationOrigin()) {
      return json({ success: false, error: "Origine de la requête refusée." }, 403);
    }
    if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return json({ success: false, error: "Un corps JSON est requis." }, 415);
    }

    let raw: unknown;
    try {
      raw = await readBody(req);
    } catch (error) {
      return json({ success: false, error: "Corps de requête invalide ou trop volumineux." }, error instanceof RangeError ? 413 : 400);
    }
    const parsed = UpdateTeamBodySchema.safeParse(raw);
    if (!parsed.success) return json({ success: false, error: "Requête invalide.", details: parsed.error.issues }, 400);

    // Le client fournit uniquement le rangement et la version qu'il a consultée.
    return json({ success: true, ...await updateActiveTeam(session.user.id, parsed.data) });
  } catch (error) {
    return handleError(error, "sauvegarde");
  }
}

/** DELETE ne reçoit que l'identifiant possédé et la version affichée au joueur. */
export async function DELETE(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user.id) return json({ success: false, error: "Authentification requise." }, 401);
    if (!session.user.emailVerified) return json({ success: false, error: "Vérifiez votre adresse e-mail." }, 403);

    if (req.headers.get("origin") !== getApplicationOrigin()) {
      return json({ success: false, error: "Origine de la requête refusée." }, 403);
    }
    if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return json({ success: false, error: "Un corps JSON est requis." }, 415);
    }

    let raw: unknown;
    try {
      raw = await readBody(req);
    } catch (error) {
      return json({ success: false, error: "Corps de requête invalide ou trop volumineux." }, error instanceof RangeError ? 413 : 400);
    }
    const parsed = ReleasePokemonBodySchema.safeParse(raw);
    if (!parsed.success) return json({ success: false, error: "Requête invalide." }, 400);

    return json({ success: true, ...await releasePokemon(session.user.id, parsed.data) });
  } catch (error) {
    return handleError(error, "relâchement");
  }
}
