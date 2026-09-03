import "../auth.css";

import { redirect } from "next/navigation";

import { ACCESS_ROUTES } from "@/lib/auth/route-access";
import { getServerSession } from "@/lib/auth/server-session";

/**
 * Regroupe les pages publiques d'authentification. Un joueur déjà connecté
 * est redirigé vers le point de reprise au lieu de revoir ces formulaires.
 */
export default async function PublicAuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();

  // Un joueur déjà connecté n'a rien à faire sur les formulaires publics.
  if (session?.user.id) {
    redirect(ACCESS_ROUTES.continue);
  }

  return children;
}
