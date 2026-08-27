import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sanitizeCallbackPath } from "@/lib/auth/constants";
import { getApplicationOrigin } from "@/lib/auth/environment";
import { prisma } from "@/lib/prisma";

const DEFAULT_DESTINATION = "/dashboard";
const AUTHENTICATION_ROUTES = [
  "/login",
  "/signup",
  "/verify-email",
  "/logout",
  "/auth/continue",
];

/**
 * Refuse les destinations qui renverraient vers le parcours d'authentification
 * et pourraient provoquer une boucle de redirections.
 */
function getSafeRequestedDestination(value: string | null): string {
  const destination = sanitizeCallbackPath(value ?? undefined, DEFAULT_DESTINATION);
  const targetsAuthenticationRoute = AUTHENTICATION_ROUTES.some(
    (route) => destination === route || destination.startsWith(`${route}?`)
  );

  return targetsAuthenticationRoute ? DEFAULT_DESTINATION : destination;
}

/**
 * Choisit la prochaine page après la connexion selon l'état d'onboarding. La
 * destination demandée reste limitée à un chemin interne autorisé.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  // Les redirections utilisent l'origine validée par la configuration serveur
  // et ne dépendent donc pas de l'en-tête Host reçu par l'application.
  const applicationOrigin = getApplicationOrigin();
  const session = await auth.api.getSession({ headers: request.headers });

  // La session est relue côté serveur : aucun identifiant du client n'est cru.
  if (!session?.user.id) {
    const loginUrl = new URL("/login", applicationOrigin);
    loginUrl.searchParams.set("sessionExpired", "1");
    return NextResponse.redirect(loginUrl);
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { hasCompletedOnboarding: true },
  });

  // Un profil absent est traité comme un onboarding incomplet. Cette valeur
  // sûre permet aussi de réparer un ancien compte incomplet sans ouvrir le jeu.
  const destination = profile?.hasCompletedOnboarding
    ? getSafeRequestedDestination(requestUrl.searchParams.get("next"))
    : "/onboarding";

  return NextResponse.redirect(new URL(destination, applicationOrigin));
}
