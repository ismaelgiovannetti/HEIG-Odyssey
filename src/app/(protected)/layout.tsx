import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth/server-session";

/**
 * Barrière commune des pages privées. La vérification est réalisée côté
 * serveur afin qu'aucun contenu protégé ne soit envoyé sans session valide.
 */
export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();

  // Le paramètre permet à la page de connexion d'expliquer la redirection.
  if (!session?.user.id) {
    redirect("/login?sessionExpired=1");
  }

  return children;
}
