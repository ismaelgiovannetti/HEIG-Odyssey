import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Connexion - HEIG Odyssey",
  description: "Connectez-vous à votre compte de dresseur HEIG Odyssey.",
};

/**
 * Affiche la connexion par adresse e-mail ou nom d'utilisateur. Suspense est
 * nécessaire car le formulaire lit les paramètres présents dans l'URL.
 */
export default function LoginPage() {
  return (
    <AuthShell
      title="Reprendre l'aventure"
      description="Connectez-vous avec votre adresse e-mail ou votre nom de dresseur."
    >
      <Suspense fallback={<p className="auth-loading">Chargement du formulaire...</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
