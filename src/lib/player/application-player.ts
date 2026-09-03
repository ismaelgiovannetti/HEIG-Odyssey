import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import {
  getAccessDestination,
  getPlayerAccessState,
  type PlayerAccessState,
} from "@/lib/auth/route-access";
import { getServerSession } from "@/lib/auth/server-session";
import { prisma } from "@/lib/prisma";

export interface ApplicationPlayer {
  id: string;
  name: string;
  pokedollars: number;
}

interface AuthenticatedPlayerContext {
  state: Exclude<PlayerAccessState, "anonymous">;
  player: ApplicationPlayer;
}

export type PlayerAccessContext =
  { state: "anonymous" } | AuthenticatedPlayerContext;

/**
 * Lit une seule fois la session et l'état d'onboarding pendant un rendu. Le
 * contexte ne contient que l'utilisateur issu de Better Auth : aucun userId
 * fourni par le navigateur n'intervient dans la décision.
 */
export const getPlayerAccessContext = cache(
  async (): Promise<PlayerAccessContext> => {
    const session = await getServerSession();

    if (!session?.user.id) {
      return { state: "anonymous" };
    }

    // La clé de recherche provient exclusivement de la session serveur. Le
    // navigateur ne peut donc pas demander le profil d'un autre joueur.
    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        pokedollars: true,
        hasCompletedOnboarding: true,
      },
    });
    const state = getPlayerAccessState(
      session.user.id,
      profile?.hasCompletedOnboarding,
    );

    return {
      state: state === "ready" ? "ready" : "onboarding-required",
      player: {
        id: session.user.id,
        name: session.user.name,
        // Un profil absent reste incomplet ; zéro sert uniquement à typer le
        // contexte et n'ouvre jamais les pages de jeu.
        pokedollars: profile?.pokedollars ?? 0,
      },
    };
  },
);

/**
 * Autorise uniquement un joueur connecté ayant terminé son onboarding. Cette
 * fonction est partagée par toutes les pages qui affichent le shell du jeu.
 */
export const getApplicationPlayer = cache(
  async (): Promise<ApplicationPlayer> => {
    const context = await getPlayerAccessContext();

    // redirect() interrompt le rendu Next.js : aucune donnée du shell n'est
    // envoyée au navigateur tant que le joueur n'est pas prêt.
    if (context.state !== "ready") {
      redirect(getAccessDestination(context.state));
    }

    return context.player;
  },
);

/**
 * Autorise l'onboarding uniquement pour une session encore incomplète. Un
 * joueur prêt retourne au dashboard et un visiteur anonyme à la connexion.
 */
export const getOnboardingPlayer = cache(
  async (): Promise<Pick<ApplicationPlayer, "id" | "name">> => {
    const context = await getPlayerAccessContext();

    // Ce garde inverse empêche le rejeu de l'onboarding après le recrutement.
    if (context.state !== "onboarding-required") {
      redirect(getAccessDestination(context.state));
    }

    return {
      id: context.player.id,
      name: context.player.name,
    };
  },
);
