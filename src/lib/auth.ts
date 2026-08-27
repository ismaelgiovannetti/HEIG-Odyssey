import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { username } from "better-auth/plugins";

import {
  AUTH_SESSION_EXPIRES_IN_SECONDS,
  AUTH_SESSION_UPDATE_AGE_SECONDS,
  EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
  isValidUsername,
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/constants";
import { getApplicationOrigin, getBetterAuthSecret } from "@/lib/auth/environment";
import { deliverVerificationEmail } from "@/lib/email/verification-email";
import { prisma } from "@/lib/prisma";

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
  // L'e-mail doit être confirmé avant la création de la première session.
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
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
        const errorCode = error instanceof Error ? error.message : "UNKNOWN_EMAIL_DELIVERY_ERROR";
        console.error("Échec de l'envoi de l'e-mail de vérification.", { errorCode });
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
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
      "/sign-in/username": { window: 10, max: 3 },
      "/sign-up/email": { window: 60, max: 5 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
  advanced: {
    // Le cookie Secure est obligatoire dans l'image de production.
    useSecureCookies: process.env.NODE_ENV === "production",
    // Les jointures réduisent le nombre de requêtes nécessaires à Better Auth.
    database: {
      joins: true,
    },
  },
  // Ce hook contrôle et normalise les données avant leur écriture en base.
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/sign-up/email") {
        return;
      }

      // La validation reste côté serveur, même si le formulaire contrôle déjà la valeur.
      if (!context.body || typeof context.body !== "object" || Array.isArray(context.body)) {
        throw new APIError("BAD_REQUEST", {
          message: "Les données d'inscription sont invalides.",
        });
      }

      const requestBody = context.body as Record<string, unknown>;
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
