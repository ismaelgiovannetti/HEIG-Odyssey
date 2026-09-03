import { NextResponse } from "next/server";
import { loadStarters, getSpecies } from "@/lib/content/loader";
import { getRequestId, logger } from "@/lib/logger";
import { StarterCatalogResponseSchema } from "@/lib/starter/starter-contract";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const starters = loadStarters();

    const formatted = starters.map((starter) => {
      const spec = getSpecies(starter.speciesId);
      return {
        speciesId: starter.speciesId,
        dexNumber: spec?.dexNumber,
        name: starter.name,
        generation: spec?.generation,
        types: spec?.types || ["Normal"],
        level: starter.level,
        description: starter.description,
        moves: starter.moves,
        baseStats: spec?.baseStats,
      };
    });

    const response = StarterCatalogResponseSchema.parse({
      success: true,
      count: formatted.length,
      starters: formatted,
    });
    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      "Échec du chargement des starters",
      { requestId, action: "starter.list" },
      error,
    );
    return NextResponse.json(
      {
        success: false,
        error: "Impossible de récupérer les starters.",
      },
      { status: 500 },
    );
  }
}
