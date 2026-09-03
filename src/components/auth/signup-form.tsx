"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { checkUsernameAvailability, signUpWithEmail } from "@/lib/auth/client";
import {
  getPasswordValidationError,
  isValidUsername,
  PASSWORD_REQUIREMENTS_MESSAGE,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/constants";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";

type FieldErrors = Partial<
  Record<"username" | "email" | "password" | "passwordConfirmation", string>
>;
type UsernameAvailabilityStatus =
  "idle" | "checking" | "available" | "taken" | "error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_AVAILABILITY_DELAY_MS = 450;
const USERNAME_REQUIREMENTS_MESSAGE =
  "3 à 30 caractères : lettres, chiffres, point ou tiret bas.";

/**
 * Collecte et valide les informations nécessaires à Better Auth, puis conduit
 * le joueur vers l'écran de vérification après une création réussie.
 */
export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [usernameAvailability, setUsernameAvailability] =
    useState<UsernameAvailabilityStatus>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackRevision, setFeedbackRevision] = useState(0);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!isValidUsername(username)) {
      setUsernameAvailability("idle");
      return;
    }

    let shouldIgnoreResult = false;
    setUsernameAvailability("checking");

    const timeoutId = window.setTimeout(() => {
      void checkUsernameAvailability(username)
        .then((result) => {
          if (shouldIgnoreResult) return;

          if (result.error || !result.data) {
            setUsernameAvailability("error");
            return;
          }

          setUsernameAvailability(
            result.data.available ? "available" : "taken",
          );
        })
        .catch(() => {
          if (!shouldIgnoreResult) setUsernameAvailability("error");
        });
    }, USERNAME_AVAILABILITY_DELAY_MS);

    return () => {
      shouldIgnoreResult = true;
      window.clearTimeout(timeoutId);
    };
  }, [username]);

  // Cette validation donne un retour immédiat. Better Auth et la base restent
  // responsables de la validation définitive côté serveur.
  function validateForm(): FieldErrors {
    const errors: FieldErrors = {};

    if (!isValidUsername(username)) {
      errors.username = `Utilisez ${USERNAME_MIN_LENGTH} à ${USERNAME_MAX_LENGTH} caractères : lettres, chiffres, point ou tiret bas.`;
    } else if (usernameAvailability === "taken") {
      errors.username = "Ce nom d'utilisateur est déjà pris.";
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "Saisissez une adresse e-mail valide.";
    }

    const passwordValidationError = getPasswordValidationError(password);
    if (passwordValidationError) {
      errors.password = passwordValidationError;
    }

    if (!passwordConfirmation) {
      errors.passwordConfirmation = "Confirmez votre mot de passe.";
    } else if (passwordConfirmation !== password) {
      errors.passwordConfirmation =
        "Les deux mots de passe ne correspondent pas.";
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Une nouvelle clé remonte l'alerte même lorsque deux tentatives produisent
    // exactement le même texte. L'animation et le lecteur d'écran sont relancés.
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
      const result = await signUpWithEmail({
        username,
        email,
        password,
        callbackPath: "/login?verified=1",
      });

      if (result.error) {
        // Le refus final reste générique : la disponibilité du nom est publique,
        // mais l'adresse enregistrée et les détails du serveur restent privés.
        setFormError(
          "Impossible de créer le compte avec ces informations. Vérifiez les champs ou essayez une autre adresse.",
        );
        return;
      }

      // L'adresse reste uniquement dans cet onglet pour préremplir le renvoi.
      // Le parcours continue même si le stockage du navigateur est désactivé.
      try {
        window.sessionStorage.setItem(
          "heig-odyssey-verification-email",
          email.trim().toLowerCase(),
        );
      } catch {
        // L'utilisateur pourra ressaisir son adresse sur l'écran suivant.
      }

      router.push("/verify-email?sent=1");
    } catch {
      setFormError("L'inscription est momentanément indisponible. Réessayez.");
    } finally {
      setIsPending(false);
    }
  }

  function handleUsernameChange(nextUsername: string) {
    setUsername(nextUsername);
    setUsernameAvailability("idle");
    setFieldErrors((currentErrors) => {
      if (!currentErrors.username) return currentErrors;

      const nextErrors = { ...currentErrors };
      delete nextErrors.username;
      return nextErrors;
    });
  }

  let usernameFeedback = USERNAME_REQUIREMENTS_MESSAGE;
  let usernameFeedbackClassName = "auth-field__hint";

  if (fieldErrors.username) {
    usernameFeedback = fieldErrors.username;
    usernameFeedbackClassName = "auth-field__error";
  } else if (usernameAvailability === "checking") {
    usernameFeedback = "Vérification de la disponibilité…";
    usernameFeedbackClassName =
      "auth-field__availability auth-field__availability--checking";
  } else if (usernameAvailability === "available") {
    usernameFeedback = "Ce nom d'utilisateur est disponible.";
    usernameFeedbackClassName =
      "auth-field__availability auth-field__availability--available";
  } else if (usernameAvailability === "taken") {
    usernameFeedback = "Ce nom d'utilisateur est déjà pris.";
    usernameFeedbackClassName =
      "auth-field__availability auth-field__availability--taken";
  } else if (usernameAvailability === "error") {
    usernameFeedback =
      "La disponibilité ne peut pas être vérifiée pour le moment.";
    usernameFeedbackClassName =
      "auth-field__availability auth-field__availability--error";
  }

  return (
    <form
      className="auth-form auth-form--signup"
      onSubmit={handleSubmit}
      noValidate
    >
      {formError ? (
        <FormAlert key={feedbackRevision} tone="error">
          {formError}
        </FormAlert>
      ) : null}

      <div className="auth-field">
        <label htmlFor="username">Nom d&apos;utilisateur</label>
        <input
          id="username"
          name="username"
          type="text"
          value={username}
          onChange={(event) => handleUsernameChange(event.target.value)}
          minLength={USERNAME_MIN_LENGTH}
          maxLength={USERNAME_MAX_LENGTH}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Dresseur42"
          aria-invalid={
            Boolean(fieldErrors.username) || usernameAvailability === "taken"
          }
          aria-busy={usernameAvailability === "checking"}
          aria-describedby="username-help"
          required
          autoFocus
        />
        <p
          className={usernameFeedbackClassName}
          id="username-help"
          aria-live="polite"
          aria-atomic="true"
        >
          {usernameFeedback}
        </p>
      </div>

      <div className="auth-field">
        <label htmlFor="email">Adresse e-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="dresseur@exemple.ch"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          required
        />
        {fieldErrors.email ? (
          <p className="auth-field__error" id="email-error">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <PasswordField
        id="password"
        label="Mot de passe"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        error={fieldErrors.password}
        hint={PASSWORD_REQUIREMENTS_MESSAGE}
      />

      <PasswordField
        id="password-confirmation"
        label="Confirmer le mot de passe"
        value={passwordConfirmation}
        onChange={setPasswordConfirmation}
        autoComplete="new-password"
        error={fieldErrors.passwordConfirmation}
        allowVisibilityToggle={false}
      />

      <SubmitButton isPending={isPending} pendingLabel="Création...">
        Créer mon compte
      </SubmitButton>

      <p className="auth-switch">
        Déjà un compte ? <Link href="/login">Se connecter</Link>
      </p>
    </form>
  );
}
