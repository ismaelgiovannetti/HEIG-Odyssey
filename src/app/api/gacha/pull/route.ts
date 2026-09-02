import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getRequestId, logger } from "@/lib/logger";
import {
  executeGachaPull,
  BannerNotFoundError,
  InsufficientFundsError,
} from "@/lib/gacha/gacha-service";

const GachaPullBodySchema = z
  .object({
    bannerId: z.string().min(1),
    idempotencyKey: z.string().min(1).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 }
      );
    }

    const raw = await req.json().catch(() => null);
    const parsed = GachaPullBodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Paramètres de tirage invalides." },
        { status: 400 }
      );
    }

    const result = await executeGachaPull({
      userId: session.user.id,
      bannerId: parsed.data.bannerId,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof BannerNotFoundError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    if (error instanceof InsufficientFundsError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    logger.error("Échec du tirage gacha", { requestId, action: "gacha.pull" }, error);
    return NextResponse.json(
      { success: false, error: "Échec du tirage gacha." },
      { status: 500 }
    );
  }
}
