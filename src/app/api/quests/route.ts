import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserQuests } from "@/lib/quests/quest-progress-service";

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user.id) {
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 }
      );
    }

    const questsState = await getUserQuests(session.user.id);

    return NextResponse.json({
      success: true,
      data: questsState,
    });
  } catch (error) {
    console.error("[API /api/quests] Erreur lors de la récupération des quêtes :", error);
    return NextResponse.json(
      { success: false, error: "Impossible de récupérer les quêtes." },
      { status: 500 }
    );
  }
}
