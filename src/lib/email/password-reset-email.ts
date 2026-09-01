import {
  assertTrustedApplicationUrl,
  createEmailIdempotencyKey,
  escapeEmailHtml,
  sendTransactionalEmail,
} from "@/lib/email/email-service";

type PasswordResetEmailInput = {
  recipient: string;
  username: string;
  resetUrl: string;
};

/** Construit le message de récupération sans exposer le jeton ailleurs. */
export async function deliverPasswordResetEmail({
  recipient,
  username,
  resetUrl,
}: PasswordResetEmailInput): Promise<void> {
  assertTrustedApplicationUrl(resetUrl);

  const safeUsername = escapeEmailHtml(username);
  const safeResetUrl = escapeEmailHtml(resetUrl);

  await sendTransactionalEmail({
    recipient,
    subject: "Réinitialisez votre mot de passe - HEIG Odyssey",
    text: [
      `Bonjour ${username},`,
      "",
      "Une demande de réinitialisation a été reçue pour votre compte HEIG Odyssey :",
      resetUrl,
      "",
      "Ce lien est personnel, utilisable une seule fois et expire dans une heure.",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
    ].join("\n"),
    html: `
      <main style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px;margin:auto">
        <h1 style="font-size:24px">Réinitialisation du mot de passe</h1>
        <p>Bonjour ${safeUsername},</p>
        <p>Une demande de réinitialisation a été reçue pour votre compte HEIG Odyssey.</p>
        <p style="margin:28px 0">
          <a href="${safeResetUrl}" style="background:#dc2626;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">
            Choisir un nouveau mot de passe
          </a>
        </p>
        <p>Ce lien est personnel, utilisable une seule fois et expire dans une heure.</p>
        <p style="font-size:13px;color:#667085">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
      </main>
    `,
    idempotencyKey: createEmailIdempotencyKey("password-reset", resetUrl),
  });
}
