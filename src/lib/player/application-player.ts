import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth/server-session";
import { prisma } from "@/lib/prisma";

export interface ApplicationPlayer {
  id: string;
  name: string;
  pokedollars: number;
}

/**
 * Charge l'identité minimale affichée dans le shell du jeu. Les redirections
 * sont réalisées côté serveur pour ne jamais rendre le jeu avant la connexion
 * et le recrutement initial.
 */
export const getApplicationPlayer = cache(
  async (): Promise<ApplicationPlayer> => {
    const session = await getServerSession();

    if (!session?.user.id) {
      redirect("/login?sessionExpired=1");
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        pokedollars: true,
        hasCompletedOnboarding: true,
      },
    });

    // Un compte encore incomplet doit terminer son unique recrutement avant
    // d'accéder aux espaces de jeu depuis une URL saisie manuellement.
    if (!profile?.hasCompletedOnboarding) {
      redirect("/onboarding");
    }

    return {
      id: session.user.id,
      name: session.user.name,
      pokedollars: profile.pokedollars,
    };
  },
);
