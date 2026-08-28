import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { LogoutButton } from "@/components/auth/logout-button";
import { getServerSession } from "@/lib/auth/server-session";

export const metadata: Metadata = {
  title: "Déconnexion - HEIG Odyssey",
};

/**
 * Demande une confirmation explicite avant d'invalider la session courante.
 * Le nom affiché provient uniquement de la session lue côté serveur.
 */
export default async function LogoutPage() {
  const session = await getServerSession();

  return (
    <AuthShell
      eyebrow="Fin de session"
      title="Quitter l'aventure ?"
      description={`La session de ${session?.user.name ?? "ce dresseur"} sera invalidée sur cet appareil.`}
      className="auth-card--logout"
      showSecurityNote={false}
      footer={
        <p>
          Vous préférez rester ?{" "}
          <Link href="/auth/continue">Retour au jeu</Link>
        </p>
      }
    >
      <div className="auth-logout-content">
        <p className="auth-instruction auth-instruction--centered">
          Votre progression est déjà enregistrée. Vous pourrez reprendre
          exactement où vous vous êtes arrêté.
        </p>
        <LogoutButton />
      </div>
    </AuthShell>
  );
}
