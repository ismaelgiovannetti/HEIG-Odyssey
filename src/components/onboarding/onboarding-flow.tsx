"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { OnboardingIntroPhase } from "@/components/onboarding/onboarding-intro-phase";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { StarterConfirmationPhase } from "@/components/onboarding/starter-confirmation-phase";
import {
  StarterSelectionPhase,
  type StarterCatalogState,
} from "@/components/onboarding/starter-selection-phase";
import { StarterSuccessPhase } from "@/components/onboarding/starter-success-phase";
import { playPokemonCry } from "@/lib/audio/pokemon-cry";
import {
  ApiFailureSchema,
  StarterClaimResultSchema,
  parseStarterCatalog,
  type StarterClaimResult,
  type StarterView,
} from "@/lib/starter/starter-contract";

export type { StarterView } from "@/lib/starter/starter-contract";

type Phase = "intro" | "selection" | "confirmation" | "success";

const PAGE_SIZE = 12;

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Parcours interactif du premier lancement. L'API ne reçoit jamais
 * d'identifiant utilisateur : le propriétaire du starter est déterminé
 * exclusivement par la session Better Auth côté serveur.
 */
export function OnboardingFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [catalogState, setCatalogState] =
    useState<StarterCatalogState>("loading");
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
  const [claimedPokemon, setClaimedPokemon] = useState<
    StarterClaimResult["pokemon"] | null
  >(null);
  const phaseHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousPhaseRef = useRef<Phase>(phase);

  useEffect(() => {
    if (previousPhaseRef.current !== phase) {
      phaseHeadingRef.current?.focus();
    }

    previousPhaseRef.current = phase;
  }, [phase]);

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

        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error("STARTER_CATALOG_UNAVAILABLE");

        const starters = parseStarterCatalog(body);
        if (!starters) {
          throw new Error("STARTER_CATALOG_INVALID");
        }

        setCatalog(starters);
        setSelectedSpeciesId(starters[0].speciesId);
        setCatalogState("ready");
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          setCatalogState("error");
        }
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
        pokemonType === "all" ||
        starter.types.some((type) => type === pokemonType);

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
    update();
    setPage(0);
    setSelectedSpeciesId(null);
  }

  function changePage(nextPage: number) {
    const boundedPage = Math.max(0, Math.min(totalPages - 1, nextPage));
    const firstStarterOnPage = filteredStarters[boundedPage * PAGE_SIZE];

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
      const body: unknown = await response.json().catch(() => null);
      const result = StarterClaimResultSchema.safeParse(body);

      if (response.status === 401) {
        router.replace("/login?sessionExpired=1");
        return;
      }

      if (!response.ok || !result.success) {
        const failure = ApiFailureSchema.safeParse(body);
        setClaimError(
          response.status === 409
            ? "Ce recrutement a déjà été utilisé. Actualisez la page pour continuer."
            : failure.success && failure.data.error
              ? failure.data.error
              : "Le recrutement n'a pas pu être finalisé. Réessayez dans un instant.",
        );
        return;
      }

      setClaimedPokemon(result.data.pokemon);
      setPhase("success");
      router.prefetch("/dashboard");
    } catch {
      setClaimError(
        "Le recrutement est momentanément indisponible. Réessayez.",
      );
    } finally {
      setIsClaiming(false);
    }
  }

  function enterDashboard() {
    router.replace("/dashboard");
    router.refresh();
  }

  const stepNumber: 1 | 2 | 3 =
    phase === "intro" ? 1 : phase === "selection" ? 2 : 3;

  return (
    <div className="onboarding-flow">
      <OnboardingProgress currentStep={stepNumber} />

      {phase === "intro" ? (
        <OnboardingIntroPhase
          catalog={catalog}
          headingRef={phaseHeadingRef}
          onContinue={() => setPhase("selection")}
        />
      ) : null}

      {phase === "selection" ? (
        <StarterSelectionPhase
          availableTypes={availableTypes}
          catalogState={catalogState}
          filteredCount={filteredStarters.length}
          generation={generation}
          headingRef={phaseHeadingRef}
          page={safePage}
          pokemonType={pokemonType}
          query={query}
          selectedStarter={selectedStarter}
          totalPages={totalPages}
          visibleStarters={visibleStarters}
          onBack={() => setPhase("intro")}
          onChooseStarter={openConfirmation}
          onGenerationChange={(nextGeneration) =>
            updateFilters(() => setGeneration(nextGeneration))
          }
          onPageChange={changePage}
          onPlayCry={(starter) =>
            playPokemonCry(starter.speciesId, starter.dexNumber)
          }
          onQueryChange={(nextQuery) =>
            updateFilters(() => setQuery(nextQuery))
          }
          onRetry={() => setCatalogAttempt((attempt) => attempt + 1)}
          onSelectStarter={selectStarter}
          onTypeChange={(nextType) =>
            updateFilters(() => setPokemonType(nextType))
          }
        />
      ) : null}

      {phase === "confirmation" && candidate ? (
        <StarterConfirmationPhase
          candidate={candidate}
          claimError={claimError}
          headingRef={phaseHeadingRef}
          isClaiming={isClaiming}
          nickname={nickname}
          onBack={() => setPhase("selection")}
          onConfirm={claimStarter}
          onNicknameChange={setNickname}
        />
      ) : null}

      {phase === "success" && claimedPokemon ? (
        <StarterSuccessPhase
          headingRef={phaseHeadingRef}
          pokemon={claimedPokemon}
          onEnterDashboard={enterDashboard}
        />
      ) : null}
    </div>
  );
}
