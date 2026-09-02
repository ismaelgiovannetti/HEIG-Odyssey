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
import { playBattleSfx } from "@/lib/audio/battle-sfx";

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

interface HpOverride {
  currentHp: number;
  maxHp: number;
  hpPercent: number;
}

/** Résumé accessible des PV, types et altérations d'un combattant. */
function PokemonStatus({
  pokemon,
  hpOverride,
}: {
  pokemon: BattlePokemonPayload;
  hpOverride?: HpOverride | null;
}) {
  const currentHp = hpOverride ? hpOverride.currentHp : pokemon.currentHp;
  const maxHp = hpOverride ? hpOverride.maxHp : pokemon.maxHp;
  const hpPercent = hpOverride ? hpOverride.hpPercent : pokemon.hpPercent;

  return (
    <div className="battle-pokemon-status">
      <div className="battle-pokemon-status__heading">
        <strong>{pokemon.nickname || pokemon.name}</strong>
        <span>Niv. {pokemon.level}</span>
      </div>
      <div className="battle-pokemon-status__meta">
        <span>PV</span>
        <strong>
          {currentHp}/{maxHp}
        </strong>
      </div>
      <div
        className="battle-hp"
        role="progressbar"
        aria-label={`Points de vie de ${pokemon.nickname || pokemon.name}`}
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-valuenow={currentHp}
      >
        <span
          data-tone={hpTone(hpPercent)}
          style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }}
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
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
  const [currentMessage, setCurrentMessage] = useState<string>(
    initialBattle.trainer.introCatchline || "Le combat commence.",
  );
  const [rewards, setRewards] = useState<BattleRewardPayload>();
  const [pending, setPending] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState("");
  const [showTeam, setShowTeam] = useState(false);

  // Animations visuelles des combattants
  const [playerAnim, setPlayerAnim] = useState<string>("");
  const [opponentAnim, setOpponentAnim] = useState<string>("");

  // Jauges de PV dynamiques interpolées pendant les animations
  const [playerHp, setPlayerHp] = useState<HpOverride | null>(null);
  const [opponentHp, setOpponentHp] = useState<HpOverride | null>(null);

  const requestLock = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const player = activePokemon(state.p1);
  const opponent = activePokemon(state.p2);
  const finished = state.phase === "finished" && !isAnimating;
  const switchRequired = state.phase === "switch_required" && !isAnimating;
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
    if (requestLock.current || finished || isAnimating) return;
    requestLock.current = true;
    setPending(true);
    setIsAnimating(true);
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
      setPending(false);

      // Déroulement séquentiel et immersif des événements du tour
      if (next.events && next.events.length > 0) {
        for (let i = 0; i < next.events.length; i++) {
          const event = next.events[i];
          if (event.message) {
            setCurrentMessage(event.message);
          }

          if (event.type === "move") {
            const isPlayer =
              event.side === "p1" ||
              (!event.side && event.message?.includes(player.nickname || player.name));

            if (isPlayer) {
              setPlayerAnim("is-attacking-player");
              setTimeout(() => setPlayerAnim(""), 420);
            } else {
              setOpponentAnim("is-attacking-opponent");
              setTimeout(() => setOpponentAnim(""), 420);
            }
            await sleep(1200);
          } else if (event.type === "damage") {
            const isPlayerTarget =
              event.side === "p1" ||
              (!event.side && event.message?.includes(player.nickname || player.name));

            // Déterminer le SFX précis lié à cet impact (super efficace, peu efficace, coup critique, ou normal)
            const nextEvent = next.events[i + 1];
            if (nextEvent?.type === "effectiveness" && nextEvent.multiplier && nextEvent.multiplier > 1) {
              playBattleSfx("super_effective");
            } else if (nextEvent?.type === "effectiveness" && nextEvent.multiplier && nextEvent.multiplier < 1 && nextEvent.multiplier > 0) {
              playBattleSfx("resisted");
            } else if (nextEvent?.type === "critical_hit") {
              playBattleSfx("critical");
            } else {
              playBattleSfx("hit");
            }

            if (isPlayerTarget) {
              setPlayerAnim("is-taking-damage");
              setTimeout(() => setPlayerAnim(""), 460);
              if (typeof event.currentHp === "number" && typeof event.maxHp === "number") {
                setPlayerHp({
                  currentHp: event.currentHp,
                  maxHp: event.maxHp,
                  hpPercent: Math.round((event.currentHp / event.maxHp) * 100),
                });
              }
            } else {
              setOpponentAnim("is-taking-damage");
              setTimeout(() => setOpponentAnim(""), 460);
              if (typeof event.currentHp === "number" && typeof event.maxHp === "number") {
                setOpponentHp({
                  currentHp: event.currentHp,
                  maxHp: event.maxHp,
                  hpPercent: Math.round((event.currentHp / event.maxHp) * 100),
                });
              }
            }
            await sleep(1300);
          } else if (event.type === "effectiveness") {
            // Le message reste affiché suffisamment longtemps
            await sleep(1150);
          } else if (event.type === "critical_hit") {
            await sleep(1150);
          } else if (event.type === "status_inflicted") {
            if (event.status === "par") playBattleSfx("status_par");
            else if (event.status === "slp") playBattleSfx("status_slp");
            else if (event.status === "brn") playBattleSfx("status_brn");
            else if (event.status === "psn" || event.status === "tox") playBattleSfx("status_psn");
            await sleep(1300);
          } else if (event.type === "faint") {
            const isPlayerFaint =
              event.side === "p1" ||
              (!event.side && event.message?.includes(player.nickname || player.name));

            playBattleSfx("faint");
            if (isPlayerFaint) {
              setPlayerAnim("is-fainting");
            } else {
              setOpponentAnim("is-fainting");
            }
            await sleep(1400);
          } else if (event.type === "switch") {
            playBattleSfx("switch");
            await sleep(1200);
          } else if (event.type === "miss") {
            playBattleSfx("miss");
            await sleep(1100);
          } else {
            await sleep(950);
          }
        }
      }

      // Synchronisation de l'état final
      setState(next.state);
      setPlayerHp(null);
      setOpponentHp(null);
      setPlayerAnim("");
      setOpponentAnim("");
      setRewards(next.rewards);
      if (next.rewards) {
        publishPlayerBalance(next.rewards.newBalance);
      }
      setShowTeam(next.state.phase === "switch_required");
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    } catch (cause) {
      if (cause instanceof BattleStateConflictError) {
        setState(cause.state);
        setCurrentMessage(cause.state.logs.at(-1) || cause.message);
        setShowTeam(cause.state.phase === "switch_required");
        setError(cause.message);
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
      setIsAnimating(false);
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

  const controlsDisabled = pending || isAnimating;

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
          victoryCatchline={trainerVictoryCatchline(initialBattle.trainer)}
          defeatCatchline={trainerDefeatCatchline(initialBattle.trainer)}
          currentPhase={soundtrackPhase}
        />

        <div className="battle-interface__body">
          <div className="battle-scene" aria-label="Arène de combat">
            {/* Combattant adverse */}
            <div className="battle-combatant battle-combatant--opponent">
              <PokemonStatus pokemon={opponent} hpOverride={opponentHp} />
              <div className={`battle-combatant__sprite ${opponentAnim}`}>
                {opponent.status && (
                  <div
                    className={`status-overlay status-overlay--${opponent.status}`}
                    aria-hidden="true"
                  >
                    {opponent.status === "par" && "⚡"}
                    {opponent.status === "slp" && "💤"}
                    {opponent.status === "brn" && "🔥"}
                    {(opponent.status === "psn" || opponent.status === "tox") && "☠️"}
                    {opponent.status === "frz" && "❄️"}
                  </div>
                )}
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

            {/* Combattant joueur */}
            <div className="battle-combatant battle-combatant--player">
              <div className={`battle-combatant__sprite ${playerAnim}`}>
                {player.status && (
                  <div
                    className={`status-overlay status-overlay--${player.status}`}
                    aria-hidden="true"
                  >
                    {player.status === "par" && "⚡"}
                    {player.status === "slp" && "💤"}
                    {player.status === "brn" && "🔥"}
                    {(player.status === "psn" || player.status === "tox") && "☠️"}
                    {player.status === "frz" && "❄️"}
                  </div>
                )}
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
              <PokemonStatus pokemon={player} hpOverride={playerHp} />
            </div>
          </div>

          {/* Panneau de commandes et journal rétro */}
          <aside className="battle-command" aria-label="Commandes de combat">
            <div className="battle-log" aria-live="polite" aria-atomic="true">
              <strong>
                <span>Journal de combat</span>
                {isAnimating && <span className="battle-log__indicator">▼</span>}
              </strong>
              <p>{currentMessage}</p>
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
                    disabled={controlsDisabled || move.disabled || move.pp === 0}
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
                    disabled={controlsDisabled || pokemon.isActive || pokemon.isFainted}
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
                  disabled={controlsDisabled || state.p1.team.length < 2}
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
                disabled={controlsDisabled}
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

function trainerVictoryCatchline(trainer: BattleStartPayload["trainer"]): string {
  return trainer.victoryCatchline || `${trainer.name} remporte cette confrontation.`;
}

function trainerDefeatCatchline(trainer: BattleStartPayload["trainer"]): string {
  return trainer.defeatCatchline || `${trainer.name} reconnaît votre victoire.`;
}
