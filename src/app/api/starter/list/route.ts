import { NextResponse } from "next/server";
import { loadStarters, getSpecies } from "@/lib/content/loader";

export async function GET() {
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

    return NextResponse.json({
      success: true,
      count: formatted.length,
      starters: formatted,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
