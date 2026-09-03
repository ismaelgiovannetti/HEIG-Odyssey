import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { username } from "better-auth/plugins";

import {
  AUTH_SESSION_EXPIRES_IN_SECONDS,
  AUTH_SESSION_UPDATE_AGE_SECONDS,
  EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
  getPasswordValidationError,
  isValidUsername,
  normalizeUsername,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_EXPIRES_IN_SECONDS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/constants";
import { getApplicationOrigin, getBetterAuthSecret } from "@/lib/auth/environment";
import { deliverPasswordResetEmail } from "@/lib/email/password-reset-email";
import { deliverVerificationEmail } from "@/lib/email/verification-email";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { consumeFixedWindowRateLimit } from "@/lib/security/rate-limit";

// Ce fichier centralise la configuration serveur de Better Auth.
// Il ne doit jamais être importé dans un composant client.

// Une origine explicite évite de faire confiance aux en-têtes envoyés par le client.
const applicationOrigin = getApplicationOrigin();

export const auth = betterAuth({
  appName: "HEIG Odyssey",
  baseURL: applicationOrigin,
  secret: getBetterAuthSecret(),
  // Prisma conserve les comptes, sessions et jetons de vérification dans PostgreSQL.
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // Une liste précise protège les requêtes et redirections contre les origines externes.
  trustedOrigins: [applicationOrigin],
  // L'identité affichée est volontairement immuable dans ce jeu. Désactiver
  // l'endpoint générique évite de contourner les règles appliquées à l'inscription.
  disabledPaths: ["/update-user"],
  // L'e-mail doit être confirmé avant la création de la première session.
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    resetPasswordTokenExpiresIn: PASSWORD_RESET_EXPIRES_IN_SECONDS,
    // Un changement de mot de passe invalide toutes les sessions éventuellement volées.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // L'envoi n'est pas attendu afin que le temps de réponse ne permette pas
      // de distinguer une adresse existante d'une adresse inconnue.
      void deliverPasswordResetEmail({
        recipient: user.email,
        username: user.name,
        resetUrl: url,
      }).catch((error: unknown) => {
        // Le journal ne contient ni adresse, ni URL, ni jeton de récupération.
        logger.error("Échec de l'envoi de l'e-mail de récupération", {
          eventId: logger.generateEventId(),
          action: "auth.password-reset-email",
        }, error);
      });
    },
  },
  // Chaque inscription déclenche un lien valable une heure, sans connexion automatique.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    expiresIn: EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
    sendVerificationEmail: async ({ user, url }) => {
      // Better Auth recommande un envoi asynchrone afin de ne pas révéler
      // l'existence d'un compte par le temps de réponse.
      void deliverVerificationEmail({
        recipient: user.email,
        username: user.name,
        verificationUrl: url,
      }).catch((error: unknown) => {
        // Seul un code contrôlé est journalisé : ni adresse, ni jeton, ni clé API.
        logger.error("Échec de l'envoi de l'e-mail de vérification", {
          eventId: logger.generateEventId(),
          action: "auth.verification-email",
        }, error);
      });
    },
  },
  // Une session reste valide sept jours et n'est actualisée qu'après un jour.
  session: {
    expiresIn: AUTH_SESSION_EXPIRES_IN_SECONDS,
    updateAge: AUTH_SESSION_UPDATE_AGE_SECONDS,
  },
  rateLimit: {
    // Les routes sensibles utilisent des limites plus strictes que le reste de l'API.
    enabled: true,
    // Redis applique la limite atomiquement et la partage entre toutes les instances.
    customStorage: {
      consume: (key, rule) => consumeFixedWindowRateLimit("auth", key, rule),
    },
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
      "/sign-in/username": { window: 10, max: 3 },
      "/sign-up/email": { window: 60, max: 5 },
      "/is-username-available": { window: 60, max: 30 },
      "/send-verification-email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
      "/change-password": { window: 60, max: 5 },
    },
  },
  advanced: {
    // Le cookie Secure est obligatoire dans l'image de production.
    useSecureCookies: process.env.NODE_ENV === "production",
    // Traefik fournit cette adresse ; les chaînes multiples restent refusées
    // tant qu'aucun proxy de confiance précis n'est configuré.
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for"],
    },
    // Les jointures réduisent le nombre de requêtes nécessaires à Better Auth.
    database: {
      joins: true,
    },
  },
  // Ce hook contrôle et normalise les données avant leur écriture en base.
  hooks: {
    before: createAuthMiddleware(async (context) => {
      const isSignUpRequest = context.path === "/sign-up/email";
      const isPasswordMutationRequest =
        context.path === "/reset-password" || context.path === "/change-password";

      if (!isSignUpRequest && !isPasswordMutationRequest) {
        return;
      }

      // La validation reste côté serveur, même si les formulaires contrôlent déjà les valeurs.
      if (!context.body || typeof context.body !== "object" || Array.isArray(context.body)) {
        throw new APIError("BAD_REQUEST", {
          message: "Les données d'authentification sont invalides.",
        });
      }

      const requestBody = context.body as Record<string, unknown>;
      const submittedPassword = isSignUpRequest
        ? requestBody.password
        : requestBody.newPassword;

      if (typeof submittedPassword !== "string") {
        throw new APIError("BAD_REQUEST", {
          message: "Le mot de passe est invalide.",
        });
      }

      const passwordValidationError = getPasswordValidationError(submittedPassword);
      if (passwordValidationError) {
        throw new APIError("BAD_REQUEST", {
          message: passwordValidationError,
        });
      }

      // Les règles de nom d'utilisateur ne concernent que la création du compte.
      if (!isSignUpRequest) {
        return;
      }

      const submittedUsername = requestBody.username;

      if (typeof submittedUsername !== "string" || !isValidUsername(submittedUsername)) {
        throw new APIError("BAD_REQUEST", {
          message: "Le nom d'utilisateur est invalide.",
        });
      }

      const displayName = submittedUsername.trim();
      // name conserve l'affichage ; username devient la clé unique normalisée.
      requestBody.name = displayName;
      requestBody.username = normalizeUsername(displayName);
    }),
  },
  // La création du profil de jeu accompagne automatiquement celle du compte.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Chaque compte possède exactement un profil de progression initial.
          await prisma.userProfile.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id },
          });
        },
      },
    },
  },
  // Le nom d'utilisateur est immuable dans le MVP et ne possède pas de copie d'affichage.
  plugins: [
    username({
      minUsernameLength: USERNAME_MIN_LENGTH,
      maxUsernameLength: USERNAME_MAX_LENGTH,
      usernameValidator: isValidUsername,
      immutableUsername: true,
      displayUsername: false,
    }),
  ],
});
