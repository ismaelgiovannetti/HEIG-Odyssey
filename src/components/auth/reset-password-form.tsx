"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { resetPasswordWithToken } from "@/lib/auth-client";
import {
  getPasswordValidationError,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "@/lib/auth/constants";

type FieldErrors = Partial<Record<"password" | "confirmation", string>>;

/** Valide le jeton reçu par e-mail puis remplace le mot de passe du compte. */
export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const hasInvalidLink = searchParams.has("error") || !token;
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackRevision, setFeedbackRevision] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  function validateForm(): FieldErrors {
    const errors: FieldErrors = {};
    const passwordError = getPasswordValidationError(password);

    if (passwordError) {
      errors.password = passwordError;
    }

    if (!confirmation) {
      errors.confirmation = "Confirmez votre nouveau mot de passe.";
    } else if (confirmation !== password) {
      errors.confirmation = "Les deux mots de passe ne correspondent pas.";
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Force le remontage du message si le joueur répète la même erreur : le
    // retour visuel et l'annonce accessible restent perceptibles à chaque essai.
    setFeedbackRevision((currentRevision) => currentRevision + 1);
    setFormError(null);

    const errors = validateForm();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setFormError("Corrigez les champs signalés avant de continuer.");
      return;
    }

    setIsPending(true);

    try {
      const result = await resetPasswordWithToken({ token, newPassword: password });

      if (result.error) {
        // Le même message couvre un jeton inconnu, expiré ou déjà consommé.
        setFormError("Ce lien de récupération est invalide, expiré ou déjà utilisé.");
        return;
      }

      // Le jeton consommé disparaît de la barre d'adresse et de l'historique courant.
      window.history.replaceState(null, "", "/reset-password?success=1");
      setIsComplete(true);
    } catch {
      setFormError("La réinitialisation est momentanément indisponible. Réessayez.");
    } finally {
      setIsPending(false);
    }
  }

  if (isComplete) {
    return (
      <div className="auth-form">
        <FormAlert tone="success">
          Votre mot de passe a été modifié. Toutes vos anciennes sessions ont été déconnectées.
        </FormAlert>
        <p className="auth-switch">
          Vous pouvez maintenant <Link href="/login?passwordReset=1">vous connecter</Link>.
        </p>
      </div>
    );
  }

  if (hasInvalidLink) {
    return (
      <div className="auth-form">
        <FormAlert tone="error">
          Ce lien de récupération est invalide, expiré ou déjà utilisé.
        </FormAlert>
        <p className="auth-switch">
          <Link href="/forgot-password">Demander un nouveau lien</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {formError ? (
        <FormAlert key={feedbackRevision} tone="error">
          {formError}
        </FormAlert>
      ) : null}

      <PasswordField
        id="new-password"
        label="Nouveau mot de passe"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        error={fieldErrors.password}
        hint={PASSWORD_REQUIREMENTS_MESSAGE}
      />

      <PasswordField
        id="new-password-confirmation"
        label="Confirmer le nouveau mot de passe"
        value={confirmation}
        onChange={setConfirmation}
        autoComplete="new-password"
        error={fieldErrors.confirmation}
        allowVisibilityToggle={false}
      />

      <SubmitButton isPending={isPending} pendingLabel="Modification...">
        Enregistrer le nouveau mot de passe
      </SubmitButton>
    </form>
  );
}
