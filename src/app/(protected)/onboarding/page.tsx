import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import { getServerSession } from "@/lib/auth/server-session";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Premier recrutement - HEIG Odyssey",
};

/**
 * Point d'entrée du premier lancement. La décision d'afficher l'onboarding
 * reste côté serveur afin qu'un compte déjà initialisé ne reçoive jamais le
 * catalogue interactif de recrutement.
 */
export default async function OnboardingPage() {
  const session = await getServerSession();

  // Le layout protège déjà cette route, mais cette vérification locale évite
  // toute dépendance à l'ordre de rendu parallèle des composants Next.js.
  if (!session?.user.id) {
    redirect("/login?sessionExpired=1");
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { hasCompletedOnboarding: true },
  });

  // L'onboarding est unique : une visite ultérieure rejoint directement le jeu.
  if (profile?.hasCompletedOnboarding) {
    redirect("/dashboard");
  }

  return <OnboardingScreen playerName={session.user.name} />;
}
