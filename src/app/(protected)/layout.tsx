import { redirect } from "next/navigation";

import { ACCESS_ROUTES } from "@/lib/auth/route-access";
import { getServerSession } from "@/lib/auth/server-session";

/**
 * Barrière commune des pages privées. La vérification est réalisée côté
 * serveur afin qu'aucun contenu protégé ne soit envoyé sans session valide.
 *
 * Ce layout contrôle uniquement la session : l'onboarding applique son propre
 * garde et les pages du jeu passent par getApplicationPlayer(). Cette
 * séparation permet à un joueur incomplet d'accéder encore à la déconnexion.
 */
export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();

  // Le paramètre permet à la page de connexion d'expliquer la redirection.
  if (!session?.user.id) {
    redirect(ACCESS_ROUTES.login);
  }

  return children;
}
