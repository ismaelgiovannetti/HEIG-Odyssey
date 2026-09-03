"use client";

import { Hand, Info } from "lucide-react";
import type { DragEvent, KeyboardEvent, RefCallback } from "react";
import type { CollectionSnapshot } from "@/lib/team/team-client";
import { cellKey, describeCell, type TeamCell } from "@/lib/team/team-draft";
import { PokemonSprite, PokemonTypes } from "./pokemon-summary";
import styles from "./team-manager.module.css";

type Pokemon = CollectionSnapshot["pokemon"][number];

interface TeamPokemonCellProps {
  cell: TeamCell;
  pokemon?: Pokemon;
  picked: boolean;
  frozen: boolean;
  highlighted: boolean;
  tabStop: boolean;
  detailsDisabled: boolean;
  buttonRef: RefCallback<HTMLButtonElement>;
  canDrop: () => boolean;
  onFocus: (cell: TeamCell) => void;
  onActivate: (cell: TeamCell) => void;
  onNavigate: (event: KeyboardEvent<HTMLButtonElement>, cell: TeamCell) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, cell: TeamCell) => void;
  onDragEnd: () => void;
  onHighlight: (key?: string) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>, cell: TeamCell) => void;
  onOpenDetails: (id: string) => void;
}

/** Carte visuelle ; le rangement et la sauvegarde restent dans TeamManager. */
export function TeamPokemonCell({
  cell,
  pokemon,
  picked,
  frozen,
  highlighted,
  tabStop,
  detailsDisabled,
  buttonRef,
  canDrop,
  onFocus,
  onActivate,
  onNavigate,
  onDragStart,
  onDragEnd,
  onHighlight,
  onDrop,
  onOpenDetails,
}: TeamPokemonCellProps) {
  const key = cellKey(cell);
  const isTeam = cell.area === "team";
  const movementButton = (
    <button
      type="button"
      ref={buttonRef}
      className={`${styles.cell} ${isTeam ? styles.teamCell : styles.pcCell}`}
      data-picked={(!isTeam && picked) || undefined}
      data-over={(!isTeam && highlighted) || undefined}
      data-empty={(!isTeam && !pokemon) || undefined}
      aria-label={`${describeCell(cell)} : ${pokemon ? `${pokemon.name}, niveau ${pokemon.level}${pokemon.isShiny ? ", chromatique" : ""}${pokemon.currentHp === 0 ? ", K.O." : ""}` : "vide"}`}
      aria-pressed={picked}
      aria-disabled={frozen}
      tabIndex={isTeam || tabStop ? 0 : -1}
      draggable={Boolean(pokemon) && !frozen}
      onFocus={() => onFocus(cell)}
      onClick={() => onActivate(cell)}
      onKeyDown={(event) => onNavigate(event, cell)}
      onDragStart={(event) => onDragStart(event, cell)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.stopPropagation();
        if (!canDrop() || frozen) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onHighlight(key);
      }}
      onDragLeave={() => onHighlight()}
      onDrop={(event) => onDrop(event, cell)}
    >
      <span className={styles.slotNumber} aria-hidden="true">
        {String(cell.slot).padStart(2, "0")}
      </span>
      {pokemon ? (
        <>
          <PokemonSprite
            pokemon={pokemon}
            size={isTeam ? 80 : 45}
            normalizeVisibleSize
          />
          {isTeam ? (
            <span className={styles.teamInfo} aria-hidden="true">
              <span className={styles.nameLine}>
                <strong>{pokemon.name}</strong>
                <span>Niv. {pokemon.level}</span>
              </span>
              <PokemonTypes types={pokemon.types} />
              <span className={styles.hpLine}>
                <span className={styles.hpBar}>
                  <span
                    style={{
                      width: `${Math.min(100, (pokemon.currentHp / pokemon.maxHp) * 100)}%`,
                    }}
                  />
                </span>
                <span>
                  {pokemon.currentHp === 0
                    ? "K.O."
                    : `${pokemon.currentHp}/${pokemon.maxHp} PV`}
                </span>
              </span>
            </span>
          ) : (
            <>
              {pokemon.isShiny && (
                <span className={styles.shiny} aria-hidden="true">
                  ✦
                </span>
              )}
              {pokemon.currentHp === 0 && (
                <span className={styles.ko} aria-hidden="true">
                  K.O.
                </span>
              )}
            </>
          )}
          {picked && (
            <Hand className={styles.pickedMark} size={14} aria-hidden="true" />
          )}
        </>
      ) : (
        <span className={styles.emptyLabel} aria-hidden="true">
          {isTeam ? "Emplacement libre" : "+"}
        </span>
      )}
    </button>
  );

  if (!isTeam) return movementButton;
  return (
    <div
      className={styles.teamCard}
      data-picked={picked || undefined}
      data-over={highlighted || undefined}
      data-empty={!pokemon || undefined}
    >
      {movementButton}
      {pokemon && (
        <button
          type="button"
          className={styles.detailsButton}
          aria-label={`Voir les détails de ${pokemon.name}`}
          aria-haspopup="dialog"
          title={`Voir les détails de ${pokemon.name}`}
          disabled={detailsDisabled}
          onClick={() => onOpenDetails(pokemon.id)}
        >
          <Info size={22} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
