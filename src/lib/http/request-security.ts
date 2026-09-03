import "server-only";

import { getApplicationOrigin } from "@/lib/auth/environment";

export type ProtectedJsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 403 | 413 | 415; error: string };

const JSON_CONTENT_TYPE = "application/json";

/**
 * Lit un petit corps JSON après avoir vérifié l'origine et le type MIME.
 * La limite est appliquée aux octets réellement reçus, sans faire confiance à
 * Content-Length, afin d'éviter qu'une route ne mette un corps arbitraire en mémoire.
 */
export async function readProtectedJsonBody(
  request: Request,
  maxBytes = 16 * 1024,
): Promise<ProtectedJsonBodyResult> {
  if (request.headers.get("origin") !== getApplicationOrigin()) {
    return { ok: false, status: 403, error: "Origine de la requête refusée." };
  }

  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== JSON_CONTENT_TYPE) {
    return { ok: false, status: 415, error: "Un corps JSON est requis." };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      return {
        ok: false,
        status: 413,
        error: "Corps de requête trop volumineux.",
      };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, status: 400, error: "Corps de requête invalide." };
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let receivedBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return {
          ok: false,
          status: 413,
          error: "Corps de requête trop volumineux.",
        };
      }

      text += decoder.decode(value, { stream: true });
    }

    const value: unknown = JSON.parse(text + decoder.decode());
    return { ok: true, value };
  } catch {
    return { ok: false, status: 400, error: "Corps de requête invalide." };
  } finally {
    reader.releaseLock();
  }
}
