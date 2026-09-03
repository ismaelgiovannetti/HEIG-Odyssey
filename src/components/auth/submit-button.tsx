type SubmitButtonProps = {
  isPending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
};

/**
 * Bouton de soumission commun. Il bloque les doubles envois et annonce
 * visuellement l'opération en cours sans dupliquer cette logique par formulaire.
 */
export function SubmitButton({
  isPending,
  pendingLabel,
  children,
}: SubmitButtonProps) {
  return (
    <button
      className="auth-submit pixel-btn"
      type="submit"
      disabled={isPending}
    >
      {isPending ? <span className="auth-spinner" aria-hidden="true" /> : null}
      <span>{isPending ? pendingLabel : children}</span>
    </button>
  );
}
