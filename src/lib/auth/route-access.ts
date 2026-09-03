import { sanitizeCallbackPath } from "@/lib/auth/constants";

export type PlayerAccessState = "anonymous" | "onboarding-required" | "ready";

/** Routes uniques utilisées par tous les gardes serveur. */
export const ACCESS_ROUTES = {
  continue: "/auth/continue",
  dashboard: "/dashboard",
  login: "/login?sessionExpired=1",
  onboarding: "/onboarding",
} as const;

const ROUTES_OUTSIDE_GAME = [
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/logout",
  ACCESS_ROUTES.continue,
  ACCESS_ROUTES.onboarding,
] as const;

/**
 * Détermine l'état d'accès sans dépendre de Next.js ni de Prisma. Un profil
 * absent est volontairement traité comme incomplet plutôt que comme prêt.
 */
export function getPlayerAccessState(
  userId: string | null | undefined,
  hasCompletedOnboarding: boolean | null | undefined,
): PlayerAccessState {
  if (!userId) {
    return "anonymous";
  }

  return hasCompletedOnboarding === true ? "ready" : "onboarding-required";
}

/**
 * Filtre une destination demandée après la connexion. Les pages du parcours
 * d'authentification et l'onboarding sont exclus afin de ne jamais reboucler.
 */
export function getSafeGameDestination(
  requestedDestination: string | null | undefined,
): string {
  // Le premier filtre refuse déjà les URL externes, les doubles barres et les
  // séparateurs encodés avant toute comparaison avec les routes applicatives.
  const destination = sanitizeCallbackPath(
    requestedDestination ?? undefined,
    ACCESS_ROUTES.dashboard,
  );

  // La requête et le fragment n'interviennent pas dans l'identification de la
  // page : /login?next=/campaign reste bien une destination interdite.
  const pathname = destination.split(/[?#]/, 1)[0];
  const targetsRouteOutsideGame = ROUTES_OUTSIDE_GAME.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  return targetsRouteOutsideGame ? ACCESS_ROUTES.dashboard : destination;
}

/**
 * Matrice de redirection commune aux pages et à la reprise après connexion.
 * Chaque état possède une destination stable, ce qui évite les cycles.
 */
export function getAccessDestination(
  state: PlayerAccessState,
  requestedDestination?: string | null,
): string {
  // La destination demandée n'est examinée que lorsque toutes les étapes
  // obligatoires du compte sont terminées.
  if (state === "anonymous") {
    return ACCESS_ROUTES.login;
  }

  if (state === "onboarding-required") {
    return ACCESS_ROUTES.onboarding;
  }

  return getSafeGameDestination(requestedDestination);
}
