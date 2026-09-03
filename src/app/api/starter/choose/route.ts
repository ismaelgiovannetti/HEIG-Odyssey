import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readProtectedJsonBody } from "@/lib/http/request-security";
import { getRequestId, logger } from "@/lib/logger";
import { selectStarter } from "@/lib/starter/starter-service";
import { StarterChooseBodySchema } from "@/lib/starter/starter-contract";

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentification requise.";
const STARTER_SELECTION_FAILED_MESSAGE =
  "Impossible de sélectionner le starter pour le moment.";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    // Better Auth vérifie le cookie de session reçu avec la requête.
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: AUTHENTICATION_REQUIRED_MESSAGE,
        },
        { status: 401 },
      );
    }

    const body = await readProtectedJsonBody(req, 8 * 1024);
    if (!body.ok) {
      return NextResponse.json(
        { success: false, error: body.error },
        { status: body.status },
      );
    }

    const parsed = StarterChooseBodySchema.safeParse(body.value);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Requête invalide",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const { speciesId, nickname } = parsed.data;

    // Ne jamais accepter un userId envoyé par le client : la session est la
    // seule source de vérité pour le propriétaire du starter.
    const result = await selectStarter(session.user.id, speciesId, nickname);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const isConflict =
      message.includes("déjà été complété") ||
      message.includes("déjà des créatures");

    if (isConflict) {
      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 409 },
      );
    }

    const isInvalidStarter = message.includes(
      "n'est pas éligible comme starter",
    );

    if (isInvalidStarter) {
      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 400 },
      );
    }

    // Les détails des erreurs internes ne sont jamais renvoyés au navigateur.
    logger.error(
      "Échec de la sélection du starter",
      { requestId, action: "starter.choose" },
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: STARTER_SELECTION_FAILED_MESSAGE,
      },
      { status: 500 },
    );
  }
}
