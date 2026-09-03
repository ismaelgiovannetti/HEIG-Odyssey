"use client";

import { useEffect, useState, useId, useRef } from "react";
import { Swords, Check, X, LoaderCircle, AlertCircle, Plus, Sparkles } from "lucide-react";
import type { CollectionEntry } from "@/lib/team/collection-entry";
import type { Move } from "@/lib/content/schemas";
import type { LearnableMove } from "@/lib/pokemon/pokemon-learnset-service";
import { PokemonTypes } from "./pokemon-summary";
import styles from "./team-manager.module.css";

export function PokemonMovesEditor({
  pokemon,
  onClose,
  onSaved,
}: {
  pokemon: CollectionEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const [isLoading, setIsLoading] = useState(true);
  const [learnableMoves, setLearnableMoves] = useState<LearnableMove[]>([]);
  const [selectedMoveIds, setSelectedMoveIds] = useState<string[]>(
    pokemon.moves.map((m) => m.id),
  );
  const [isSaving, setIsSaving] = useState(false);
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

  useEffect(() => {
    let isMounted = true;

    async function loadLearnset() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/pokemon/${pokemon.id}/learnset`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Impossible de charger les capacités.");
        }

        if (isMounted) {
          setLearnableMoves(data.learnableMoves || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err?.message || "Erreur lors du chargement des capacités.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLearnset();

    return () => {
      isMounted = false;
    };
  }, [pokemon.id]);

  function handleEquipMove(moveId: string) {
    setErrorMessage(null);
    if (selectedMoveIds.includes(moveId)) return;

    if (selectedMoveIds.length >= 4) {
      setErrorMessage("4 capacités sont déjà équipées. Retirez-en une pour équiper celle-ci.");
      return;
    }

    setSelectedMoveIds([...selectedMoveIds, moveId]);
  }

  function handleRemoveMove(moveId: string) {
    setErrorMessage(null);
    if (selectedMoveIds.length <= 1) {
      setErrorMessage("Un Pokémon doit conserver au moins 1 capacité active.");
      return;
    }

    setSelectedMoveIds(selectedMoveIds.filter((id) => id !== moveId));
  }

  async function handleSave() {
    if (selectedMoveIds.length === 0 || selectedMoveIds.length > 4) {
      setErrorMessage("Veuillez sélectionner entre 1 et 4 capacités.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/pokemon/${pokemon.id}/moves`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ moveIds: selectedMoveIds }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Échec de l'enregistrement des capacités.");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  }

  // Trouver les détails complets des capacités sélectionnées
  const learnableMap = new Map(learnableMoves.map((m) => [m.id, m]));
  // Fallback avec les capacités actuelles de pokemon si pas encore dans learnable
  const currentMap = new Map(pokemon.moves.map((m) => [m.id, m]));

  const equippedMoves = selectedMoveIds.map((id) => {
    return (
      learnableMap.get(id) ||
      currentMap.get(id) || {
        id,
        name: id,
        type: "Normal" as const,
        category: "physical" as const,
        power: 0,
        accuracy: 100,
        pp: 35,
        maxPp: 35,
        priority: 0,
      }
    );
  });

  return (
    <dialog
      ref={dialogRef}
      className={styles.movesEditorDialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className={styles.dialogHeader}>
        <span id={titleId}>
          <Swords size={18} aria-hidden="true" /> Modifier les capacités de {pokemon.name}
        </span>
        <button
          type="button"
          className={styles.closeDetails}
          aria-label="Fermer"
          onClick={onClose}
        >
          <X size={22} aria-hidden="true" />
        </button>
      </header>

      <div className={styles.movesEditorBody}>
        {errorMessage && (
          <div className={styles.editorAlert} role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Emplacements équipés (1 à 4 slots) */}
        <section className={styles.equippedSection}>
          <div className={styles.sectionHeading}>
            <h3>Capacités actives ({equippedMoves.length}/4)</h3>
            <small>Choisissez jusqu&apos;à 4 capacités à emmener en combat</small>
          </div>

          <div className={styles.equippedGrid}>
            {[0, 1, 2, 3].map((slotIndex) => {
              const move = equippedMoves[slotIndex];

              if (move) {
                return (
                  <div key={move.id} className={styles.equippedCard}>
                    <div className={styles.equippedCardTop}>
                      <strong>{move.name}</strong>
                      <button
                        type="button"
                        className={styles.removeMoveBtn}
                        title="Retirer cette capacité"
                        onClick={() => handleRemoveMove(move.id)}
                        disabled={equippedMoves.length <= 1}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className={styles.equippedCardMeta}>
                      <PokemonTypes types={[move.type]} />
                      <span>{move.pp} PP</span>
                      {move.power > 0 && <span>Pui. {move.power}</span>}
                    </div>
                  </div>
                );
              }

              return (
                <div key={`empty-${slotIndex}`} className={styles.emptySlotCard}>
                  <span>Emplacement libre</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. Liste des attaques apprises selon le niveau */}
        <section className={styles.learnableSection}>
          <div className={styles.sectionHeading}>
            <h3>Capacités disponibles au Niveau {pokemon.level}</h3>
            <small>Attaques débloquées par montée de niveau</small>
          </div>

          {isLoading ? (
            <div className={styles.loadingState}>
              <LoaderCircle className={styles.loadingSpinner} size={24} />
              <p>Chargement des capacités du Pokémon...</p>
            </div>
          ) : (
            <div className={styles.learnableList}>
              {learnableMoves.map((move) => {
                const isEquipped = selectedMoveIds.includes(move.id);

                return (
                  <div
                    key={move.id}
                    className={`${styles.learnableCard} ${
                      isEquipped ? styles.isEquipped : ""
                    }`}
                  >
                    <div className={styles.learnableCardInfo}>
                      <div className={styles.learnableCardTitle}>
                        <strong>{move.name}</strong>
                        <span className={styles.levelBadge}>
                          Niv. {move.learnedAtLevel}
                        </span>
                        <PokemonTypes types={[move.type]} />
                        <span className={styles.categoryBadge}>
                          {move.category === "physical"
                            ? "Physique"
                            : move.category === "special"
                              ? "Spéciale"
                              : "Statut"}
                        </span>
                      </div>

                      <div className={styles.learnableCardStats}>
                        <span>Puissance : {move.power || "-"}</span>
                        <span>Précision : {move.accuracy ? `${move.accuracy}%` : "-"}</span>
                        <span>PP max : {move.pp}</span>
                      </div>

                      {move.description && (
                        <p className={styles.moveDescription}>{move.description}</p>
                      )}
                    </div>

                    <div className={styles.learnableCardAction}>
                      {isEquipped ? (
                        <button
                          type="button"
                          className={styles.equippedActionBtn}
                          onClick={() => handleRemoveMove(move.id)}
                          disabled={equippedMoves.length <= 1}
                        >
                          <Check size={14} /> Équipée
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.equipActionBtn}
                          onClick={() => handleEquipMove(move.id)}
                          disabled={selectedMoveIds.length >= 4}
                        >
                          <Plus size={14} /> Équiper
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <footer className={styles.editorFooter}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={onClose}
          disabled={isSaving}
        >
          Annuler
        </button>

        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={isSaving || selectedMoveIds.length === 0}
        >
          {isSaving ? (
            <>
              <LoaderCircle size={16} className={styles.loadingSpinner} /> Enregistrement...
            </>
          ) : (
            "Enregistrer les capacités"
          )}
        </button>
      </footer>
    </dialog>
  );
}
