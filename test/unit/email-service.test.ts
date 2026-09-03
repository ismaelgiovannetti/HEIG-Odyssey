import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getApplicationOrigin } from "@/lib/auth/environment";
import {
  assertTrustedApplicationUrl,
  createEmailIdempotencyKey,
  escapeEmailHtml,
} from "@/lib/email/email-service";

beforeEach(() => {
  // Le fichier est volontairement autonome : il ne dépend pas du chargement
  // implicite d'un .env local qui n'existe pas dans GitHub Actions.
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sécurité des e-mails transactionnels", () => {
  // Un jeton ne doit jamais être envoyé vers un domaine choisi par un client.
  it("accepte uniquement les liens appartenant à l'origine configurée", () => {
    expect(() =>
      assertTrustedApplicationUrl(
        `${getApplicationOrigin()}/api/auth/reset-password/token`,
      ),
    ).not.toThrow();
    expect(() =>
      assertTrustedApplicationUrl(
        "https://malicious.example/reset-password/token",
      ),
    ).toThrow("UNTRUSTED_EMAIL_URL");
  });

  // Le nom d'affichage est une donnée utilisateur et doit rester du texte dans
  // le modèle HTML, même s'il contient une balise ou un attribut dangereux.
  it("échappe les données dynamiques insérées dans le HTML", () => {
    expect(escapeEmailHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });

  // Resend reçoit une empreinte stable pour dédupliquer l'envoi, jamais le lien
  // contenant directement le jeton temporaire.
  it("masque le jeton dans la clé d'idempotence", () => {
    const sensitiveUrl = `${getApplicationOrigin()}/reset-password/secret-token`;
    const idempotencyKey = createEmailIdempotencyKey(
      "password-reset",
      sensitiveUrl,
    );

    expect(idempotencyKey).toMatch(/^password-reset\/[a-f0-9]{64}$/);
    expect(idempotencyKey).not.toContain("secret-token");
  });
});
