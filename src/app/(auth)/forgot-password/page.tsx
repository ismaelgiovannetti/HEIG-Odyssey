import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Mot de passe oublié - HEIG Odyssey",
  description:
    "Demandez un lien sécurisé pour récupérer votre compte HEIG Odyssey.",
  robots: { index: false, follow: false },
};

/** Présente la demande de récupération dans la direction artistique commune. */
export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Récupération du compte"
      title="Retrouver votre accès"
      description="Recevez un lien personnel pour choisir un nouveau mot de passe."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
