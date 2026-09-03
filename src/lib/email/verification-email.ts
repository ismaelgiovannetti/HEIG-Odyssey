import {
  assertTrustedApplicationUrl,
  createEmailIdempotencyKey,
  escapeEmailHtml,
  sendTransactionalEmail,
} from "@/lib/email/email-service";

// Les données proviennent exclusivement du callback serveur de Better Auth.
type VerificationEmailInput = {
  recipient: string;
  username: string;
  verificationUrl: string;
};

// Construit les versions texte et HTML puis transmet le message à Resend.
export async function deliverVerificationEmail({
  recipient,
  username,
  verificationUrl,
}: VerificationEmailInput): Promise<void> {
  assertTrustedApplicationUrl(verificationUrl);

  // Les valeurs brutes restent réservées au texte brut et au calcul d'idempotence.
  const safeUsername = escapeEmailHtml(username);
  const safeVerificationUrl = escapeEmailHtml(verificationUrl);

  await sendTransactionalEmail({
    recipient,
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
    idempotencyKey: createEmailIdempotencyKey("verification", verificationUrl),
  });
}
