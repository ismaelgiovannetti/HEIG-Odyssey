import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRequestId, logger } from "@/lib/logger";
import { evolveUserPokemon } from "@/lib/pokemon/pokemon-evolution-service";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  const { id } = await params;

  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return json({ success: false, error: "Authentification requise." }, 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.targetSpeciesId !== "string") {
      return json({ success: false, error: "Espèce cible invalide." }, 400);
    }

    const result = await evolveUserPokemon(
      session.user.id,
      id,
      body.targetSpeciesId,
    );

    return json({
      success: true,
      pokemon: result.pokemon,
      previousSpeciesName: result.previousSpeciesName,
      newSpeciesName: result.newSpeciesName,
    });
  } catch (error: any) {
    logger.error("Échec de l'évolution du Pokémon", { requestId, pokemonId: id }, error);
    return json({ success: false, error: error?.message || "Impossible de faire évoluer ce Pokémon." }, 400);
  }
}
