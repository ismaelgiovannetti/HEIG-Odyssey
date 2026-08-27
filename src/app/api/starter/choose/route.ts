import { NextResponse } from "next/server";
import { z } from "zod";
import { selectStarter } from "@/lib/starter/starter-service";

const StarterChooseBodySchema = z.object({
  userId: z.string().min(1),
  speciesId: z.string().min(1),
  nickname: z.string().max(20).optional(),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const parsed = StarterChooseBodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Requête invalide",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { userId, speciesId, nickname } = parsed.data;

    const result = await selectStarter(userId, speciesId, nickname);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const msg = (error as Error).message;
    const isConflict =
      msg.includes("déjà été complété") || msg.includes("déjà des créatures");

    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status: isConflict ? 409 : 500 }
    );
  }
}
