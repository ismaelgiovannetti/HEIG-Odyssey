"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  buildPostSignInCallback,
  signInWithIdentifier,
} from "@/lib/auth/client";
import { INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/constants";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";

/**
 * Gère la connexion depuis un champ unique acceptant l'e-mail ou le nom
 * d'utilisateur, ainsi que les différents retours du parcours de session.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Les paramètres décrivent la raison d'arrivée sur la page sans conserver
  // d'état global supplémentaire dans l'application.
  const verificationFailed = searchParams.has("error");
  const verified = searchParams.get("verified") === "1" && !verificationFailed;
  const loggedOut = searchParams.get("loggedOut") === "1";
  const sessionExpired = searchParams.get("sessionExpired") === "1";
  const nextPath = searchParams.get("next") ?? undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!identifier.trim() || !password) {
      setFormError("Renseignez votre identifiant et votre mot de passe.");
      return;
    }

    setIsPending(true);

    try {
      const result = await signInWithIdentifier({
        identifier,
        password,
        rememberMe,
        callbackPath: nextPath,
      });

      if (result.error) {
        // Le message reste générique pour ne révéler ni l'existence du compte
        // ni la partie des identifiants qui serait incorrecte.
        setFormError(INVALID_CREDENTIALS_MESSAGE);
        return;
      }

      // Le plugin Better Auth effectue normalement cette navigation. Cette
      // redirection de secours garde le parcours fiable selon le navigateur.
      window.location.assign(buildPostSignInCallback(nextPath));
    } catch {
      setFormError("La connexion est momentanément indisponible. Réessayez.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {verified ? (
        <FormAlert tone="success">
          Adresse vérifiée. Vous pouvez maintenant vous connecter.
        </FormAlert>
      ) : null}

      {verificationFailed ? (
        <FormAlert tone="error">
          Ce lien de vérification est invalide ou a expiré. Demandez-en un
          nouveau.
        </FormAlert>
      ) : null}

      {loggedOut ? (
        <FormAlert tone="success">Vous êtes maintenant déconnecté.</FormAlert>
      ) : null}

      {sessionExpired ? (
        <FormAlert tone="info">
          Votre session a expiré. Connectez-vous à nouveau.
        </FormAlert>
      ) : null}

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      <div className="auth-field">
        <label htmlFor="identifier">
          Adresse e-mail ou nom d&apos;utilisateur
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="dresseur@exemple.ch ou Dresseur42"
          required
          autoFocus
        />
      </div>

      <PasswordField
        id="password"
        label="Mot de passe"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      <p className="auth-recovery-link">
        <Link href="/forgot-password">Mot de passe oublié&nbsp;?</Link>
      </p>

      <label className="auth-checkbox">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
        />
        <span>Rester connecté sur cet appareil</span>
      </label>

      <SubmitButton isPending={isPending} pendingLabel="Connexion...">
        Se connecter
      </SubmitButton>

      <p className="auth-switch">
        Pas encore de compte ? <Link href="/signup">Créer un compte</Link>
      </p>
    </form>
  );
}
