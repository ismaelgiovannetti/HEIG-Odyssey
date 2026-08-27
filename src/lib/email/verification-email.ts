import { createHash } from "node:crypto";

import { Resend } from "resend";

import { getApplicationOrigin } from "@/lib/auth/environment";

// Les données proviennent exclusivement du callback serveur de Better Auth.
type VerificationEmailInput = {
  recipient: string;
  username: string;
  verificationUrl: string;
};

let resendClient: Resend | undefined;

// Le client est créé à la première utilisation afin de ne jamais exposer la clé au navigateur.
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY_MISSING");
  }

  resendClient ??= new Resend(apiKey);
  return resendClient;
}

function getSender(): string {
  // L'adresse d'envoi doit appartenir au domaine vérifié dans Resend.
  const sender = process.env.RESEND_FROM_EMAIL;

  if (!sender) {
    throw new Error("RESEND_FROM_EMAIL_MISSING");
  }

  return sender;
}

// Échappe toutes les valeurs dynamiques injectées dans le contenu HTML.
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Le lien doit revenir sur l'origine configurée de l'application.
function assertTrustedVerificationUrl(verificationUrl: string): void {
  const parsedVerificationUrl = new URL(verificationUrl);

  // Un lien provenant d'une autre origine pourrait rediriger le joueur vers un site malveillant.
  if (parsedVerificationUrl.origin !== getApplicationOrigin()) {
    throw new Error("UNTRUSTED_VERIFICATION_URL");
  }
}

// Resend utilise cette clé pour ignorer une répétition exacte du même envoi.
function createVerificationIdempotencyKey(verificationUrl: string): string {
  // Le hash empêche un double envoi sans enregistrer le jeton sensible dans la clé Resend.
  const verificationHash = createHash("sha256").update(verificationUrl).digest("hex");
  return `verification/${verificationHash}`;
}

// Construit les versions texte et HTML puis transmet le message à Resend.
export async function deliverVerificationEmail({
  recipient,
  username,
  verificationUrl,
}: VerificationEmailInput): Promise<void> {
  assertTrustedVerificationUrl(verificationUrl);

  // Les valeurs brutes restent réservées au texte brut et au calcul d'idempotence.
  const safeUsername = escapeHtml(username);
  const safeVerificationUrl = escapeHtml(verificationUrl);
  const resend = getResendClient();
  const { error } = await resend.emails.send(
    {
      from: getSender(),
      to: recipient,
      subject: "Vérifiez votre adresse e-mail - HEIG Odyssey",
      text: [
        `Bonjour ${username},`,
        "",
        "Vérifiez votre adresse e-mail pour activer votre compte HEIG Odyssey :",
        verificationUrl,
        "",
        "Ce lien expire dans une heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
      ].join("\n"),
      html: `
        <main style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px;margin:auto">
          <h1 style="font-size:24px">Bienvenue dans HEIG Odyssey</h1>
          <p>Bonjour ${safeUsername},</p>
          <p>Vérifiez votre adresse e-mail pour activer votre compte.</p>
          <p style="margin:28px 0">
            <a href="${safeVerificationUrl}" style="background:#dc2626;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">
              Vérifier mon adresse e-mail
            </a>
          </p>
          <p>Ce lien expire dans une heure.</p>
          <p style="font-size:13px;color:#667085">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
        </main>
      `,
    },
    {
      idempotencyKey: createVerificationIdempotencyKey(verificationUrl),
    },
  );

  // L'erreur détaillée de Resend n'est pas propagée afin d'éviter toute fuite d'information.
  if (error) {
    throw new Error("RESEND_EMAIL_DELIVERY_FAILED");
  }
}
