import { ArrowLeft, LoaderCircle } from "lucide-react";
import type { Ref } from "react";

import { StarterCatalog } from "@/components/onboarding/starter-catalog";
import { StarterDetail } from "@/components/onboarding/starter-detail";
import type { StarterView } from "@/lib/starter/starter-contract";

export type StarterCatalogState = "loading" | "ready" | "error";

type StarterSelectionPhaseProps = Readonly<{
  availableTypes: string[];
  catalogState: StarterCatalogState;
  filteredCount: number;
  generation: string;
  headingRef: Ref<HTMLHeadingElement>;
  page: number;
  pokemonType: string;
  query: string;
  selectedStarter: StarterView | null;
  totalPages: number;
  visibleStarters: StarterView[];
  onBack: () => void;
  onChooseStarter: () => void;
  onGenerationChange: (generation: string) => void;
  onPageChange: (page: number) => void;
  onPlayCry: (starter: StarterView) => void;
  onQueryChange: (query: string) => void;
  onRetry: () => void;
  onSelectStarter: (starter: StarterView) => void;
  onTypeChange: (type: string) => void;
}>;

export function StarterSelectionPhase({
  availableTypes,
  catalogState,
  filteredCount,
  generation,
  headingRef,
  page,
  pokemonType,
  query,
  selectedStarter,
  totalPages,
  visibleStarters,
  onBack,
  onChooseStarter,
  onGenerationChange,
  onPageChange,
  onPlayCry,
  onQueryChange,
  onRetry,
  onSelectStarter,
  onTypeChange,
}: StarterSelectionPhaseProps) {
  return (
    <section
      className="starter-selection"
      aria-labelledby="starter-selection-title"
    >
      <div className="starter-selection__heading">
        <h2 id="starter-selection-title" ref={headingRef} tabIndex={-1}>
          Choisissez votre partenaire
        </h2>
      </div>

      {catalogState === "loading" ? (
        <div className="starter-catalog-state" role="status">
          <LoaderCircle
            className="starter-loading-icon"
            aria-hidden="true"
            size={28}
          />
          <p>Chargement des partenaires disponibles...</p>
        </div>
      ) : null}

      {catalogState === "error" ? (
        <div
          className="starter-catalog-state starter-catalog-state--error"
          role="alert"
        >
          <p>Le catalogue ne peut pas être chargé pour le moment.</p>
          <button type="button" onClick={onRetry}>
            Réessayer
          </button>
        </div>
      ) : null}

      {catalogState === "ready" ? (
        <>
          <div className="starter-selection__workspace">
            <StarterCatalog
              availableTypes={availableTypes}
              filteredCount={filteredCount}
              generation={generation}
              page={page}
              pokemonType={pokemonType}
              query={query}
              selectedSpeciesId={selectedStarter?.speciesId ?? null}
              totalPages={totalPages}
              visibleStarters={visibleStarters}
              onGenerationChange={onGenerationChange}
              onPageChange={onPageChange}
              onQueryChange={onQueryChange}
              onSelectStarter={onSelectStarter}
              onTypeChange={onTypeChange}
            />
            <StarterDetail
              starter={selectedStarter}
              onChoose={onChooseStarter}
              onPlayCry={onPlayCry}
            />
          </div>

          <button
            className="onboarding-text-button starter-selection__back"
            type="button"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" size={16} /> Retour
          </button>
        </>
      ) : null}
    </section>
  );
}
