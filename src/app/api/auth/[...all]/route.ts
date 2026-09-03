import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

const MAX_AUTH_BODY_BYTES = 16 * 1024;
const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

function authBodyError(status: 400 | 413, message: string): Response {
  return Response.json(
    { message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/**
 * Better Auth lit ses corps en mémoire. On borne donc le flux brut avant de
 * lui reconstruire une Request équivalente, sans se fier au seul Content-Length.
 */
async function readBoundedAuthRequest(
  request: Request,
): Promise<Request | Response> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) {
      return authBodyError(400, "Corps de requête invalide.");
    }
    if (Number(declaredLength) > MAX_AUTH_BODY_BYTES) {
      return authBodyError(413, "Corps de requête trop volumineux.");
    }
  }

  if (!request.body) return request;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_AUTH_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return authBodyError(413, "Corps de requête trop volumineux.");
      }
      chunks.push(value);
    }
  } catch {
    return authBodyError(400, "Corps de requête invalide.");
  } finally {
    reader.releaseLock();
  }

  const body = new ArrayBuffer(totalBytes);
  const bytes = new Uint8Array(body);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const headers = new Headers(request.headers);
  headers.set("content-length", String(totalBytes));

  // Le flux original est désormais consommé : il ne peut pas servir d'entrée
  // au constructeur Fetch, même lorsqu'un nouveau body est fourni.
  return new Request(request.url, {
    method: request.method,
    body: totalBytes === 0 ? null : body,
    headers,
    redirect: request.redirect,
    signal: request.signal,
  });
}

// Better Auth traite ici toutes les sous-routes POST de /api/auth, après la
// limite adaptée aux formulaires JSON/urlencoded de l'application actuelle.
export async function POST(request: Request): Promise<Response> {
  const boundedRequest = await readBoundedAuthRequest(request);
  if (boundedRequest instanceof Response) return boundedRequest;
  return handlers.POST(boundedRequest);
}
