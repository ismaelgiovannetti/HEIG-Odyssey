import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readProtectedJsonBody } from "@/lib/http/request-security";
import { getRequestId, logger } from "@/lib/logger";
import {
  executeGachaPull,
  BannerNotFoundError,
  GachaIdempotencyConflictError,
  GachaPcFullError,
  InsufficientFundsError,
} from "@/lib/gacha/gacha-service";
import { GachaPullBodySchema } from "@/lib/gacha/gacha-contract";

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
    if (!session.user.emailVerified) {
      return json(
        { success: false, error: "Vérifiez votre adresse e-mail." },
        403,
      );
    }
    const body = await readProtectedJsonBody(req, 8 * 1024);
    if (!body.ok) {
      return json({ success: false, error: body.error }, body.status);
    }
    const parsed = GachaPullBodySchema.safeParse(body.value);

    if (!parsed.success) {
      return json(
        { success: false, error: "Paramètres de tirage invalides." },
        400,
      );
    }

    const result = await executeGachaPull({
      userId: session.user.id,
      bannerId: parsed.data.bannerId,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    return json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof BannerNotFoundError) {
      return json({ success: false, error: error.message }, 404);
    }

    if (error instanceof InsufficientFundsError) {
      return json({ success: false, error: error.message }, 400);
    }

    if (error instanceof GachaPcFullError) {
      return json(
        { success: false, code: "PC_FULL", error: error.message },
        409,
      );
    }

    if (error instanceof GachaIdempotencyConflictError) {
      return json(
        { success: false, code: "IDEMPOTENCY_CONFLICT", error: error.message },
        409,
      );
    }

    logger.error(
      "Échec du tirage gacha",
      { requestId, action: "gacha.pull" },
      error,
    );
    return json({ success: false, error: "Échec du tirage gacha." }, 500);
  }
}
