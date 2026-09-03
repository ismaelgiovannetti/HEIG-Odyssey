"use client";

import { useEffect, useId, useRef } from "react";
import { CircleHelp, Keyboard, MousePointer2, X } from "lucide-react";
import styles from "./team-manager.module.css";

/** Aide ponctuelle : elle reste hors du flux pour ne jamais réduire les panneaux. */
export function TeamTipsDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mouseTitleId = useId();
  const keyboardTitleId = useId();
  const generalTitleId = useId();

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
    <dialog
      ref={dialogRef}
      className={`${styles.detailsDialog} ${styles.tipsDialog}`}
      aria-label="Tips"
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
      <button
        ref={closeButtonRef}
        type="button"
        className={styles.tipsDialogClose}
        aria-label="Fermer les Tips"
        onClick={onClose}
      >
        <X size={19} aria-hidden="true" />
      </button>
      <div className={styles.tipsDialogBody}>
        <section aria-labelledby={mouseTitleId}>
          <h3 id={mouseTitleId}>
            <MousePointer2 size={18} aria-hidden="true" /> Souris
          </h3>
          <ul>
            <li>
              <strong>Clic ou glisser-déposer :</strong> prenez et posez un
              Pokémon par clic, ou faites-le glisser vers une case.
            </li>
            <li>
              <strong>Cadre de la boîte :</strong> déposez le Pokémon sur le
              cadre pour utiliser la première case libre.
            </li>
            <li>
              <strong>Changer de boîte en glissant :</strong> maintenez le
              Pokémon sur une flèche pour ouvrir la boîte voisine.
            </li>
          </ul>
        </section>
        <section aria-labelledby={keyboardTitleId}>
          <h3 id={keyboardTitleId}>
            <Keyboard size={18} aria-hidden="true" /> Clavier
          </h3>
          <ul>
            <li>
              <strong>Entrée / Espace :</strong> prenez un Pokémon, puis
              posez-le sur la case choisie.
            </li>
            <li>
              <strong>Flèches directionnelles :</strong> passez d’une case à
              l’autre.
            </li>
            <li>
              <strong>Tab :</strong> parcourez les éléments interactifs de la
              page.
            </li>
            <li>
              <strong>Échap :</strong> fermez la fenêtre d’aide.
            </li>
          </ul>
        </section>
        <section aria-labelledby={generalTitleId}>
          <h3 id={generalTitleId}>
            <CircleHelp size={18} aria-hidden="true" /> Général
          </h3>
          <ul>
            <li>
              <strong>Case occupée :</strong> les deux Pokémon échangent leur
              place.
            </li>
            <li>
              <strong>Échap :</strong> annulez le déplacement en cours.
            </li>
            <li>
              <strong>Sauvegarde automatique :</strong> l’équipe et le rangement
              du PC sont enregistrés après chaque déplacement ou échange.
            </li>
            <li>
              <strong>Relâcher un Pokémon :</strong> utilisez le bouton feuille
              sous le PC. Le dernier partenaire actif ne peut pas être relâché.
            </li>
          </ul>
        </section>
      </div>
    </dialog>
  );
}
