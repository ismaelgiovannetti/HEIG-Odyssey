import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  getAccessDestination,
  getPlayerAccessState,
} from "@/lib/auth/route-access";
import { getApplicationOrigin } from "@/lib/auth/environment";
import { prisma } from "@/lib/prisma";

/**
 * Choisit la prochaine page après la connexion selon la matrice d'accès. La
 * destination demandée reste limitée à un chemin interne qui ne reboucle pas
 * vers l'authentification ou l'onboarding.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  // L'origine validée par la configuration serveur empêche un en-tête Host
  // forgé de contrôler la destination de la réponse.
  const applicationOrigin = getApplicationOrigin();
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user.id) {
    const destination = getAccessDestination("anonymous");
    return NextResponse.redirect(new URL(destination, applicationOrigin));
  }

  // Le profil est toujours recherché depuis l'identité Better Auth et jamais
  // depuis une valeur transmise dans l'URL.
  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { hasCompletedOnboarding: true },
  });
  const accessState = getPlayerAccessState(
    session.user.id,
    profile?.hasCompletedOnboarding,
  );
  const destination = getAccessDestination(
    accessState,
    requestUrl.searchParams.get("next"),
  );

  return NextResponse.redirect(new URL(destination, applicationOrigin));
}
