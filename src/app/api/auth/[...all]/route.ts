import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better Auth traite ici toutes les sous-routes de /api/auth.
export const { GET, POST } = toNextJsHandler(auth);
