"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Coins,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UsersRound,
} from "lucide-react";
import { SpriteProvider } from "@/components/SpriteProvider";
import { SoundtrackPlayer, type SoundtrackPhase } from "@/components/audio/soundtrack-player";
import { BattleCatchlines } from "@/components/combat/battle-catchlines";
import {
  BattleRequestError,
  BattleStateConflictError,
  readBattleActionResponse,
  type BattlePokemonPayload,
  type BattleRewardPayload,
  type BattleStartPayload,
  type BattleStatePayload,
} from "@/lib/combat/battle-client";
import { publishPlayerBalance } from "@/lib/player/player-balance-events";
import { formatGameInteger } from "@/lib/format-number";

type BattleMode = "campaign" | "training";
type PlayerAction =
  | { type: "move"; moveIndex: number }
  | { type: "switch"; targetPokemonIndex: number };

interface BattleArenaProps {
  initialBattle: BattleStartPayload;
  mode: BattleMode;
  onReturn: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  brn: "Brûlure",
  par: "Paralysie",
  slp: "Sommeil",
  psn: "Poison",
  tox: "Poison grave",
  frz: "Gel",
};

/** Retrouve le combattant visible tout en conservant un repli sûr. */
function activePokemon(side: BattleStatePayload["p1"]): BattlePokemonPayload {
  return (
    side.team.find((pokemon) => pokemon.isActive) ??
    side.team[side.activePokemonIndex] ??
    side.team[0]
  );
}

/** Associe le pourcentage de PV à la couleur de sa jauge. */
function hpTone(percent: number) {
  if (percent <= 20) return "critical";
  if (percent <= 50) return "warning";
  return "healthy";
}

/** Résumé accessible des PV, types et altérations d'un combattant. */
function PokemonStatus({ pokemon }: { pokemon: BattlePokemonPayload }) {
  return (
    <div className="battle-pokemon-status">
      <div className="battle-pokemon-status__heading">
        <strong>{pokemon.nickname || pokemon.name}</strong>
        <span>Niv. {pokemon.level}</span>
      </div>
      <div className="battle-pokemon-status__meta">
        <span>PV</span>
        <strong>
          {pokemon.currentHp}/{pokemon.maxHp}
        </strong>
      </div>
      <div
        className="battle-hp"
        role="progressbar"
        aria-label={`Points de vie de ${pokemon.nickname || pokemon.name}`}
        aria-valuemin={0}
        aria-valuemax={pokemon.maxHp}
        aria-valuenow={pokemon.currentHp}
      >
        <span
          data-tone={hpTone(pokemon.hpPercent)}
          style={{ width: `${pokemon.hpPercent}%` }}
        />
      </div>
      <div className="battle-pokemon-status__footer">
        <span>{pokemon.types.join(" · ")}</span>
        {pokemon.status && (
          <strong>{STATUS_LABELS[pokemon.status] ?? pokemon.status}</strong>
        )}
      </div>
    </div>
  );
}

/** Présente uniquement les gains persistés renvoyés avec le dernier tour. */
function BattleResult({
  state,
  rewards,
  trainer,
  mode,
  onReturn,
}: {
  state: BattleStatePayload;
  rewards?: BattleRewardPayload;
  trainer: BattleStartPayload["trainer"];
  mode: BattleMode;
  onReturn: () => void;
}) {
  const won = state.winner === "p1";
  const title = won
    ? "Victoire confirmée !"
    : mode === "training"
      ? "Entraînement terminé"
      : "Combat terminé";
  const resultPhase = won ? "victory" : "defeat";

  return (
    <section
      className={`battle-result ${won ? "is-victory" : "is-defeat"}`}
      aria-labelledby="battle-result-title"
      tabIndex={-1}
    >
      <div className="battle-result__summary">
        <span className="battle-result__icon" aria-hidden="true">
          {won ? <Trophy size={42} /> : <ShieldCheck size={42} />}
        </span>
        <p className="application-eyebrow">
          {won ? "Combat remporté" : "Défaite enregistrée"}
        </p>
        <h1 id="battle-result-title">{title}</h1>
        <BattleCatchlines
          trainerName={trainer.name}
          trainerTitle={trainer.title}
          trainerSprite={trainer.sprite}
          introCatchline={trainer.introCatchline || "Le combat commence."}
          victoryCatchline={trainer.victoryCatchline || `${trainer.name} remporte cette confrontation.`}
          defeatCatchline={trainer.defeatCatchline || `${trainer.name} reconnaît votre victoire.`}
          currentPhase={resultPhase}
        />
      </div>

      <div className="battle-result__rewards">
        <p className="application-eyebrow">Résultat persistant</p>
        <h2>{won ? "Gains appliqués" : "Aucun gain attribué"}</h2>
        {rewards ? (
          <>
            <dl>
              <div>
                <dt>Pokédollars</dt>
                <dd>
                  <Coins aria-hidden="true" size={18} /> +{rewards.moneyEarned} ₽
                </dd>
              </div>
              <div>
                <dt>Expérience</dt>
                <dd>
                  <Sparkles aria-hidden="true" size={18} /> +{rewards.xpEarned} XP
                </dd>
              </div>
              <div>
                <dt>Nouveau solde</dt>
                <dd>{formatGameInteger(rewards.newBalance)} ₽</dd>
              </div>
            </dl>
            {rewards.teamLeveledUp.length > 0 && (
              <div className="battle-result__levels">
                <strong>
                  <Sparkles aria-hidden="true" size={16} />
                  Montée de niveau
                </strong>
                <ul>
                  {rewards.teamLeveledUp.map((pokemon) => (
                    <li key={pokemon.pokemonId}>
                      {pokemon.name} : niv. {pokemon.oldLevel} → {pokemon.newLevel}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="battle-result__missing">
            Le résultat est terminé, mais le récapitulatif des gains n’est pas
            disponible. Revenez à l’espace précédent pour actualiser vos données.
          </p>
        )}
        <button className="battle-primary-button" type="button" onClick={onReturn}>
          <ArrowLeft aria-hidden="true" size={18} />
          Retour {mode === "training" ? "à l’entraînement" : "à la campagne"}
        </button>
      </div>
    </section>
  );
}

/**
 * Interface commune aux combats de campagne et d'entraînement. Le navigateur
 * choisit uniquement une action ; le serveur conserve l'état et décide l'IA.
 */
export function BattleArena({
  initialBattle,
  mode,
  onReturn,
}: Readonly<BattleArenaProps>) {
  const [state, setState] = useState(initialBattle.state);
  const [events, setEvents] = useState<string[]>(
    initialBattle.state.logs.slice(-4),
  );
  const [rewards, setRewards] = useState<BattleRewardPayload>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showTeam, setShowTeam] = useState(false);
  const requestLock = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const player = activePokemon(state.p1);
  const opponent = activePokemon(state.p2);
  const finished = state.phase === "finished";
  const switchRequired = state.phase === "switch_required";
  const soundtrackPhase: SoundtrackPhase = finished
    ? state.winner === "p1"
      ? "victory"
      : "defeat"
    : state.turn === 0
      ? "intro"
      : "turn";
  const soundtrack = (
    <SoundtrackPlayer
      trackId={initialBattle.trainer.musicTrack || "battle-theme-1"}
      phase={soundtrackPhase}
      className="battle-soundtrack"
    />
  );

  useEffect(() => {
    if (finished) resultRef.current?.focus();
  }, [finished]);

  useEffect(
    () => () => {
      requestController.current?.abort();
      requestLock.current = false;
    },
    [],
  );

  async function submitAction(action: PlayerAction) {
    if (requestLock.current || finished) return;
    requestLock.current = true;
    setPending(true);
    setError("");
    const controller = new AbortController();
    requestController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch("/api/battle/action", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          battleId: initialBattle.battleId,
          expectedTurn: state.turn,
          expectedPhase: state.phase,
          action,
        }),
      });
      const next = await readBattleActionResponse(response);
      setState(next.state);
      setEvents(
        next.events.map((event) => event.message).filter(Boolean).slice(-5),
      );
      setRewards(next.rewards);
      if (next.rewards) {
        publishPlayerBalance(next.rewards.newBalance);
      }
      setShowTeam(next.state.phase === "switch_required");
      // Le verrou est libéré au prochain cycle seulement, après que React a
      // remplacé les commandes associées à l'ancien état.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    } catch (cause) {
      if (cause instanceof BattleStateConflictError) {
        setState(cause.state);
        setEvents(cause.state.logs.slice(-5));
        setShowTeam(cause.state.phase === "switch_required");
        setError(cause.message);
        // Une réponse 409 est exploitable : l'état courant renvoyé par le
        // serveur remplace l'état obsolète avant de réactiver les boutons.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      } else {
        setError(
          cause instanceof BattleRequestError
            ? cause.message
            : "La communication avec l’arène a été interrompue. Réessayez.",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      requestController.current = null;
      requestLock.current = false;
      setPending(false);
    }
  }

  if (finished) {
    return (
      <>
        {soundtrack}
        <div ref={resultRef} tabIndex={-1} aria-live="polite">
          <BattleResult
            state={state}
            rewards={rewards}
            trainer={initialBattle.trainer}
            mode={mode}
            onReturn={onReturn}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {soundtrack}
      <section className="battle-interface" aria-labelledby="battle-title">
      <header className="battle-interface__header">
        <div>
          <p className="application-eyebrow">
            {mode === "training" ? "Simulation tactique" : "Combat de campagne"}
          </p>
          <h1 id="battle-title">{initialBattle.trainer.name}</h1>
          <p>{initialBattle.trainer.title || "Dresseur adverse"}</p>
        </div>
        <div className="battle-interface__turn" aria-label={`Tour ${state.turn}`}>
          <Swords aria-hidden="true" size={20} />
          <span>Tour</span>
          <strong>{state.turn}</strong>
        </div>
      </header>

      <BattleCatchlines
        trainerName={initialBattle.trainer.name}
        trainerTitle={initialBattle.trainer.title}
        trainerSprite={initialBattle.trainer.sprite}
        introCatchline={initialBattle.trainer.introCatchline || "Le combat commence."}
        victoryCatchline={initialBattle.trainer.victoryCatchline || `${initialBattle.trainer.name} remporte cette confrontation.`}
        defeatCatchline={initialBattle.trainer.defeatCatchline || `${initialBattle.trainer.name} reconnaît votre victoire.`}
        currentPhase={soundtrackPhase}
      />

      <div className="battle-interface__body">
        <div className="battle-scene" aria-label="Arène de combat">
          <div className="battle-combatant battle-combatant--opponent">
            <PokemonStatus pokemon={opponent} />
            <div className="battle-combatant__sprite">
              <SpriteProvider
                speciesId={opponent.speciesId}
                variant={opponent.isShiny ? "front_shiny" : "front"}
                alt={opponent.nickname || opponent.name}
                width={176}
                height={176}
                normalizeVisibleSize
                priority
              />
            </div>
          </div>

          <div className="battle-combatant battle-combatant--player">
            <div className="battle-combatant__sprite">
              <SpriteProvider
                speciesId={player.speciesId}
                variant={player.isShiny ? "back_shiny" : "back"}
                alt={player.nickname || player.name}
                width={190}
                height={190}
                normalizeVisibleSize
                priority
              />
            </div>
            <PokemonStatus pokemon={player} />
          </div>
        </div>

        <aside className="battle-command" aria-label="Commandes de combat">
          <div className="battle-log" aria-live="polite" aria-atomic="true">
            <strong>Journal du combat</strong>
            <p>
              {events.at(-1) ||
                initialBattle.trainer.introCatchline ||
                "Le combat commence."}
            </p>
          </div>

          {error && (
            <p className="battle-feedback is-error" role="alert">
              {error}
            </p>
          )}
          {pending && (
            <p className="battle-feedback" role="status">
              <RefreshCw aria-hidden="true" size={16} /> Résolution du tour…
            </p>
          )}

          <div className="battle-command__heading">
            <div>
              <span>{switchRequired ? "Remplacement requis" : "À vous de jouer"}</span>
              <strong>
                {switchRequired
                  ? "Choisissez un Pokémon apte"
                  : `Que doit faire ${player.nickname || player.name} ?`}
              </strong>
            </div>
            <span>
              {state.p1.team.filter((pokemon) => !pokemon.isFainted).length}/
              {state.p1.team.length} disponibles
            </span>
          </div>

          {!showTeam && !switchRequired ? (
            <div className="battle-moves">
              {player.moves.map((move, index) => (
                <button
                  key={`${move.id}-${index}`}
                  type="button"
                  data-type={move.type}
                  disabled={pending || move.disabled || move.pp === 0}
                  onClick={() => void submitAction({ type: "move", moveIndex: index })}
                >
                  <strong>{move.name}</strong>
                  <span>
                    {move.type} · {move.pp}/{move.maxPp} PP
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="battle-switches">
              {state.p1.team.map((pokemon, index) => (
                <button
                  key={pokemon.id}
                  type="button"
                  disabled={pending || pokemon.isActive || pokemon.isFainted}
                  onClick={() =>
                    void submitAction({ type: "switch", targetPokemonIndex: index })
                  }
                >
                  <SpriteProvider
                    speciesId={pokemon.speciesId}
                    variant={pokemon.isShiny ? "front_shiny" : "front"}
                    alt=""
                    width={42}
                    height={42}
                  />
                  <span>
                    <strong>{pokemon.nickname || pokemon.name}</strong>
                    <small>
                      {pokemon.isFainted
                        ? "K.O."
                        : pokemon.isActive
                          ? "Au combat"
                          : `${pokemon.currentHp}/${pokemon.maxHp} PV`}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="battle-command__actions">
            {!switchRequired && (
              <button
                type="button"
                className="battle-secondary-button"
                disabled={pending || state.p1.team.length < 2}
                aria-expanded={showTeam}
                onClick={() => setShowTeam((visible) => !visible)}
              >
                <UsersRound aria-hidden="true" size={17} />
                {showTeam ? "Voir les attaques" : "Changer de Pokémon"}
              </button>
            )}
            <button
              type="button"
              className="battle-quiet-button"
              disabled={pending}
              onClick={onReturn}
            >
              <ArrowLeft aria-hidden="true" size={16} /> Quitter le combat
            </button>
          </div>
        </aside>
      </div>
      </section>
    </>
  );
}
