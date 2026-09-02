import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getApplicationOrigin } from "@/lib/auth/environment";
import { getRequestId, logger } from "@/lib/logger";
import {
  executeGachaPull,
  BannerNotFoundError,
  GachaIdempotencyConflictError,
  GachaPcFullError,
  InsufficientFundsError,
} from "@/lib/gacha/gacha-service";

const GachaPullBodySchema = z
  .object({
    bannerId: z.string().trim().min(1).max(128),
    idempotencyKey: z.string().trim().min(8).max(128),
  })
  .strict();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Le petit contrat de tirage ne doit jamais accepter un corps sans limite. */
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
      if (size > 8 * 1024) {
        await reader.cancel();
        throw new RangeError("GACHA_BODY_TOO_LARGE");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return json({ success: false, error: "Authentification requise." }, 401);
    }
    if (!session.user.emailVerified) {
      return json({ success: false, error: "Vérifiez votre adresse e-mail." }, 403);
    }
    if (req.headers.get("origin") !== getApplicationOrigin()) {
      return json({ success: false, error: "Origine de la requête refusée." }, 403);
    }
    if (
      req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
    ) {
      return json({ success: false, error: "Un corps JSON est requis." }, 415);
    }

    let raw: unknown;
    try {
      raw = await readBody(req);
    } catch (error) {
      return json(
        { success: false, error: "Corps de requête invalide ou trop volumineux." },
        error instanceof RangeError ? 413 : 400,
      );
    }
    const parsed = GachaPullBodySchema.safeParse(raw);

    if (!parsed.success) {
      return json({ success: false, error: "Paramètres de tirage invalides." }, 400);
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
      return json({ success: false, code: "PC_FULL", error: error.message }, 409);
    }

    if (error instanceof GachaIdempotencyConflictError) {
      return json({ success: false, code: "IDEMPOTENCY_CONFLICT", error: error.message }, 409);
    }

    logger.error("Échec du tirage gacha", { requestId, action: "gacha.pull" }, error);
    return json({ success: false, error: "Échec du tirage gacha." }, 500);
  }
}
