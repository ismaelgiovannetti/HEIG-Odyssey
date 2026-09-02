"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import type { CollectionEntry } from "@/lib/team/collection-entry";
import { getEvolutionOptions, type EvolutionTarget } from "@/lib/pokemon/pokemon-evolution-types";
import { PokemonSummary } from "./pokemon-summary";
import { PokemonMovesEditor } from "./pokemon-moves-editor";
import { PokemonEvolutionDialog } from "./pokemon-evolution-dialog";
import styles from "./team-manager.module.css";

export function PokemonDetailsDialog({
  pokemon,
  onClose,
  onUpdated,
}: {
  pokemon: CollectionEntry;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const [isMovesEditorOpen, setIsMovesEditorOpen] = useState(false);
  const [selectedEvolution, setSelectedEvolution] = useState<EvolutionTarget | null>(null);

  // Les évolutions sont calculées immédiatement sans requête réseau superflue
  const evolutions = useMemo(
    () => getEvolutionOptions(pokemon.speciesId, pokemon.level),
    [pokemon.speciesId, pokemon.level],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;

    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
      document.documentElement.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus();
      }
    };
  }, []);

  return (
    <>
      <dialog
        ref={dialogRef}
        className={styles.detailsDialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          ) {
            onClose();
          }
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

        <PokemonSummary
          pokemon={pokemon}
          titleId={titleId}
          evolutions={evolutions}
          onOpenMovesEditor={() => setIsMovesEditorOpen(true)}
          onOpenEvolution={(evo) => setSelectedEvolution(evo)}
        />
      </dialog>

      {/* Modal d'édition des capacités */}
      {isMovesEditorOpen && (
        <PokemonMovesEditor
          pokemon={pokemon}
          onClose={() => setIsMovesEditorOpen(false)}
          onSaved={() => {
            onUpdated?.();
          }}
        />
      )}

      {/* Modal d'évolution */}
      {selectedEvolution && (
        <PokemonEvolutionDialog
          pokemon={pokemon}
          evolution={selectedEvolution}
          onClose={() => setSelectedEvolution(null)}
          onEvolved={() => {
            onUpdated?.();
          }}
        />
      )}
    </>
  );
}
