import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getPlayerCollection,
  updateActiveTeam,
  TeamCompositionInvalidError,
  TeamPokemonNotOwnedError,
} from "@/lib/team/team-service";

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentification requise.";
const TEAM_READ_FAILED_MESSAGE = "Impossible de charger la collection.";
const TEAM_UPDATE_FAILED_MESSAGE = "Impossible de mettre à jour l'équipe active.";

// L'identité du joueur vient uniquement de la session ; seuls les identifiants
// des créatures à placer en équipe sont acceptés depuis le navigateur.
const UpdateTeamBodySchema = z
  .object({
    teamPokemonIds: z.array(z.string().trim().min(1)).min(1).max(6),
  })
  .strict()
  .refine(
    (data) => new Set(data.teamPokemonIds).size === data.teamPokemonIds.length,
    {
      message: "La liste des créatures ne peut pas contenir de doublons.",
      path: ["teamPokemonIds"],
    }
  );

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return NextResponse.json(
        { success: false, error: AUTHENTICATION_REQUIRED_MESSAGE },
        { status: 401 }
      );
    }

    const pokemon = await getPlayerCollection(session.user.id);

    return NextResponse.json({
      success: true,
      count: pokemon.length,
      pokemon,
    });
  } catch {
    console.error("Échec de la lecture de la collection.");
    return NextResponse.json(
      { success: false, error: TEAM_READ_FAILED_MESSAGE },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return NextResponse.json(
        { success: false, error: AUTHENTICATION_REQUIRED_MESSAGE },
        { status: 401 }
      );
    }

    const raw: unknown = await req.json().catch(() => null);
    const parsed = UpdateTeamBodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Requête invalide", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const team = await updateActiveTeam(session.user.id, parsed.data.teamPokemonIds);

    return NextResponse.json({ success: true, team });
  } catch (error) {
    if (error instanceof TeamPokemonNotOwnedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    if (error instanceof TeamCompositionInvalidError) {
      return NextResponse.json(
        { success: false, error: error.message, details: error.reasons },
        { status: 400 }
      );
    }

    console.error("Échec de la mise à jour de l'équipe active.");
    return NextResponse.json(
      { success: false, error: TEAM_UPDATE_FAILED_MESSAGE },
      { status: 500 }
    );
  }
}
