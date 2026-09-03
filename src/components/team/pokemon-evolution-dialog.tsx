"use client";

import { useEffect, useState, useId, useRef } from "react";
import {
  Sparkles,
  ArrowRight,
  X,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import type { CollectionEntry } from "@/lib/team/collection-entry";
import { SpriteProvider } from "@/components/pokemon/sprite-provider";
import { playPokemonCry } from "@/lib/audio/pokemon-cry";
import styles from "./team-manager.module.css";

import type { EvolutionTarget } from "@/lib/pokemon/pokemon-evolution-types";

export function PokemonEvolutionDialog({
  pokemon,
  evolution,
  onClose,
  onEvolved,
}: {
  pokemon: CollectionEntry;
  evolution: EvolutionTarget;
  onClose: () => void;
  onEvolved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const [isEvolving, setIsEvolving] = useState(false);
  const [hasEvolved, setHasEvolved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.documentElement.style.overflow;

    dialog.showModal();
    document.documentElement.style.overflow = "hidden";

    return () => {
      if (dialog.open) dialog.close();
      document.documentElement.style.overflow = previousOverflow;
    };
  }, []);

  async function handleConfirmEvolve() {
    if (isEvolving || !evolution.canEvolve) return;

    setIsEvolving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/pokemon/${pokemon.id}/evolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ targetSpeciesId: evolution.targetSpeciesId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Échec de l'évolution.");
      }

      // Jouer le cri de la nouvelle espèce
      playPokemonCry(evolution.targetSpeciesId);
      setHasEvolved(true);
      onEvolved();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de l'évolution.",
      );
    } finally {
      setIsEvolving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.evolutionDialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        if (isEvolving) e.preventDefault();
        else onClose();
      }}
      onClick={(e) => {
        if (!isEvolving && e.target === e.currentTarget) onClose();
      }}
    >
      <header className={styles.dialogHeader}>
        <span id={titleId}>
          <Sparkles size={18} aria-hidden="true" /> Évolution de Pokémon
        </span>
        {!isEvolving && (
          <button
            type="button"
            className={styles.closeDetails}
            aria-label="Fermer"
            onClick={onClose}
          >
            <X size={22} aria-hidden="true" />
          </button>
        )}
      </header>

      <div className={styles.evolutionBody}>
        {errorMessage && (
          <div className={styles.editorAlert} role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {hasEvolved ? (
          <div className={styles.evolutionSuccess}>
            <div className={styles.evolutionCelebration}>
              <SpriteProvider
                speciesId={evolution.targetSpeciesId}
                variant={pokemon.isShiny ? "front_shiny" : "front"}
                alt={evolution.targetName}
                width={128}
                height={128}
                priority
              />
            </div>

            <h3>Félicitations !</h3>
            <p>
              Votre {pokemon.name} a évolué en{" "}
              <strong>{evolution.targetName}</strong> !
            </p>

            <button
              type="button"
              className={styles.saveBtn}
              onClick={onClose}
              autoFocus
            >
              Terminer
            </button>
          </div>
        ) : (
          <>
            <div className={styles.evolutionStages}>
              {/* Forme actuelle */}
              <div className={styles.evolutionStageCard}>
                <SpriteProvider
                  speciesId={pokemon.speciesId}
                  variant={pokemon.isShiny ? "front_shiny" : "front"}
                  alt={pokemon.name}
                  width={96}
                  height={96}
                />
                <strong>{pokemon.name}</strong>
                <span>Niveau {pokemon.level}</span>
              </div>

              {/* Flèche de transition */}
              <div className={styles.evolutionArrow}>
                <ArrowRight size={28} />
              </div>

              {/* Forme évoluée */}
              <div className={styles.evolutionStageCard}>
                <SpriteProvider
                  speciesId={evolution.targetSpeciesId}
                  variant={pokemon.isShiny ? "front_shiny" : "front"}
                  alt={evolution.targetName}
                  width={96}
                  height={96}
                />
                <strong>{evolution.targetName}</strong>
                <span
                  className={
                    evolution.canEvolve ? styles.levelReady : styles.levelNeeded
                  }
                >
                  Niv. {evolution.requiredLevel} requis
                </span>
              </div>
            </div>

            <div className={styles.evolutionNotice}>
              {evolution.canEvolve ? (
                <p>
                  Ce Pokémon a atteint le niveau requis et est prêt à évoluer en{" "}
                  <strong>{evolution.targetName}</strong>. Ses statistiques
                  seront considérablement améliorées !
                </p>
              ) : (
                <p>
                  Ce Pokémon requiert encore de l&apos;expérience (Niveau{" "}
                  {evolution.requiredLevel}) pour pouvoir évoluer en{" "}
                  <strong>{evolution.targetName}</strong>.
                </p>
              )}
            </div>

            <footer className={styles.editorFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={isEvolving}
              >
                Annuler
              </button>

              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleConfirmEvolve}
                disabled={isEvolving || !evolution.canEvolve}
              >
                {isEvolving ? (
                  <>
                    <LoaderCircle size={16} className={styles.loadingSpinner} />{" "}
                    Évolution en cours...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Faire évoluer
                  </>
                )}
              </button>
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}
