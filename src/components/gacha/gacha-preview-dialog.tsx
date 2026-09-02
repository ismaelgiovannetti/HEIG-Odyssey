"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SpriteProvider } from "@/components/SpriteProvider";
import type { GachaBannerConfig } from "@/lib/content/schemas";
import type { PokemonRarity } from "@/lib/gacha/gacha-service";
import styles from "./gacha-shop.module.css";

export interface GachaPreviewSpecies {
  id: string;
  name: string;
  dexNumber: number;
  rarity: PokemonRarity;
}

interface GachaPreviewDialogProps {
  banner: GachaBannerConfig;
  species: GachaPreviewSpecies[];
  onClose: () => void;
}

const PREVIEW_PAGE_SIZE = 24;
const RARITY_ORDER: Readonly<Record<PokemonRarity, number>> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
};
const RARITY_LABELS: Readonly<Record<PokemonRarity, string>> = {
  COMMON: "Commun",
  RARE: "Rare",
  EPIC: "Épique",
};

function formatIndividualChance(chance: number): string {
  const percentage = chance * 100;
  const decimals = percentage >= 10 ? 1 : percentage >= 1 ? 2 : 3;
  const formatted = percentage
    .toFixed(decimals)
    .replace(".", ",")
    .replace(/(,\d*?)0+$/, "$1")
    .replace(/,$/, "");
  return `${formatted} %`;
}

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
  const speciesWithChance = useMemo(() => {
    const countByRarity = species.reduce<Record<PokemonRarity, number>>(
      (counts, pokemon) => ({
        ...counts,
        [pokemon.rarity]: counts[pokemon.rarity] + 1,
      }),
      { COMMON: 0, RARE: 0, EPIC: 0 },
    );
    const rateByRarity: Readonly<Record<PokemonRarity, number>> = {
      COMMON: banner.rates.common,
      RARE: banner.rates.rare,
      EPIC: banner.rates.epic,
    };

    // Le serveur choisit d'abord une rareté puis une espèce uniformément dans
    // son sous-pool : taux de rareté / nombre d'espèces de cette rareté.
    return species
      .map((pokemon) => ({
        ...pokemon,
        chance: countByRarity[pokemon.rarity] > 0
          ? rateByRarity[pokemon.rarity] / countByRarity[pokemon.rarity]
          : 0,
      }))
      .sort((left, right) =>
        RARITY_ORDER[left.rarity] - RARITY_ORDER[right.rarity] ||
        right.chance - left.chance ||
        left.dexNumber - right.dexNumber,
      );
  }, [banner.rates.common, banner.rates.epic, banner.rates.rare, species]);
  const pageCount = Math.max(1, Math.ceil(speciesWithChance.length / PREVIEW_PAGE_SIZE));
  const visibleSpecies = speciesWithChance.slice(
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
                alt=""
                width={64}
                height={64}
                normalizeVisibleSize
              />
              <strong>{pokemon.name}</strong>
              <span className={styles.previewChance} data-rarity={pokemon.rarity.toLowerCase()}>
                {RARITY_LABELS[pokemon.rarity]} · {formatIndividualChance(pokemon.chance)}
              </span>
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
