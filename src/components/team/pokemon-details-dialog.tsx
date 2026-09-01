"use client";

import { useEffect, useId, useRef } from "react";
import { Info, X } from "lucide-react";
import type { CollectionEntry } from "@/lib/team/collection-entry";
import { PokemonSummary } from "./pokemon-summary";
import styles from "./team-manager.module.css";

/** Fenêtre de consultation : aucune écriture ni requête supplémentaire. */
export function PokemonDetailsDialog({
  pokemon,
  onClose,
}: {
  pokemon: CollectionEntry;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;

    // La fenêtre native maintient Tab à l'intérieur et rend l'arrière-plan
    // inactif. Son affichage au premier plan échappe aux débordements du shell.
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
      document.documentElement.style.overflow = previousOverflow;
      // On retrouve le bouton exact, même après une fermeture au clavier.
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.detailsDialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Échap ferme seulement la fiche, sans remonter au déplacement du PC.
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        // Un clic sur le voile ferme la fiche, mais pas un clic dans son contenu
        // ou ses marges intérieures (la cible peut aussi être le dialogue).
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <header className={styles.dialogHeader}>
        <span>
          <Info size={18} aria-hidden="true" /> Fiche du Pokémon
        </span>
        <button
          ref={closeButtonRef}
          type="button"
          className={styles.closeDetails}
          aria-label="Fermer la fiche du Pokémon"
          onClick={onClose}
        >
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <PokemonSummary pokemon={pokemon} titleId={titleId} />
    </dialog>
  );
}
