"use client";

import { useEffect, useId, useRef } from "react";
import { Leaf, LoaderCircle } from "lucide-react";
import type { CollectionEntry } from "@/lib/team/collection-entry";
import { PokemonSprite } from "./pokemon-summary";
import styles from "./team-manager.module.css";

/** Confirmation obligatoire avant la suppression définitive d'une créature. */
export function PokemonReleaseDialog({
  pokemon,
  pending,
  onCancel,
  onConfirm,
}: {
  pokemon: CollectionEntry;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;

    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    // Le choix sûr reçoit le focus initial : Entrée ne peut pas confirmer par accident.
    cancelButtonRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
      document.documentElement.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.detailsDialog} ${styles.releaseDialog}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!pending) onCancel();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (pending || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onCancel();
        }
      }}
    >
      <header
        className={`${styles.dialogHeader} ${styles.releaseDialogHeader}`}
      >
        <span id={titleId}>
          <Leaf size={22} aria-hidden="true" /> Relâcher dans la nature
        </span>
      </header>
      <div className={styles.releaseDialogBody}>
        <div className={styles.releasePokemon}>
          <PokemonSprite pokemon={pokemon} size={96} normalizeVisibleSize />
          <div>
            <p id={descriptionId}>
              Voulez-vous vraiment relâcher <strong>{pokemon.name}</strong> ?
            </p>
            <p>Cette action est définitive et ne peut pas être annulée.</p>
          </div>
        </div>
        <div className={styles.releaseDialogActions}>
          <button
            ref={cancelButtonRef}
            type="button"
            className={styles.releaseCancel}
            disabled={pending}
            onClick={onCancel}
          >
            Annuler
          </button>
          <button
            type="button"
            className={styles.releaseConfirm}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? (
              <LoaderCircle
                className={styles.savingIcon}
                size={18}
                aria-hidden="true"
              />
            ) : (
              <Leaf size={18} aria-hidden="true" />
            )}
            Confirmer
          </button>
        </div>
      </div>
    </dialog>
  );
}
