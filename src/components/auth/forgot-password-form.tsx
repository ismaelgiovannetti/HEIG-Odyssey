"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { requestPasswordRecovery } from "@/lib/auth-client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEUTRAL_CONFIRMATION_MESSAGE =
  "Si un compte correspond à cette adresse, un lien de récupération vient d'être envoyé.";

/**
 * Envoie une demande de récupération sans jamais confirmer qu'un compte existe.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    setFormError(null);

    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError("Saisissez une adresse e-mail valide.");
      return;
    }

    setIsPending(true);

    try {
      const result = await requestPasswordRecovery(email);

      if (result.error) {
        // Un incident global peut être signalé sans révéler l'existence du compte.
        setFormError("Impossible de traiter la demande maintenant. Réessayez plus tard.");
        return;
      }

      setIsSubmitted(true);
    } catch {
      setFormError("Impossible de traiter la demande maintenant. Réessayez plus tard.");
    } finally {
      setIsPending(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="auth-form">
        <FormAlert tone="success">{NEUTRAL_CONFIRMATION_MESSAGE}</FormAlert>
        <p className="auth-instruction auth-instruction--centered">
          Le lien est personnel et expire après une heure. Vérifiez également
          votre dossier de courriers indésirables.
        </p>
        <p className="auth-switch">
          Vous connaissez votre mot de passe ? <Link href="/login">Se connecter</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      <div className="auth-field">
        <label htmlFor="recovery-email">Adresse e-mail du compte</label>
        <input
          id="recovery-email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="dresseur@exemple.ch"
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "recovery-email-error" : undefined}
          required
          autoFocus
        />
        {emailError ? (
          <p className="auth-field__error" id="recovery-email-error">
            {emailError}
          </p>
        ) : null}
      </div>

      <SubmitButton isPending={isPending} pendingLabel="Envoi...">
        Envoyer le lien de récupération
      </SubmitButton>

      <p className="auth-switch">
        Retour à la <Link href="/login">connexion</Link>
      </p>
    </form>
  );
}
