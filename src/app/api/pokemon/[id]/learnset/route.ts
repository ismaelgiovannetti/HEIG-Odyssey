import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestId, logger } from "@/lib/logger";
import { getLearnableMovesForSpecies } from "@/lib/pokemon/pokemon-learnset-service";
import { getEvolutionOptions } from "@/lib/pokemon/pokemon-evolution-service";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
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

    const pokemon = await prisma.userPokemon.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!pokemon) {
      return json(
        { success: false, error: "Pokémon introuvable dans votre collection." },
        404,
      );
    }

    const learnableMoves = await getLearnableMovesForSpecies(
      pokemon.speciesId,
      pokemon.level,
    );

    const evolutions = getEvolutionOptions(pokemon.speciesId, pokemon.level);

    return json({
      success: true,
      pokemon: {
        id: pokemon.id,
        speciesId: pokemon.speciesId,
        nickname: pokemon.nickname,
        level: pokemon.level,
        currentMoves: pokemon.moves,
      },
      learnableMoves,
      evolutions,
    });
  } catch (error) {
    logger.error(
      "Échec de la récupération du learnset du Pokémon",
      { requestId, pokemonId: id },
      error,
    );
    return json(
      {
        success: false,
        error: "Impossible de récupérer les capacités disponibles.",
      },
      500,
    );
  }
}
