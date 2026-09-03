import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { SpriteProvider } from "@/components/pokemon/sprite-provider";
import { StarterTypeBadge } from "@/components/onboarding/starter-type-badge";
import { getPokemonTypeLabel } from "@/lib/pokemon/type-presentation";
import type { StarterView } from "@/lib/starter/starter-contract";

type StarterCatalogProps = Readonly<{
  availableTypes: string[];
  filteredCount: number;
  generation: string;
  page: number;
  pokemonType: string;
  query: string;
  selectedSpeciesId: string | null;
  totalPages: number;
  visibleStarters: StarterView[];
  onGenerationChange: (generation: string) => void;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onSelectStarter: (starter: StarterView) => void;
  onTypeChange: (type: string) => void;
}>;

export function StarterCatalog({
  availableTypes,
  filteredCount,
  generation,
  page,
  pokemonType,
  query,
  selectedSpeciesId,
  totalPages,
  visibleStarters,
  onGenerationChange,
  onPageChange,
  onQueryChange,
  onSelectStarter,
  onTypeChange,
}: StarterCatalogProps) {
  return (
    <div className="starter-browser">
      <div className="starter-toolbar">
        <label className="starter-search">
          <span className="visually-hidden">Rechercher une créature</span>
          <Search aria-hidden="true" size={17} />
          <input
            type="search"
            value={query}
            placeholder="Nom ou numéro du Pokédex"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <label className="starter-filter">
          <span>Génération</span>
          <select
            value={generation}
            onChange={(event) => onGenerationChange(event.target.value)}
          >
            <option value="all">Toutes</option>
            {[1, 2, 3, 4].map((item) => (
              <option key={item} value={item}>
                Gen {item}
              </option>
            ))}
          </select>
        </label>
        <label className="starter-filter">
          <span>Type</span>
          <select
            value={pokemonType}
            onChange={(event) => onTypeChange(event.target.value)}
          >
            <option value="all">Tous</option>
            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {getPokemonTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <span className="starter-result-count" aria-live="polite">
          {filteredCount} résultat{filteredCount !== 1 ? "s" : ""}
        </span>
      </div>

      {visibleStarters.length ? (
        <div className="starter-grid" aria-label="Partenaires disponibles">
          {visibleStarters.map((starter) => (
            <button
              key={starter.speciesId}
              className={
                starter.speciesId === selectedSpeciesId
                  ? "starter-option is-selected"
                  : "starter-option"
              }
              type="button"
              aria-pressed={starter.speciesId === selectedSpeciesId}
              onClick={() => onSelectStarter(starter)}
            >
              <SpriteProvider
                speciesId={starter.speciesId}
                alt=""
                width={62}
                height={62}
              />
              <span className="starter-option__identity">
                <strong>{starter.name}</strong>
                <small>
                  #{String(starter.dexNumber ?? 0).padStart(3, "0")} · Gen{" "}
                  {starter.generation}
                </small>
              </span>
              <span
                className="starter-option__types"
                aria-label={
                  "Types : " + starter.types.map(getPokemonTypeLabel).join(", ")
                }
              >
                {starter.types.map((type) => (
                  <StarterTypeBadge key={type} type={type} />
                ))}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="starter-empty-state">
          <Search aria-hidden="true" size={25} />
          <p>Aucune créature ne correspond à ces filtres.</p>
        </div>
      )}

      {totalPages > 1 ? (
        <nav
          className="starter-pagination"
          aria-label="Pagination des partenaires"
        >
          <button
            type="button"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <span>
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
            aria-label="Page suivante"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
