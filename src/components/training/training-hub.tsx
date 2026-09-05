"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  RefreshCw,
  ShieldCheck,
  Swords,
  UsersRound,
} from "lucide-react";
import { BattleArena } from "@/components/battle/battle-arena";
import { MenuSoundtrack } from "@/components/audio/menu-soundtrack";
import { MENU_TRACKS } from "@/lib/audio/soundtrack-tracks";
import { PokemonSprite, PokemonTypes } from "@/components/team/pokemon-summary";
import {
  BattleRequestError,
  readBattleStartResponse,
  type BattleStartPayload,
} from "@/lib/combat/battle-client";
import {
  readTeamResponse,
  TeamRequestError,
  type CollectionSnapshot,
} from "@/lib/team/team-client";
import {
  calculateTrainingReward,
  DIFFICULTY_REWARD_MULTIPLIERS,
  TRAINING_DIFFICULTIES,
  type TrainingDifficulty,
} from "@/lib/training/difficulty";
import { calculateTrainingOpponentLevel } from "@/lib/training/level-algorithm";

const DIFFICULTY_ORDER: readonly TrainingDifficulty[] = [
  "easy",
  "normal",
  "hard",
];

type TeamPokemon = CollectionSnapshot["pokemon"][number];

/** Reprise en lecture seule d'une case de l'équipe, sans action de gestion. */
function TeamCard({ pokemon, slot }: { pokemon?: TeamPokemon; slot: number }) {
  if (!pokemon) {
    return (
      <li className="training-team-card is-empty">
        <span className="training-team-card__slot" aria-hidden="true">
          {String(slot).padStart(2, "0")}
        </span>
        <span className="training-team-card__empty">Emplacement libre</span>
      </li>
    );
  }

  const hpPercent = Math.round((pokemon.currentHp / pokemon.maxHp) * 100);
  return (
    <li className="training-team-card">
      <span className="training-team-card__slot" aria-hidden="true">
        {String(slot).padStart(2, "0")}
      </span>
      <span className="training-team-card__sprite" aria-hidden="true">
        <PokemonSprite pokemon={pokemon} size={80} normalizeVisibleSize />
      </span>
      <div className="training-team-card__info">
        <span className="training-team-card__name-line">
          <strong>{pokemon.nickname || pokemon.name}</strong>
          <span>Niv. {pokemon.level}</span>
        </span>
        <PokemonTypes types={pokemon.types} />
        <span className="training-team-card__hp-line">
          <span
            className="training-team-card__hp"
            role="progressbar"
            aria-label={`Points de vie de ${pokemon.nickname || pokemon.name}`}
            aria-valuemin={0}
            aria-valuemax={pokemon.maxHp}
            aria-valuenow={pokemon.currentHp}
          >
            <span
              style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }}
            />
          </span>
          <span className={pokemon.currentHp === 0 ? "is-fainted" : undefined}>
            {pokemon.currentHp === 0
              ? "K.O."
              : `${pokemon.currentHp}/${pokemon.maxHp} PV`}
          </span>
        </span>
      </div>
    </li>
  );
}

/** État d'attente commun aux lectures d'équipe et à la génération adverse. */
function TrainingLoading({ label }: { label: string }) {
  return (
    <div className="training-state-card" role="status">
      <RefreshCw aria-hidden="true" size={30} />
      <strong>{label}</strong>
      <span>La requête est limitée dans le temps et peut être relancée.</span>
    </div>
  );
}

/**
 * Orchestre uniquement les états d'interface. L'identité, l'équipe légale,
 * l'adversaire et les récompenses restent déterminés par les API du serveur.
 */
export function TrainingHub() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CollectionSnapshot | null>(null);
  const [teamPending, setTeamPending] = useState(true);
  const [teamError, setTeamError] = useState("");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>("normal");
  const [preparedBattle, setPreparedBattle] =
    useState<BattleStartPayload | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");
  const teamSequence = useRef(0);
  const teamController = useRef<AbortController | null>(null);
  const prepareController = useRef<AbortController | null>(null);
  const prepareLock = useRef(false);

  const loadTeam = useCallback(async () => {
    const requestId = ++teamSequence.current;
    teamController.current?.abort();
    const controller = new AbortController();
    teamController.current = controller;
    setTeamPending(true);
    setTeamError("");
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/team", {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      const next = await readTeamResponse(response);
      if (requestId === teamSequence.current) setSnapshot(next);
    } catch (cause) {
      if (requestId !== teamSequence.current) return;
      setTeamError(
        cause instanceof TeamRequestError
          ? cause.message
          : "Impossible de charger votre équipe. Vérifiez la connexion puis réessayez.",
      );
    } finally {
      window.clearTimeout(timeout);
      if (requestId === teamSequence.current) {
        teamController.current = null;
        setTeamPending(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadTeam();
    return () => {
      teamSequence.current += 1;
      teamController.current?.abort();
      prepareController.current?.abort();
      prepareLock.current = false;
    };
  }, [loadTeam]);

  const activeTeam = (snapshot?.pokemon ?? [])
    .filter((pokemon) => pokemon.teamPosition !== null)
    .sort((a, b) => (a.teamPosition ?? 0) - (b.teamPosition ?? 0));
  const teamSlots = Array.from({ length: 6 }, (_, index) => ({
    slot: index + 1,
    pokemon: activeTeam.find((pokemon) => pokemon.teamPosition === index + 1),
  }));
  const canPrepare =
    activeTeam.length > 0 &&
    activeTeam.some((pokemon) => pokemon.currentHp > 0);

  async function prepareOpponent() {
    if (!canPrepare || prepareLock.current) return;
    prepareLock.current = true;
    setPreparing(true);
    setPrepareError("");
    const controller = new AbortController();
    prepareController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      // Le corps ne contient ni userId ni équipe : le serveur relit la session
      // et la composition persistante avant de créer l'adversaire.
      const response = await fetch("/api/battle/start", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "training", difficulty }),
      });
      setPreparedBattle(await readBattleStartResponse(response));
    } catch (cause) {
      setPrepareError(
        cause instanceof BattleRequestError
          ? cause.message
          : "La génération de l’adversaire a été interrompue. Réessayez.",
      );
    } finally {
      window.clearTimeout(timeout);
      prepareController.current = null;
      prepareLock.current = false;
      setPreparing(false);
    }
  }

  function returnToTraining() {
    setPreparedBattle(null);
    setPrepareError("");
    // Les PV, niveaux et le solde peuvent avoir changé après le combat.
    void loadTeam();
    router.refresh();
  }

  if (preparedBattle) {
    return (
      <BattleArena
        key={preparedBattle.battleId}
        initialBattle={preparedBattle}
        mode="training"
        onReturn={returnToTraining}
      />
    );
  }

  return (
    <section className="training-hub" aria-labelledby="training-title">
      <MenuSoundtrack trackId={MENU_TRACKS.training} />
      <header className="training-hub__hero">
        <p className="application-eyebrow">
          <BrainCircuit aria-hidden="true" size={16} /> Simulation tactique
        </p>
        <div className="training-hub__heading-line">
          <h1 id="training-title">Centre d’entraînement</h1>
          <p>Choisissez la difficulté et lancez l’entraînement.</p>
        </div>
      </header>

      {teamPending ? (
        <TrainingLoading label="Chargement de l’équipe active…" />
      ) : teamError ? (
        <div className="training-state-card is-error" role="alert">
          <ShieldCheck aria-hidden="true" size={30} />
          <strong>Équipe indisponible</strong>
          <span>{teamError}</span>
          <button type="button" onClick={() => void loadTeam()}>
            <RefreshCw aria-hidden="true" size={16} /> Réessayer
          </button>
        </div>
      ) : (
        <div className="training-hub__workspace">
          <section
            className="training-section training-team-section"
            aria-labelledby="training-team-title"
          >
            <div className="training-section__heading">
              <div>
                <span>Équipe active</span>
                <h2 id="training-team-title">Votre équipe en lice</h2>
              </div>
              <Link href="/team">
                Gérer l’équipe <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
            {activeTeam.length > 0 ? (
              <ul className="training-team-list">
                {teamSlots.map(({ pokemon, slot }) => (
                  <TeamCard
                    key={pokemon?.id ?? `empty-${slot}`}
                    pokemon={pokemon}
                    slot={slot}
                  />
                ))}
              </ul>
            ) : (
              <div className="training-empty-team">
                <UsersRound aria-hidden="true" size={28} />
                <strong>Aucune équipe active</strong>
                <span>
                  Ajoutez au moins un Pokémon apte avant de continuer.
                </span>
              </div>
            )}
          </section>

          <section
            className="training-control-panel"
            aria-labelledby="training-difficulty-title"
          >
            <fieldset className="training-section training-difficulties">
              <legend className="visually-hidden">
                Choisissez la difficulté
              </legend>
              <div className="training-section__heading">
                <div>
                  <span>Configuration du combat</span>
                  <h2 id="training-difficulty-title">
                    Choisissez la difficulté
                  </h2>
                </div>
              </div>
              <div className="training-difficulty-grid">
                {DIFFICULTY_ORDER.map((value) => {
                  const details = TRAINING_DIFFICULTIES[value];
                  const multiplier = DIFFICULTY_REWARD_MULTIPLIERS[value];
                  const teamAvgLevel =
                    activeTeam.length > 0
                      ? calculateTrainingOpponentLevel(
                          activeTeam.map((p) => p.level),
                        ).opponentLevel
                      : 5;
                  const reward = calculateTrainingReward(value, {
                    opponentAverageLevel: teamAvgLevel,
                    teamSize: Math.max(1, activeTeam.length),
                  });
                  const selected = difficulty === value;
                  return (
                    <label
                      key={value}
                      data-difficulty={value}
                      className={selected ? "is-selected" : undefined}
                    >
                      <input
                        type="radio"
                        name="training-difficulty"
                        value={value}
                        checked={selected}
                        onChange={() => setDifficulty(value)}
                      />
                      <span
                        className="training-difficulty-card__marker"
                        aria-hidden="true"
                      />
                      <strong>{details.label}</strong>
                      <span>{details.shortDescription}</span>
                      <small>{details.behavior}</small>
                      <span className="training-difficulty-card__reward">
                        <span>{reward.money} ₽</span>
                        <span
                          title={`Gain estimé : ~${reward.xp} XP (multiplicateur ×${multiplier.xp})`}
                        >
                          ×{multiplier.xp} XP
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {prepareError && (
              <p className="training-feedback is-error" role="alert">
                {prepareError}
              </p>
            )}
            {!canPrepare && activeTeam.length > 0 && (
              <p className="training-feedback is-error" role="alert">
                Votre équipe ne contient aucun Pokémon apte au combat.
              </p>
            )}

            <div className="training-hub__actions">
              <button
                type="button"
                className="battle-primary-button"
                disabled={!canPrepare || preparing}
                onClick={() => void prepareOpponent()}
              >
                {preparing ? (
                  <>
                    <RefreshCw aria-hidden="true" size={18} /> Préparation du
                    combat…
                  </>
                ) : (
                  <>
                    <Swords aria-hidden="true" size={18} /> Générer l’adversaire
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
