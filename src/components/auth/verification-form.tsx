"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";

import { requestVerificationEmail } from "@/lib/auth-client";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Explique l'étape de vérification et permet de demander un nouveau message
 * sans obliger le joueur à recommencer son inscription.
 */
export function VerificationForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // L'adresse est lue depuis cet onglet uniquement pour éviter une nouvelle
  // saisie. Elle n'est pas conservée durablement dans le navigateur.
  useEffect(() => {
    try {
      const storedEmail = window.sessionStorage.getItem(
        "heig-odyssey-verification-email"
      );

      if (storedEmail) {
        setEmail(storedEmail);
      }
    } catch {
      // Le formulaire reste utilisable si le navigateur bloque le stockage.
    }
  }, []);

  const accountCreated = searchParams.get("sent") === "1";

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setFormError(null);

    if (!EMAIL_PATTERN.test(email.trim())) {
      setFormError("Saisissez une adresse e-mail valide.");
      return;
    }

    setIsPending(true);

    try {
      const result = await requestVerificationEmail(email);

      if (result.error) {
        setFormError("Impossible de traiter la demande maintenant. Réessayez plus tard.");
        return;
      }

      // La réponse ne confirme jamais l'existence du compte afin d'éviter
      // l'énumération d'adresses e-mail.
      setMessage("Si cette adresse correspond à un compte, un nouveau lien a été envoyé.");
    } catch {
      setFormError("Impossible de traiter la demande maintenant. Réessayez plus tard.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="auth-form">
      <div className="auth-mail-illustration" aria-hidden="true">
        <MailCheck size={38} />
      </div>

      {accountCreated ? (
        <FormAlert tone="success">
          Compte créé. Consultez votre boîte e-mail pour vérifier votre adresse.
        </FormAlert>
      ) : null}

      {message ? <FormAlert tone="success">{message}</FormAlert> : null}
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      <p className="auth-instruction">
        Le lien est valable pendant une heure. Pensez à vérifier votre dossier spam.
        Vous devrez ensuite vous connecter manuellement.
      </p>

      <form className="auth-form auth-form--nested" onSubmit={handleResend} noValidate>
        <div className="auth-field">
          <label htmlFor="verification-email">Adresse e-mail</label>
          <input
            id="verification-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="dresseur@exemple.ch"
            required
          />
        </div>

        <SubmitButton isPending={isPending} pendingLabel="Envoi...">
          Renvoyer le lien
        </SubmitButton>
      </form>

      <p className="auth-switch">
        Adresse déjà vérifiée ? <Link href="/login">Retour à la connexion</Link>
      </p>
    </div>
  );
}
