import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { readProtectedJsonBody } from "@/lib/http/request-security";
import { getRequestId, logger } from "@/lib/logger";
import {
  evolveUserPokemon,
  PokemonEvolutionError,
} from "@/lib/pokemon/pokemon-evolution-service";

const EvolveBodySchema = z
  .object({
    targetSpeciesId: z.string().trim().min(1).max(100),
  })
  .strict();

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

    const body = await readProtectedJsonBody(req, 8 * 1024);
    if (!body.ok) {
      return json({ success: false, error: body.error }, body.status);
    }

    const parsed = EvolveBodySchema.safeParse(body.value);
    if (!parsed.success) {
      return json({ success: false, error: "Espèce cible invalide." }, 400);
    }

    const result = await evolveUserPokemon(
      session.user.id,
      id,
      parsed.data.targetSpeciesId,
    );

    return json({
      success: true,
      pokemon: result.pokemon,
      previousSpeciesName: result.previousSpeciesName,
      newSpeciesName: result.newSpeciesName,
    });
  } catch (error) {
    if (error instanceof PokemonEvolutionError) {
      return json({ success: false, error: error.message }, error.status);
    }

    logger.error("Échec de l'évolution du Pokémon", { requestId, pokemonId: id }, error);
    return json(
      { success: false, error: "Impossible de faire évoluer ce Pokémon." },
      500,
    );
  }
}
