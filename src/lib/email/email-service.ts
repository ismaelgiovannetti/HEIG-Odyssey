import { createHash } from "node:crypto";

import { Resend } from "resend";

import { getApplicationOrigin } from "@/lib/auth/environment";

type TransactionalEmail = {
  recipient: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
};

let resendClient: Resend | undefined;

// Le client reste exclusivement côté serveur et n'est créé qu'au premier envoi.
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY_MISSING");
  }

  resendClient ??= new Resend(apiKey);
  return resendClient;
}

function getSender(): string {
  const sender = process.env.RESEND_FROM_EMAIL;

  if (!sender) {
    throw new Error("RESEND_FROM_EMAIL_MISSING");
  }

  return sender;
}

/** Échappe toute donnée dynamique avant son insertion dans un e-mail HTML. */
export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Refuse qu'un lien d'authentification sorte de l'origine configurée. */
export function assertTrustedApplicationUrl(url: string): void {
  const parsedUrl = new URL(url);

  if (parsedUrl.origin !== getApplicationOrigin()) {
    throw new Error("UNTRUSTED_EMAIL_URL");
  }
}

/**
 * Une empreinte permet à Resend d'ignorer un double envoi sans placer le
 * jeton sensible dans sa clé d'idempotence.
 */
export function createEmailIdempotencyKey(namespace: string, url: string): string {
  const linkHash = createHash("sha256").update(url).digest("hex");
  return `${namespace}/${linkHash}`;
}

/** Envoie un message transactionnel sans propager les détails de Resend. */
export async function sendTransactionalEmail({
  recipient,
  subject,
  text,
  html,
  idempotencyKey,
}: TransactionalEmail): Promise<void> {
  const { error } = await getResendClient().emails.send(
    {
      from: getSender(),
      to: recipient,
      subject,
      text,
      html,
    },
    { idempotencyKey },
  );

  if (error) {
    throw new Error("RESEND_EMAIL_DELIVERY_FAILED");
  }
}
