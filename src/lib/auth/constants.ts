// Durées exprimées en secondes pour rester compatibles avec Better Auth.
export const AUTH_SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
export const AUTH_SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;
export const EMAIL_VERIFICATION_EXPIRES_IN_SECONDS = 60 * 60;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

// Le caractère @ reste interdit afin de distinguer clairement e-mail et nom d'utilisateur.
const USERNAME_PATTERN = /^[A-Za-z0-9._]+$/;
// Ces noms pourraient laisser croire à un compte officiel ou technique.
const RESERVED_USERNAMES = new Set(["admin", "api", "auth", "support", "system"]);
// Ces motifs servent à bloquer les formes ambiguës de redirection.
const CALLBACK_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const ENCODED_PATH_SEPARATOR_PATTERN = /%(?:2f|5c)/i;

export const INVALID_CREDENTIALS_MESSAGE =
  "Adresse e-mail, nom d'utilisateur ou mot de passe incorrect.";

// Une seule forme est utilisée pour les comparaisons et la contrainte unique Prisma.
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

// La même validation est partagée entre le client, le serveur et le plugin Username.
export function isValidUsername(username: string): boolean {
  const normalizedUsername = normalizeUsername(username);

  return (
    username === username.trim() &&
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username) &&
    !RESERVED_USERNAMES.has(normalizedUsername)
  );
}

// @ ne peut pas appartenir à un nom d'utilisateur valide dans HEIG Odyssey.
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

// Accepte uniquement une destination relative appartenant à l'application.
export function sanitizeCallbackPath(callbackPath: string | undefined, fallback = "/"): string {
  if (!callbackPath || !callbackPath.startsWith("/") || callbackPath.startsWith("//")) {
    return fallback;
  }

  // Les séparateurs encodés, les barres inverses et les caractères de contrôle
  // peuvent transformer un chemin relatif en redirection externe selon le parseur.
  const pathOnly = callbackPath.split(/[?#]/, 1)[0];
  if (
    callbackPath.includes("\\") ||
    CALLBACK_CONTROL_CHARACTER_PATTERN.test(callbackPath) ||
    ENCODED_PATH_SEPARATOR_PATTERN.test(pathOnly)
  ) {
    return fallback;
  }

  try {
    // Une origine fictive permet au parseur URL de contrôler le chemin sans requête réseau.
    const safeOrigin = "https://callback.invalid";
    const parsedCallback = new URL(callbackPath, safeOrigin);
    return parsedCallback.origin === safeOrigin ? callbackPath : fallback;
  } catch {
    return fallback;
  }
}
