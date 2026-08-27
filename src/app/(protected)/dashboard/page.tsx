import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Gamepad2 } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { getServerSession } from "@/lib/auth/server-session";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Accueil - HEIG Odyssey",
};

/**
 * Page d'attente du futur accueil du jeu. Elle valide déjà la session et la
 * fin de l'onboarding pour conserver un parcours cohérent dès le Sprint 1.
 */
export default async function DashboardPlaceholderPage() {
  const session = await getServerSession();

  // Le contrôle local reste nécessaire car le layout et la page peuvent être
  // évalués simultanément pendant le rendu serveur.
  if (!session?.user.id) {
    redirect("/login?sessionExpired=1");
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { hasCompletedOnboarding: true },
  });

  // Un joueur sans profil terminé doit d'abord recruter son premier Pokémon.
  if (!profile?.hasCompletedOnboarding) {
    redirect("/onboarding");
  }

  return (
    <AuthShell
      eyebrow="Session active"
      title={`Bon retour, ${session.user.name}`}
      description="Votre compte est prêt et votre progression a été chargée."
      footer={
        <p>
          Terminer la session ? <Link href="/logout">Se déconnecter</Link>
        </p>
      }
    >
      <div className="auth-next-step">
        <Gamepad2 aria-hidden="true" size={30} />
        <div>
          <h2>Accueil du jeu en préparation</h2>
          <p>Le tableau de bord complet sera réalisé dans la tâche dédiée au shell applicatif.</p>
        </div>
      </div>
    </AuthShell>
  );
}
