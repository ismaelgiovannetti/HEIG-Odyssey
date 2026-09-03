import "../../onboarding.css";

import type { Metadata } from "next";

import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import { getOnboardingPlayer } from "@/lib/player/application-player";

export const metadata: Metadata = {
  title: "Premier recrutement - HEIG Odyssey",
};

/**
 * Point d'entrée du premier lancement. La décision d'afficher l'onboarding
 * reste côté serveur afin qu'un compte déjà initialisé ne reçoive jamais le
 * catalogue interactif de recrutement.
 */
export default async function OnboardingPage() {
  // Le helper applique la matrice commune : anonyme vers la connexion, joueur
  // prêt vers l'accueil et profil incomplet autorisé sur cette page.
  const player = await getOnboardingPlayer();

  return <OnboardingScreen playerName={player.name} />;
}
