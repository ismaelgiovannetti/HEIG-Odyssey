"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Coins,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Swords,
  UsersRound,
} from "lucide-react";
import { BattleArena } from "@/components/battle/battle-arena";
import { SpriteProvider } from "@/components/SpriteProvider";
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
  TRAINING_DIFFICULTIES,
  type TrainingDifficulty,
} from "@/lib/training/difficulty";

interface TrainingHubProps {
  playerName: string;
}

const DIFFICULTY_ORDER: readonly TrainingDifficulty[] = [
  "easy",
  "normal",
  "hard",
];

type TeamPokemon = CollectionSnapshot["pokemon"][number];

/** Carte compacte d'un membre de l'équipe persistante du joueur. */
function TeamCard({ pokemon }: { pokemon: TeamPokemon }) {
  const hpPercent = Math.round((pokemon.currentHp / pokemon.maxHp) * 100);
  return (
    <li className="training-team-card">
      <span className="training-team-card__slot">{pokemon.teamPosition}</span>
      <SpriteProvider
        speciesId={pokemon.speciesId}
        variant={pokemon.isShiny ? "front_shiny" : "front"}
        alt=""
        width={72}
        height={72}
        normalizeVisibleSize
      />
      <div className="training-team-card__info">
        <strong>{pokemon.nickname || pokemon.name}</strong>
        <span>Niveau {pokemon.level}</span>
        <small>{pokemon.types.join(" · ")}</small>
      </div>
      <div
        className="training-team-card__hp"
        role="progressbar"
        aria-label={`Points de vie de ${pokemon.nickname || pokemon.name}`}
        aria-valuemin={0}
        aria-valuemax={pokemon.maxHp}
        aria-valuenow={pokemon.currentHp}
      >
        <span style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }} />
      </div>
      <small className={pokemon.currentHp === 0 ? "is-fainted" : undefined}>
        {pokemon.currentHp}/{pokemon.maxHp} PV
      </small>
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
export function TrainingHub({ playerName }: Readonly<TrainingHubProps>) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CollectionSnapshot | null>(null);
  const [teamPending, setTeamPending] = useState(true);
  const [teamError, setTeamError] = useState("");
  const [difficulty, setDifficulty] =
    useState<TrainingDifficulty>("normal");
  const [preparedBattle, setPreparedBattle] =
    useState<BattleStartPayload | null>(null);
  const [battleStarted, setBattleStarted] = useState(false);
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
  const canPrepare =
    activeTeam.length > 0 && activeTeam.some((pokemon) => pokemon.currentHp > 0);
  const averageLevel = activeTeam.length
    ? Math.round(
        activeTeam.reduce((sum, pokemon) => sum + pokemon.level, 0) /
          activeTeam.length,
      )
    : 0;

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
    setBattleStarted(false);
    setPreparedBattle(null);
    setPrepareError("");
    // Les PV, niveaux et le solde peuvent avoir changé après le combat.
    void loadTeam();
    router.refresh();
  }

  if (preparedBattle && battleStarted) {
    return (
      <BattleArena
        key={preparedBattle.battleId}
        initialBattle={preparedBattle}
        mode="training"
        onReturn={returnToTraining}
      />
    );
  }

  if (preparedBattle) {
    const details = TRAINING_DIFFICULTIES[difficulty];
    const rewards = calculateTrainingReward(difficulty);
    const opponentTeam = preparedBattle.state.p2.team;
    return (
      <section className="training-preview" aria-labelledby="training-preview-title">
        <header className="training-preview__header">
          <div>
            <p className="application-eyebrow">Adversaire généré</p>
            <h1 id="training-preview-title">Simulation prête</h1>
            <p>
              Vérifiez la confrontation avant d’entrer dans l’arène. La
              difficulté est maintenant transmise au serveur.
            </p>
          </div>
          <span className="training-preview__difficulty" data-difficulty={difficulty}>
            <BrainCircuit aria-hidden="true" size={22} />
            {details.label}
          </span>
        </header>

        <div className="training-preview__versus">
          <section aria-labelledby="player-preview-title">
            <span>Équipe active</span>
            <h2 id="player-preview-title">{playerName}</h2>
            <ul>
              {activeTeam.map((pokemon) => (
                <TeamCard key={pokemon.id} pokemon={pokemon} />
              ))}
            </ul>
          </section>
          <div className="training-preview__versus-mark" aria-hidden="true">
            VS
          </div>
          <section aria-labelledby="opponent-preview-title">
            <span>Adversaire adapté</span>
            <h2 id="opponent-preview-title">{preparedBattle.trainer.name}</h2>
            <ul>
              {opponentTeam.map((pokemon) => (
                <li className="training-team-card" key={pokemon.id}>
                  <SpriteProvider
                    speciesId={pokemon.speciesId}
                    variant={pokemon.isShiny ? "front_shiny" : "front"}
                    alt=""
                    width={72}
                    height={72}
                    normalizeVisibleSize
                  />
                  <div className="training-team-card__info">
                    <strong>{pokemon.name}</strong>
                    <span>Niveau {pokemon.level}</span>
                    <small>{pokemon.types.join(" · ")}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="training-preview__footer">
          <div>
            <span>Gains en cas de victoire</span>
            <strong>
              <Coins aria-hidden="true" size={17} /> {rewards.money} ₽
              <Sparkles aria-hidden="true" size={17} /> {rewards.xp} XP
            </strong>
          </div>
          <button
            type="button"
            className="battle-primary-button"
            onClick={() => setBattleStarted(true)}
          >
            Entrer dans l’arène <ArrowRight aria-hidden="true" size={18} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="training-hub" aria-labelledby="training-title">
      <header className="training-hub__hero">
        <div>
          <p className="application-eyebrow">
            <BrainCircuit aria-hidden="true" size={16} /> Simulation tactique
          </p>
          <h1 id="training-title">Centre d’entraînement</h1>
          <p>
            Préparez votre équipe, choisissez le comportement adverse puis
            affrontez une composition adaptée à votre niveau moyen.
          </p>
        </div>
        <div className="training-hub__summary">
          <UsersRound aria-hidden="true" size={26} />
          <span>Équipe active</span>
          <strong>{activeTeam.length}/6</strong>
          <small>{averageLevel ? `Niveau moyen ${averageLevel}` : "Non chargée"}</small>
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
        <>
          <section className="training-section" aria-labelledby="training-team-title">
            <div className="training-section__heading">
              <div>
                <span>Étape 1</span>
                <h2 id="training-team-title">Votre équipe en lice</h2>
              </div>
              <Link href="/team">
                Gérer l’équipe <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
            {activeTeam.length > 0 ? (
              <ul className="training-team-list">
                {activeTeam.map((pokemon) => (
                  <TeamCard key={pokemon.id} pokemon={pokemon} />
                ))}
              </ul>
            ) : (
              <div className="training-empty-team">
                <UsersRound aria-hidden="true" size={28} />
                <strong>Aucune équipe active</strong>
                <span>Ajoutez au moins un Pokémon apte avant de continuer.</span>
              </div>
            )}
          </section>

          <fieldset className="training-section training-difficulties">
            <legend>
              <span>Étape 2</span>
              Choisissez la difficulté
            </legend>
            <div className="training-difficulty-grid">
              {DIFFICULTY_ORDER.map((value) => {
                const details = TRAINING_DIFFICULTIES[value];
                const reward = calculateTrainingReward(value);
                const selected = difficulty === value;
                return (
                  <label key={value} data-difficulty={value} className={selected ? "is-selected" : undefined}>
                    <input
                      type="radio"
                      name="training-difficulty"
                      value={value}
                      checked={selected}
                      onChange={() => setDifficulty(value)}
                    />
                    <span className="training-difficulty-card__marker" aria-hidden="true" />
                    <strong>{details.label}</strong>
                    <span>{details.shortDescription}</span>
                    <small>{details.behavior}</small>
                    <span className="training-difficulty-card__reward">
                      <Coins aria-hidden="true" size={15} /> {reward.money} ₽
                      <Sparkles aria-hidden="true" size={15} /> {reward.xp} XP
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
            <p className="training-feedback is-error">
              Votre équipe ne contient aucun Pokémon apte au combat.
            </p>
          )}

          <div className="training-hub__actions">
            <Link className="battle-quiet-button" href="/dashboard">
              <ArrowLeft aria-hidden="true" size={16} /> Retour à l’accueil
            </Link>
            <button
              type="button"
              className="battle-primary-button"
              disabled={!canPrepare || preparing}
              onClick={() => void prepareOpponent()}
            >
              {preparing ? (
                <>
                  <RefreshCw aria-hidden="true" size={18} /> Génération…
                </>
              ) : (
                <>
                  <Swords aria-hidden="true" size={18} /> Générer l’adversaire
                </>
              )}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
