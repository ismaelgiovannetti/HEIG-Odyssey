import "server-only";

// HTTP n'est toléré que pour ces hôtes de développement locaux.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const INSECURE_PRODUCTION_SECRETS = new Set([
  "change-me-to-a-random-secret-key-at-least-32-characters",
]);

// Une variable absente provoque un échec immédiat au lieu d'une configuration incertaine.
function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name}_MISSING`);
  }

  return value;
}

// Le secret signe les données d'authentification et ne doit jamais utiliser une valeur courte.
export function getBetterAuthSecret(): string {
  const secret = getRequiredEnvironmentVariable("BETTER_AUTH_SECRET");

  // Better Auth exige un secret suffisamment long pour signer les jetons et cookies.
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET_TOO_SHORT");
  }

  if (
    process.env.NODE_ENV === "production" &&
    INSECURE_PRODUCTION_SECRETS.has(secret)
  ) {
    throw new Error("BETTER_AUTH_SECRET_INSECURE");
  }

  return secret;
}

// Retourne une origine contrôlée utilisée par baseURL, trustedOrigins et les e-mails.
export function getApplicationOrigin(): string {
  const configuredUrl = getRequiredEnvironmentVariable("BETTER_AUTH_URL");
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    // Le message reste générique afin de ne jamais inclure la valeur reçue dans les logs.
    throw new Error("BETTER_AUTH_URL_INVALID");
  }

  // L'URL d'authentification doit être une origine, sans identifiants ni chemin.
  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error("BETTER_AUTH_URL_INVALID");
  }

  // HTTP est accepté uniquement pour les tests effectués sur la machine locale.
  const isLocalHttp =
    parsedUrl.protocol === "http:" && LOCAL_HOSTNAMES.has(parsedUrl.hostname);
  if (parsedUrl.protocol !== "https:" && !isLocalHttp) {
    throw new Error("BETTER_AUTH_URL_INSECURE");
  }

  return parsedUrl.origin;
}
