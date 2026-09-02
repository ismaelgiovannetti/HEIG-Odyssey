"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SpriteProvider } from "@/components/SpriteProvider";
import type { GachaBannerConfig } from "@/lib/content/schemas";
import styles from "./gacha-shop.module.css";

export interface GachaPreviewSpecies {
  id: string;
  name: string;
  dexNumber: number;
}

interface GachaPreviewDialogProps {
  banner: GachaBannerConfig;
  species: GachaPreviewSpecies[];
  onClose: () => void;
}

const PREVIEW_PAGE_SIZE = 24;

/** Aperçu paginé : les grands pools restent consultables sans scroll interne. */
export function GachaPreviewDialog({
  banner,
  species,
  onClose,
}: Readonly<GachaPreviewDialogProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(species.length / PREVIEW_PAGE_SIZE));
  const visibleSpecies = species.slice(
    page * PREVIEW_PAGE_SIZE,
    (page + 1) * PREVIEW_PAGE_SIZE,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;

    dialog.showModal();
    closeButtonRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  function previousPage() {
    setPage((current) => Math.max(0, current - 1));
  }

  function nextPage() {
    setPage((current) => Math.min(pageCount - 1, current + 1));
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.previewDialog}
      data-banner={banner.id}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "ArrowLeft") previousPage();
        if (event.key === "ArrowRight") nextPage();
      }}
    >
      <header className={styles.previewHeader}>
        <div>
          <span>Aperçu de la bannière</span>
          <h2 id={titleId}>{banner.name}</h2>
          <p id={descriptionId}>{species.length} Pokémon disponibles</p>
        </div>
        <button ref={closeButtonRef} type="button" aria-label="Fermer l’aperçu" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      {visibleSpecies.length > 0 ? (
        <div className={styles.previewGrid} role="list" aria-label={`Pokémon disponibles dans ${banner.name}`}>
          {visibleSpecies.map((pokemon) => (
            <article className={styles.previewPokemon} role="listitem" key={pokemon.id}>
              <span>N° {String(pokemon.dexNumber).padStart(3, "0")}</span>
              <SpriteProvider
                speciesId={pokemon.id}
                alt={pokemon.name}
                width={64}
                height={64}
                normalizeVisibleSize
              />
              <strong>{pokemon.name}</strong>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.previewEmpty} role="status">Aucun Pokémon disponible.</p>
      )}

      <footer className={styles.previewPagination}>
        <button type="button" onClick={previousPage} disabled={page === 0} aria-label="Page précédente">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span>Page <strong>{page + 1}</strong> sur <strong>{pageCount}</strong></span>
        <button type="button" onClick={nextPage} disabled={page >= pageCount - 1} aria-label="Page suivante">
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </footer>
    </dialog>
  );
}
