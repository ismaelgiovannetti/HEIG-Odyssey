"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
  allowVisibilityToggle?: boolean;
};

/**
 * Champ de mot de passe réutilisable avec aide, erreur accessible et bouton
 * d'affichage facultatif. La confirmation reste masquée lorsque ce bouton est désactivé.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
  allowVisibilityToggle = true,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  // Relie le champ à son erreur ou à son aide pour les lecteurs d'écran.
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-wrap">
        <input
          id={id}
          name={id}
          type={allowVisibilityToggle && isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={8}
          maxLength={128}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          required
        />
        {/* La confirmation du mot de passe n'expose volontairement pas ce contrôle. */}
        {allowVisibilityToggle ? (
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setIsVisible((visible) => !visible)}
            aria-label={
              isVisible
                ? `Masquer ${label.toLowerCase()}`
                : `Afficher ${label.toLowerCase()}`
            }
            aria-pressed={isVisible}
          >
            {isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="auth-field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="auth-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
