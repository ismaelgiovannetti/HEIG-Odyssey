import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Créer un compte - HEIG Odyssey",
  description: "Créez votre compte de dresseur HEIG Odyssey.",
};

/**
 * Présente le formulaire de création du compte avant l'étape obligatoire de
 * vérification de l'adresse e-mail.
 */
export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Nouveau dresseur"
      title="Créer votre compte"
      description="Préparez votre profil avant de choisir gratuitement votre premier Pokémon."
    >
      <SignupForm />
    </AuthShell>
  );
}
