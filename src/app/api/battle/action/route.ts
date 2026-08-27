import { NextResponse } from "next/server";
import { z } from "zod";
import { processBattleTurn } from "@/lib/combat/battle-session-store";

const BattleActionBodySchema = z.object({
  battleId: z.string().min(1),
  action: z.union([
    z.object({
      type: z.literal("move"),
      moveIndex: z.number().int().min(0).max(3),
    }),
    z.object({
      type: z.literal("switch"),
      targetPokemonIndex: z.number().int().min(0).max(5),
    }),
  ]),
});

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = BattleActionBodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Action invalide", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { battleId, action } = parsed.data;

    const result = await processBattleTurn(battleId, action);

    return NextResponse.json({
      success: true,
      turn: result.turnResult.turn,
      events: result.turnResult.events,
      state: result.turnResult.state,
      rewards: result.rewards,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
