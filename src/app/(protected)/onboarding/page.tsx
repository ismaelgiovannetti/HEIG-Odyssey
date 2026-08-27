import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { getServerSession } from "@/lib/auth/server-session";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Bienvenue - HEIG Odyssey",
};

/**
 * Page temporaire de première connexion. Elle réserve le point d'entrée de
 * l'interface de recrutement gratuit qui sera branchée sur ce parcours.
 */
export default async function OnboardingPlaceholderPage() {
  const session = await getServerSession();

  // Les layouts et les pages peuvent être rendus en parallèle par Next.js.
  // La page protège donc elle-même tout accès au profil.
  if (!session?.user.id) {
    redirect("/login?sessionExpired=1");
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { hasCompletedOnboarding: true },
  });

  // L'onboarding ne doit pas être rejoué après sa validation en base.
  if (profile?.hasCompletedOnboarding) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      eyebrow="Première connexion"
      title={`Bienvenue, ${session.user.name}`}
      description="Votre adresse est vérifiée et votre session est active."
      footer={
        <p>
          Changer de compte ? <Link href="/logout">Se déconnecter</Link>
        </p>
      }
    >
      <div className="auth-next-step">
        <Compass aria-hidden="true" size={30} />
        <div>
          <h2>Prochaine étape : choisir votre partenaire</h2>
          <p>L&apos;interface de recrutement gratuit sera ajoutée dans la tâche d&apos;onboarding.</p>
        </div>
      </div>
    </AuthShell>
  );
}
