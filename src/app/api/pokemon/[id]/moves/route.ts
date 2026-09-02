import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestId, logger } from "@/lib/logger";
import { isPokemonInActiveBattle } from "@/lib/combat/battle-session-store";
import { validateAndHydrateSelectedMoves } from "@/lib/pokemon/pokemon-learnset-service";
import { toCollectionEntry } from "@/lib/team/collection-entry";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(
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
    if (!body || !Array.isArray(body.moveIds)) {
      return json({ success: false, error: "Liste des capacités invalide." }, 400);
    }

    const pokemon = await prisma.userPokemon.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!pokemon) {
      return json({ success: false, error: "Pokémon introuvable dans votre collection." }, 404);
    }

    if (isPokemonInActiveBattle(session.user.id, id)) {
      return json(
        { success: false, error: "Impossible de modifier les capacités d'un Pokémon en plein combat." },
        409,
      );
    }

    const validation = await validateAndHydrateSelectedMoves(
      pokemon.speciesId,
      pokemon.level,
      body.moveIds,
    );

    if (!validation.isValid || !validation.moves) {
      return json({ success: false, error: validation.error || "Sélection de capacités invalide." }, 400);
    }

    const updated = await prisma.userPokemon.update({
      where: { id },
      data: {
        moves: validation.moves as any,
      },
    });

    return json({
      success: true,
      pokemon: toCollectionEntry(updated),
      moves: validation.moves,
    });
  } catch (error) {
    logger.error("Échec de la mise à jour des capacités du Pokémon", { requestId, pokemonId: id }, error);
    return json({ success: false, error: "Impossible de mettre à jour les capacités pour le moment." }, 500);
  }
}
