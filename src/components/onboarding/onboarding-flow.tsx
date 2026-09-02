"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Dices,
  Gamepad2,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";

import { SpriteProvider } from "@/components/SpriteProvider";
import { StarterShowcase } from "@/components/onboarding/starter-showcase";
import { playPokemonCry } from "@/lib/audio/pokemon-cry";

type BaseStats = {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
};

type StarterMove = {
  id: string;
  name: string;
  type: string;
};

export type StarterView = {
  speciesId: string;
  dexNumber?: number;
  name: string;
  generation?: number;
  types: string[];
  level: number;
  description?: string;
  moves: StarterMove[];
  baseStats?: BaseStats;
};

type StarterListResponse = {
  success: boolean;
  starters?: StarterView[];
};

type StarterClaimResponse = {
  success: boolean;
  error?: string;
  pokemon?: {
    id: string;
    speciesId: string;
    name: string;
    level: number;
    isShiny: boolean;
  };
};

type Phase = "intro" | "selection" | "confirmation" | "success";
type CatalogState = "loading" | "ready" | "error";

const PAGE_SIZE = 12;

const TYPE_LABELS: Record<string, string> = {
  Normal: "Normal",
  Fire: "Feu",
  Water: "Eau",
  Grass: "Plante",
  Electric: "Électrik",
  Ice: "Glace",
  Fighting: "Combat",
  Poison: "Poison",
  Ground: "Sol",
  Flying: "Vol",
  Psychic: "Psy",
  Bug: "Insecte",
  Rock: "Roche",
  Ghost: "Spectre",
  Dragon: "Dragon",
  Steel: "Acier",
  Dark: "Ténèbres",
};

const TYPE_COLORS: Record<string, string> = {
  Normal: "#8f8f84",
  Fire: "#d95b32",
  Water: "#3c78c5",
  Grass: "#4f9a51",
  Electric: "#c49a12",
  Ice: "#4fa5b3",
  Fighting: "#ad3d35",
  Poison: "#8f4c9d",
  Ground: "#a77a3e",
  Flying: "#6c82ba",
  Psychic: "#c64f78",
  Bug: "#7c9130",
  Rock: "#8d7d43",
  Ghost: "#65547f",
  Dragon: "#6352b3",
  Steel: "#6f8793",
  Dark: "#60554e",
};

const STATS: Array<{ key: keyof BaseStats; label: string }> = [
  { key: "hp", label: "PV" },
  { key: "attack", label: "ATQ" },
  { key: "defense", label: "DEF" },
  { key: "specialAttack", label: "ATQ.SP" },
  { key: "specialDefense", label: "DEF.SP" },
  { key: "speed", label: "VIT" },
];

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function TypeBadge({ type }: Readonly<{ type: string }>) {
  const style = {
    "--starter-type-color": TYPE_COLORS[type] ?? "#6b7280",
  } as CSSProperties;

  return (
    <span className="starter-type" style={style}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

/**
 * Parcours interactif du premier lancement. L'API ne reçoit jamais
 * d'identifiant utilisateur : le propriétaire du starter est déterminé
 * exclusivement par la session Better Auth côté serveur.
 */
export function OnboardingFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [catalogState, setCatalogState] = useState<CatalogState>("loading");
  const [catalog, setCatalog] = useState<StarterView[]>([]);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [generation, setGeneration] = useState("all");
  const [pokemonType, setPokemonType] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(
    null,
  );
  const [candidate, setCandidate] = useState<StarterView | null>(null);
  const [nickname, setNickname] = useState("");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedPokemon, setClaimedPokemon] = useState<NonNullable<
    StarterClaimResponse["pokemon"]
  > | null>(null);
  const phaseHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousPhaseRef = useRef<Phase>(phase);

  // Le contrôle qui déclenche une transition disparaît avec son écran. Le
  // focus rejoint donc le nouveau titre pour préserver le parcours clavier.
  useEffect(() => {
    if (previousPhaseRef.current !== phase) {
      phaseHeadingRef.current?.focus();
    }

    previousPhaseRef.current = phase;
  }, [phase]);

  // Le catalogue est public, mais son chargement reste annulable si le joueur
  // quitte la page avant la fin de la requête.
  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      setCatalogState("loading");

      try {
        const response = await fetch("/api/starter/list", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("STARTER_CATALOG_UNAVAILABLE");

        const data = (await response.json()) as StarterListResponse;
        if (
          !data.success ||
          !Array.isArray(data.starters) ||
          data.starters.length === 0
        ) {
          throw new Error("STARTER_CATALOG_INVALID");
        }

        setCatalog(data.starters);
        setSelectedSpeciesId(data.starters[0].speciesId);
        setCatalogState("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setCatalogState("error");
      }
    }

    void loadCatalog();
    return () => controller.abort();
  }, [catalogAttempt]);

  const availableTypes = useMemo(
    () =>
      Array.from(new Set(catalog.flatMap((starter) => starter.types))).sort(),
    [catalog],
  );

  const filteredStarters = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);

    return catalog.filter((starter) => {
      const matchesQuery =
        !normalizedQuery ||
        normalizeSearchValue(starter.name).includes(normalizedQuery) ||
        normalizeSearchValue(starter.speciesId).includes(normalizedQuery) ||
        String(starter.dexNumber ?? "").includes(normalizedQuery);
      const matchesGeneration =
        generation === "all" || String(starter.generation) === generation;
      const matchesType =
        pokemonType === "all" || starter.types.includes(pokemonType);
      return matchesQuery && matchesGeneration && matchesType;
    });
  }, [catalog, generation, pokemonType, query]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStarters.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages - 1);
  const visibleStarters = filteredStarters.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );
  const selectedStarter =
    filteredStarters.find(
      (starter) => starter.speciesId === selectedSpeciesId,
    ) ??
    filteredStarters[0] ??
    null;

  function updateFilters(update: () => void) {
    // Un nouveau filtre repart de la première page et laisse le détail suivre
    // automatiquement le premier résultat de la nouvelle liste.
    update();
    setPage(0);
    setSelectedSpeciesId(null);
  }

  function changePage(nextPage: number) {
    const boundedPage = Math.max(0, Math.min(totalPages - 1, nextPage));
    const firstStarterOnPage = filteredStarters[boundedPage * PAGE_SIZE];

    // Le détail ne doit jamais conserver un Pokémon invisible appartenant à
    // la page précédente du catalogue.
    setPage(boundedPage);
    setSelectedSpeciesId(firstStarterOnPage?.speciesId ?? null);
  }

  function selectStarter(starter: StarterView) {
    setSelectedSpeciesId(starter.speciesId);
    setClaimError(null);
    playPokemonCry(starter.speciesId, starter.dexNumber);
  }

  function openConfirmation() {
    if (!selectedStarter) return;
    playPokemonCry(selectedStarter.speciesId, selectedStarter.dexNumber);
    setCandidate(selectedStarter);
    setNickname("");
    setClaimError(null);
    setPhase("confirmation");
  }

  async function claimStarter() {
    if (!candidate || isClaiming) return;
    setIsClaiming(true);
    setClaimError(null);

    try {
      const response = await fetch("/api/starter/choose", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          speciesId: candidate.speciesId,
          ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
        }),
      });
      const data = (await response
        .json()
        .catch(() => null)) as StarterClaimResponse | null;

      if (response.status === 401) {
        router.replace("/login?sessionExpired=1");
        return;
      }
      if (!response.ok || !data?.success || !data.pokemon) {
        setClaimError(
          response.status === 409
            ? "Ce recrutement a déjà été utilisé. Actualisez la page pour continuer."
            : "Le recrutement n'a pas pu être finalisé. Réessayez dans un instant.",
        );
        return;
      }

      setClaimedPokemon(data.pokemon);
      setPhase("success");
      router.prefetch("/dashboard");
    } catch {
      // Le détail technique reste dans le navigateur ; l'interface expose un
      // message stable qui ne révèle ni infrastructure ni donnée sensible.
      setClaimError(
        "Le recrutement est momentanément indisponible. Réessayez.",
      );
    } finally {
      setIsClaiming(false);
    }
  }

  function enterDashboard() {
    // replace empêche le bouton Retour de rejouer un onboarding terminé.
    router.replace("/dashboard");
    router.refresh();
  }

  const stepNumber = phase === "intro" ? 1 : phase === "selection" ? 2 : 3;

  return (
    <div className="onboarding-flow">
      <div
        className="onboarding-progress"
        role="list"
        aria-label={`Étape ${stepNumber} sur 3`}
      >
        {[1, 2, 3].map((step) => (
          <Fragment key={step}>
            <span
              className={
                step <= stepNumber
                  ? "onboarding-progress__step is-active"
                  : "onboarding-progress__step"
              }
              role="listitem"
              aria-current={step === stepNumber ? "step" : undefined}
            >
              <span>
                {step < stepNumber ? (
                  <Check aria-hidden="true" size={15} />
                ) : (
                  step
                )}
              </span>
              {step === 1
                ? "Découverte"
                : step === 2
                  ? "Sélection"
                  : "Recrutement"}
            </span>
            {step < 3 ? (
              <ArrowRight
                className={
                  step < stepNumber
                    ? "onboarding-progress__arrow is-active"
                    : "onboarding-progress__arrow"
                }
                aria-hidden="true"
                size={25}
              />
            ) : null}
          </Fragment>
        ))}
      </div>

      {phase === "intro" ? (
        <section
          className="onboarding-intro"
          aria-labelledby="onboarding-intro-title"
        >
          <div className="onboarding-intro__lead">
            <div>
              <span className="onboarding-kicker">
                Votre aventure commence ici
              </span>
              <h2
                id="onboarding-intro-title"
                ref={phaseHeadingRef}
                tabIndex={-1}
              >
                Un partenaire, quatre façons de progresser
              </h2>
              <p>
                Recrutez votre première créature gratuitement. Elle rejoint
                immédiatement votre collection et le premier emplacement de
                votre équipe.
              </p>
              <div className="onboarding-free-note">
                <Coins aria-hidden="true" size={20} />
                <span>
                  Coût du recrutement : <strong>0 Pokédollar</strong>
                </span>
              </div>
            </div>

            <StarterShowcase catalog={catalog} />
          </div>

          <div
            className="onboarding-features"
            aria-label="Les quatre espaces du jeu"
          >
            <article className="onboarding-feature onboarding-feature--campaign">
              <BookOpen aria-hidden="true" size={22} />
              <div>
                <h3>Campagne</h3>
                <p>Explorez huit mondes et affrontez leurs dresseurs.</p>
              </div>
            </article>
            <article className="onboarding-feature onboarding-feature--training">
              <BrainCircuit aria-hidden="true" size={22} />
              <div>
                <h3>Entraînement</h3>
                <p>
                  Progressez contre trois niveaux d’intelligence artificielle.
                </p>
              </div>
            </article>
            <article className="onboarding-feature onboarding-feature--team">
              <Users aria-hidden="true" size={22} />
              <div>
                <h3>Équipe</h3>
                <p>Composez librement une équipe d’une à six créatures.</p>
              </div>
            </article>
            <article className="onboarding-feature onboarding-feature--gacha">
              <Dices aria-hidden="true" size={22} />
              <div>
                <h3>Boutique gacha</h3>
                <p>
                  Recrutez avec la monnaie gagnée en jouant, sans achat réel.
                </p>
              </div>
            </article>
          </div>

          <button
            className="onboarding-primary-button"
            type="button"
            onClick={() => setPhase("selection")}
          >
            Choisir mon premier partenaire{" "}
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </section>
      ) : null}

      {phase === "selection" ? (
        <section
          className="starter-selection"
          aria-labelledby="starter-selection-title"
        >
          <div className="starter-selection__heading">
            <h2
              id="starter-selection-title"
              ref={phaseHeadingRef}
              tabIndex={-1}
            >
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
              <button
                type="button"
                onClick={() => setCatalogAttempt((attempt) => attempt + 1)}
              >
                Réessayer
              </button>
            </div>
          ) : null}

          {catalogState === "ready" ? (
            <>
              <div className="starter-selection__workspace">
                <div className="starter-browser">
                  {/* La barre d'outils appartient à la colonne du catalogue afin
                    que la fiche détaillée commence exactement à sa hauteur. */}
                  <div className="starter-toolbar">
                    <label className="starter-search">
                      <span className="visually-hidden">
                        Rechercher une créature
                      </span>
                      <Search aria-hidden="true" size={17} />
                      <input
                        type="search"
                        value={query}
                        placeholder="Nom ou numéro du Pokédex"
                        onChange={(event) =>
                          updateFilters(() => setQuery(event.target.value))
                        }
                      />
                    </label>
                    <label className="starter-filter">
                      <span>Génération</span>
                      <select
                        value={generation}
                        onChange={(event) =>
                          updateFilters(() => setGeneration(event.target.value))
                        }
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
                        onChange={(event) =>
                          updateFilters(() =>
                            setPokemonType(event.target.value),
                          )
                        }
                      >
                        <option value="all">Tous</option>
                        {availableTypes.map((type) => (
                          <option key={type} value={type}>
                            {TYPE_LABELS[type] ?? type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="starter-result-count" aria-live="polite">
                      {filteredStarters.length} résultat
                      {filteredStarters.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {visibleStarters.length ? (
                    <div
                      className="starter-grid"
                      aria-label="Partenaires disponibles"
                    >
                      {visibleStarters.map((starter) => (
                        <button
                          key={starter.speciesId}
                          className={
                            starter.speciesId === selectedStarter?.speciesId
                              ? "starter-option is-selected"
                              : "starter-option"
                          }
                          type="button"
                          aria-pressed={
                            starter.speciesId === selectedStarter?.speciesId
                          }
                          onClick={() => selectStarter(starter)}
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
                              #{String(starter.dexNumber ?? 0).padStart(3, "0")}{" "}
                              · Gen {starter.generation}
                            </small>
                          </span>
                          <span
                            className="starter-option__types"
                            aria-label={`Types : ${starter.types.map((type) => TYPE_LABELS[type] ?? type).join(", ")}`}
                          >
                            {starter.types.map((type) => (
                              <TypeBadge key={type} type={type} />
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

                  {filteredStarters.length > PAGE_SIZE ? (
                    <nav
                      className="starter-pagination"
                      aria-label="Pagination des partenaires"
                    >
                      <button
                        type="button"
                        disabled={safePage === 0}
                        onClick={() => changePage(safePage - 1)}
                        aria-label="Page précédente"
                      >
                        <ChevronLeft aria-hidden="true" size={18} />
                      </button>
                      <span>
                        Page {safePage + 1} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= totalPages - 1}
                        onClick={() => changePage(safePage + 1)}
                        aria-label="Page suivante"
                      >
                        <ChevronRight aria-hidden="true" size={18} />
                      </button>
                    </nav>
                  ) : null}
                </div>

                <aside className="starter-detail" aria-live="polite">
                  {selectedStarter ? (
                    <>
                      <div
                        className="starter-detail__portrait"
                        onClick={() =>
                          playPokemonCry(
                            selectedStarter.speciesId,
                            selectedStarter.dexNumber,
                          )
                        }
                        style={{ cursor: "pointer" }}
                        title={`Écouter le cri de ${selectedStarter.name}`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            playPokemonCry(
                              selectedStarter.speciesId,
                              selectedStarter.dexNumber,
                            );
                          }
                        }}
                      >
                        <span>
                          #
                          {String(selectedStarter.dexNumber ?? 0).padStart(
                            3,
                            "0",
                          )}
                        </span>
                        <SpriteProvider
                          speciesId={selectedStarter.speciesId}
                          alt={selectedStarter.name}
                          width={132}
                          height={132}
                          priority
                        />
                      </div>
                      <div className="starter-detail__title">
                        <div>
                          <span>NIVEAU {selectedStarter.level}</span>
                          <h3>{selectedStarter.name}</h3>
                        </div>
                        <div className="starter-detail__types">
                          {selectedStarter.types.map((type) => (
                            <TypeBadge key={type} type={type} />
                          ))}
                        </div>
                      </div>
                      {selectedStarter.baseStats ? (
                        <div
                          className="starter-stats"
                          aria-label="Statistiques de base"
                        >
                          {STATS.map((stat) => (
                            <div className="starter-stat" key={stat.key}>
                              <span>{stat.label}</span>
                              <div>
                                <i
                                  style={{
                                    width: `${Math.min(100, selectedStarter.baseStats![stat.key] / 2.1)}%`,
                                  }}
                                />
                              </div>
                              <strong>
                                {selectedStarter.baseStats![stat.key]}
                              </strong>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="starter-moves">
                        <span>Capacités de départ</span>
                        <ul>
                          {selectedStarter.moves.map((move) => (
                            <li key={move.id}>
                              <Swords aria-hidden="true" size={12} />
                              {move.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        className="onboarding-primary-button"
                        type="button"
                        onClick={openConfirmation}
                      >
                        Choisir {selectedStarter.name}
                        <ArrowRight aria-hidden="true" size={17} />
                      </button>
                    </>
                  ) : (
                    <p className="starter-detail__empty">
                      Sélectionnez une créature pour afficher sa fiche.
                    </p>
                  )}
                </aside>
              </div>

              {/* Le retour reste sous les deux colonnes : la fiche peut ainsi
                  s'aligner exactement sur le bas de la pagination. */}
              <button
                className="onboarding-text-button starter-selection__back"
                type="button"
                onClick={() => setPhase("intro")}
              >
                <ArrowLeft aria-hidden="true" size={16} /> Retour
              </button>
            </>
          ) : null}
        </section>
      ) : null}

      {phase === "confirmation" && candidate ? (
        <section
          className="starter-confirmation"
          aria-labelledby="starter-confirmation-title"
        >
          <div className="starter-confirmation__portrait">
            <Sparkles aria-hidden="true" size={24} />
            <SpriteProvider
              speciesId={candidate.speciesId}
              alt={candidate.name}
              width={174}
              height={174}
              priority
            />
          </div>
          <div className="starter-confirmation__content">
            <span className="onboarding-kicker">Dernière vérification</span>
            <h2
              id="starter-confirmation-title"
              ref={phaseHeadingRef}
              tabIndex={-1}
            >
              Recruter {candidate.name} ?
            </h2>
            <p>
              {candidate.name} rejoindra votre collection au niveau{" "}
              {candidate.level} et prendra le premier emplacement de votre
              équipe. Ce recrutement gratuit est unique.
            </p>
            <label className="starter-nickname">
              <span>
                Surnom <small>(facultatif)</small>
              </span>
              <input
                type="text"
                value={nickname}
                maxLength={20}
                placeholder={candidate.name}
                disabled={isClaiming}
                onChange={(event) => setNickname(event.target.value)}
              />
              <small>{nickname.length}/20 caractères</small>
            </label>
            {claimError ? (
              <p className="starter-claim-error" role="alert">
                {claimError}
              </p>
            ) : null}
            <div className="starter-confirmation__actions">
              <button
                className="onboarding-secondary-button"
                type="button"
                disabled={isClaiming}
                onClick={() => setPhase("selection")}
              >
                <ArrowLeft aria-hidden="true" size={16} /> Modifier mon choix
              </button>
              <button
                className="onboarding-primary-button"
                type="button"
                disabled={isClaiming}
                onClick={() => void claimStarter()}
              >
                {isClaiming ? (
                  <LoaderCircle
                    className="starter-loading-icon"
                    aria-hidden="true"
                    size={17}
                  />
                ) : (
                  <ShieldCheck aria-hidden="true" size={17} />
                )}
                {isClaiming ? "Recrutement..." : "Confirmer le recrutement"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {phase === "success" && claimedPokemon ? (
        <section
          className="starter-success"
          aria-labelledby="starter-success-title"
          role="status"
        >
          <div className="starter-success__visual">
            <div className="starter-success__burst" aria-hidden="true">
              <Sparkles size={25} />
            </div>
            <div className="starter-success__pokemon">
              <SpriteProvider
                speciesId={claimedPokemon.speciesId}
                variant={claimedPokemon.isShiny ? "front_shiny" : "front"}
                alt={claimedPokemon.name}
                width={210}
                height={210}
                priority
              />
              {claimedPokemon.isShiny ? (
                <span>
                  <Sparkles aria-hidden="true" size={14} /> Version chromatique
                </span>
              ) : null}
            </div>
          </div>

          <div className="starter-success__content">
            <span className="onboarding-kicker">Recrutement confirmé</span>
            <h2 id="starter-success-title" ref={phaseHeadingRef} tabIndex={-1}>
              {claimedPokemon.name} rejoint votre équipe !
            </h2>
            <p>
              {claimedPokemon.name} rejoint votre collection au niveau{" "}
              {claimedPokemon.level} et occupe le premier emplacement de votre
              équipe. La première zone de la campagne est débloquée.
            </p>
            <button
              className="onboarding-primary-button"
              type="button"
              onClick={enterDashboard}
            >
              <Gamepad2 aria-hidden="true" size={18} /> Accéder à l’accueil
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
