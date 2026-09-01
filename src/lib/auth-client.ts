"use client";

// Ce module expose les opérations d'authentification utilisables par les formulaires React.

import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import {
  isEmailIdentifier,
  normalizeUsername,
  sanitizeCallbackPath,
} from "@/lib/auth/constants";

// Le plugin client active la connexion par nom d'utilisateur en plus de l'e-mail.
export const authClient = createAuthClient({
  plugins: [usernameClient({ displayUsername: false })],
});

// Données attendues par le futur formulaire d'inscription.
type SignUpInput = {
  username: string;
  email: string;
  password: string;
  callbackPath?: string;
};

// Le champ identifier accepte une adresse e-mail ou un nom d'utilisateur.
type SignInInput = {
  identifier: string;
  password: string;
  rememberMe?: boolean;
  callbackPath?: string;
};

type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

const DEFAULT_POST_SIGN_IN_DESTINATION = "/dashboard";

// La connexion passe toujours par une route serveur qui contrôle l'onboarding
// avant d'envoyer le joueur vers sa destination finale.
export function buildPostSignInCallback(callbackPath?: string): string {
  const destination = sanitizeCallbackPath(
    callbackPath,
    DEFAULT_POST_SIGN_IN_DESTINATION
  );

  return `/auth/continue?next=${encodeURIComponent(destination)}`;
}

// Le nom affiché conserve sa casse, tandis que l'identifiant unique est normalisé.
export function signUpWithEmail({ username, email, password, callbackPath }: SignUpInput) {
  // La valeur affichée garde sa casse et perd uniquement les espaces extérieurs.
  const displayName = username.trim();

  return authClient.signUp.email({
    name: displayName,
    // La forme normalisée garantit une comparaison insensible à la casse.
    username: normalizeUsername(displayName),
    email: email.trim().toLowerCase(),
    password,
    // Seul un chemin interne validé peut être utilisé après la vérification.
    callbackURL: sanitizeCallbackPath(callbackPath, "/login?verified=1"),
  });
}

export function signInWithIdentifier({
  identifier,
  password,
  rememberMe = true,
  callbackPath,
}: SignInInput) {
  // Les espaces de saisie accidentels ne font pas échouer la connexion.
  const trimmedIdentifier = identifier.trim();
  const callbackURL = buildPostSignInCallback(callbackPath);

  // Le formulaire possède un seul champ. La présence de @ sélectionne la route
  // e-mail, car ce caractère est interdit dans les noms d'utilisateur.
  if (isEmailIdentifier(trimmedIdentifier)) {
    return authClient.signIn.email({
      email: trimmedIdentifier.toLowerCase(),
      password,
      rememberMe,
      callbackURL,
    });
  }

  // Tout identifiant sans @ est traité comme un nom d'utilisateur normalisé.
  return authClient.signIn.username({
    username: normalizeUsername(trimmedIdentifier),
    password,
    rememberMe,
    callbackURL,
  });
}

// Le message affiché après cet appel reste volontairement générique afin de
// ne pas permettre de vérifier si une adresse possède déjà un compte.
export function requestVerificationEmail(email: string) {
  return authClient.sendVerificationEmail({
    email: email.trim().toLowerCase(),
    callbackURL: "/login?verified=1",
  });
}

// La destination est fixe : aucune URL fournie par l'utilisateur n'est reprise.
export function requestPasswordRecovery(email: string) {
  return authClient.requestPasswordReset({
    email: email.trim().toLowerCase(),
    redirectTo: "/reset-password",
  });
}

// Better Auth consomme le jeton atomiquement avant d'enregistrer le nouveau hash.
export function resetPasswordWithToken({ token, newPassword }: ResetPasswordInput) {
  return authClient.resetPassword({
    token,
    newPassword,
  });
}

// Cette fonction invalide la session active côté serveur avant la navigation.
export function signOutCurrentSession() {
  return authClient.signOut();
}
