import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Nouveau mot de passe - HEIG Odyssey",
  description: "Choisissez un nouveau mot de passe sécurisé pour HEIG Odyssey.",
  // Le jeton temporaire est présent dans l'URL : il ne doit pas être transmis
  // par Referer ni indexé par un moteur de recherche.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/**
 * Cette page reste volontairement hors du layout public d'authentification.
 * Un joueur possédant encore une session doit pouvoir utiliser son lien ; la
 * réussite révoquera ensuite toutes ses sessions via Better Auth.
 */
export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Sécurité du compte"
      title="Nouveau mot de passe"
      description="Choisissez une nouvelle clé d'accès pour reprendre votre aventure."
    >
      <Suspense fallback={<p className="auth-loading">Vérification du lien...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
