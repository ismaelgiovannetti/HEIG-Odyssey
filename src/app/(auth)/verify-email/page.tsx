import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerificationForm } from "@/components/auth/verification-form";

export const metadata: Metadata = {
  title: "Vérifier votre adresse - HEIG Odyssey",
  description:
    "Vérifiez l'adresse e-mail associée à votre compte HEIG Odyssey.",
};

/**
 * Informe le joueur après son inscription et lui permet de renvoyer son lien
 * de vérification lorsque le premier message n'est pas arrivé.
 */
export default function VerifyEmailPage() {
  return (
    <AuthShell
      eyebrow="Validation du compte"
      title="Vérifiez votre messagerie"
      description="Un dernier contrôle avant de commencer votre aventure."
    >
      <Suspense fallback={<p className="auth-loading">Chargement...</p>}>
        <VerificationForm />
      </Suspense>
    </AuthShell>
  );
}
