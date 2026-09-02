"use client";

import { useEffect, useId, useRef } from "react";
import { LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { SpriteProvider } from "@/components/SpriteProvider";
import type { GachaBannerConfig } from "@/lib/content/schemas";
import type { GachaExecutionResult } from "@/lib/gacha/gacha-service";
import { GachaEgg } from "./gacha-egg";
import styles from "./gacha-shop.module.css";

export type PullPhase = "requesting" | "hatching" | "revealed";

interface GachaPullDialogProps {
  banner: GachaBannerConfig;
  phase: PullPhase;
  result: GachaExecutionResult | null;
  canPullAgain: boolean;
  onClose: () => void;
  onPullAgain: () => void;
}

const RARITY_LABELS = {
  COMMON: "Commun",
  RARE: "Rare",
  EPIC: "Épique",
} as const;

/**
 * Fenêtre d'éclosion isolée du flux de la page. Pendant la requête, elle ne
 * peut pas être fermée afin de ne jamais masquer un résultat déjà débité.
 */
export function GachaPullDialog({
  banner,
  phase,
  result,
  canPullAgain,
  onClose,
  onPullAgain,
}: Readonly<GachaPullDialogProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;

    dialog.showModal();
    dialog.focus();
    document.documentElement.style.overflow = "hidden";

    return () => {
      if (dialog.open) dialog.close();
      document.documentElement.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  useEffect(() => {
    if (phase !== "revealed") return;
    (canPullAgain ? primaryButtonRef : closeButtonRef).current?.focus();
  }, [canPullAgain, phase]);

  const isRevealed = phase === "revealed" && result;

  return (
    <dialog
      ref={dialogRef}
      className={styles.pullDialog}
      data-banner={banner.id}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={phase !== "revealed"}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (phase === "revealed") onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (phase !== "revealed" || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (outside) onClose();
      }}
    >
      <header className={styles.dialogHeader}>
        <div>
          <span className={styles.dialogEyebrow}>{banner.name}</span>
          <h2 id={titleId}>
            {isRevealed ? "Recrutement réussi" : "Ouverture du portail"}
          </h2>
        </div>
        {isRevealed ? (
          <button ref={closeButtonRef} type="button" aria-label="Fermer le résultat" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <div className={styles.dialogBody} data-phase={phase}>
        <div className={styles.hatchScene} aria-hidden="true">
          <span className={styles.hatchGlow} />
          <span className={styles.eggShell}>
            <GachaEgg />
            <span className={styles.eggCrack} />
          </span>
          {result ? (
            <SpriteProvider
              speciesId={result.pokemon.speciesId}
              variant={result.pokemon.isShiny ? "front_shiny" : "front"}
              alt=""
              width={176}
              height={176}
              className={styles.revealedSprite}
              normalizeVisibleSize
            />
          ) : null}
        </div>

        <div className={styles.dialogCopy} aria-live="polite">
          {phase === "requesting" ? (
            <>
              <LoaderCircle className={styles.spinner} size={24} aria-hidden="true" />
              <p id={descriptionId}>Un nouveau partenaire Pokémon répond à votre appel…</p>
            </>
          ) : phase === "hatching" ? (
            <>
              <Sparkles size={24} aria-hidden="true" />
              <p id={descriptionId}>L’œuf est en train d’éclore…</p>
            </>
          ) : result ? (
            <div className={styles.pullResult} id={descriptionId}>
              <span
                className={styles.rarityBadge}
                data-rarity={result.pokemon.rarity.toLowerCase()}
              >
                {RARITY_LABELS[result.pokemon.rarity]}
                {result.pokemon.isShiny ? " · Chromatique" : ""}
              </span>
              <strong>{result.pokemon.name}</strong>
              <p>
                Niveau {result.pokemon.level} · Nature {result.pokemon.nature}
              </p>
              <span className={styles.collectionNotice}>
                {result.isDuplicate ? "Pokémon ajouté automatiquement au PC" : "Nouveau Pokémon ajouté au PC"}
              </span>
              <dl>
                <div>
                  <dt>Nouveau solde</dt>
                  <dd>{result.newBalance} ₽</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </div>

      {isRevealed ? (
        <footer className={styles.dialogActions}>
          <button ref={primaryButtonRef} type="button" className={styles.primaryButton} disabled={!canPullAgain} onClick={onPullAgain}>
            <RefreshCw size={17} aria-hidden="true" /> Tirer à nouveau
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Retour aux portails
          </button>
          {!canPullAgain ? <p>Solde insuffisant pour un nouveau tirage sur ce portail.</p> : null}
        </footer>
      ) : null}
    </dialog>
  );
}
