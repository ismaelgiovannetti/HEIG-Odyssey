import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Lit la session Better Auth depuis les en-têtes de la requête serveur. React
 * mémorise le résultat pendant ce rendu afin que le layout et la page ne
 * dupliquent pas l'accès à PostgreSQL.
 */
export const getServerSession = cache(async () => {
  const requestHeaders = await headers();

  return auth.api.getSession({
    headers: requestHeaders,
  });
});
