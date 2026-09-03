"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

import { signOutCurrentSession } from "@/lib/auth/client";
import { FormAlert } from "@/components/auth/form-alert";

/**
 * Invalide la session courante et empêche un second clic pendant la requête.
 * Une erreur laisse le joueur sur la page afin qu'il puisse réessayer.
 */
export function LogoutButton() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setError(null);
    setIsPending(true);

    try {
      const result = await signOutCurrentSession();

      if (result.error) {
        setError("La déconnexion a échoué. Réessayez.");
        return;
      }

      // Une navigation complète garantit que les données privées en mémoire
      // sont abandonnées après la déconnexion.
      window.location.assign("/login?loggedOut=1");
    } catch {
      setError("La déconnexion a échoué. Réessayez.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="auth-form">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <button
        className="auth-submit pixel-btn"
        type="button"
        onClick={handleSignOut}
        disabled={isPending}
      >
        {isPending ? (
          <span className="auth-spinner" aria-hidden="true" />
        ) : (
          <LogOut aria-hidden="true" size={19} />
        )}
        <span>{isPending ? "Déconnexion..." : "Confirmer la déconnexion"}</span>
      </button>
    </div>
  );
}
