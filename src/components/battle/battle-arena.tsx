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
import { getMoveFrenchName } from "@/lib/pokemon/move-names-fr";
import { getSpeciesFrenchName } from "@/lib/pokemon/species-names-fr";

type BattleMode = "campaign" | "training";
type PlayerAction =
  | { type: "move"; moveIndex: number }
  | { type: "switch"; targetPokemonIndex: number };

interface BattleArenaProps {
  initialBattle: BattleStartPayload;
  mode: BattleMode;
  onReturn: () => void;
}

const TYPE_LABELS_FR: Record<string, string> = {
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
  statusOverride,
}: {
  pokemon: BattlePokemonPayload;
  hpOverride?: HpOverride | null;
  statusOverride?: string | null;
}) {
  const currentHp =
    hpOverride !== null && hpOverride !== undefined
      ? hpOverride.currentHp
      : pokemon.currentHp;
  const maxHp =
    hpOverride && hpOverride.maxHp > 0
      ? hpOverride.maxHp
      : pokemon.maxHp > 0
        ? pokemon.maxHp
        : 1;
  const hpPercent =
    hpOverride && typeof hpOverride.hpPercent === "number"
      ? hpOverride.hpPercent
      : maxHp > 0
        ? Math.round((currentHp / maxHp) * 100)
        : 0;

  const displayName = pokemon.nickname || getSpeciesFrenchName(pokemon.speciesId, pokemon.name);
  const effectiveStatus = statusOverride !== undefined ? statusOverride : pokemon.status;

  return (
    <div className="battle-pokemon-status">
      <div className="battle-pokemon-status__heading">
        <strong>{displayName}</strong>
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
        aria-label={`Points de vie de ${displayName}`}
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
        <span>{pokemon.types.map((t) => TYPE_LABELS_FR[t] || t).join(" · ")}</span>
        {effectiveStatus && (
          <strong>{STATUS_LABELS[effectiveStatus] ?? effectiveStatus}</strong>
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

  // Statuts instantanés appliqués dès l'apparition du log
  const [playerStatus, setPlayerStatus] = useState<string | null | undefined>(undefined);
  const [opponentStatus, setOpponentStatus] = useState<string | null | undefined>(undefined);

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

  const introTriggered = useRef(false);

  useEffect(() => {
    if (introTriggered.current) return;
    introTriggered.current = true;

    // Animation d'entrée en combat (sortie de Pokéball)
    setPlayerAnim("is-entering-pokeball");
    setOpponentAnim("is-entering-pokeball");
    const t = setTimeout(() => {
      setPlayerAnim("");
      setOpponentAnim("");
    }, 320);
    return () => clearTimeout(t);
  }, []);

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
            const isPlayerAttacker =
              event.side === "p1" ||
              (!event.side && event.message?.includes(player.nickname || player.name));

            // Animation d'attaque (élan vers l'avant net)
            if (isPlayerAttacker) {
              setPlayerAnim("is-attacking-player");
              await sleep(280);
              setPlayerAnim("");
            } else {
              setOpponentAnim("is-attacking-opponent");
              await sleep(280);
              setOpponentAnim("");
            }
            await sleep(350);
          } else if (event.type === "damage") {
            const isPlayerTarget =
              event.side === "p1" ||
              (!event.side && event.message?.includes(player.nickname || player.name));

            const targetMaxHp = isPlayerTarget ? player.maxHp : opponent.maxHp;
            const finalMaxHp =
              typeof event.maxHp === "number" && event.maxHp > 0
                ? event.maxHp
                : targetMaxHp > 0
                  ? targetMaxHp
                  : 1;
            const finalCurrHp =
              typeof event.currentHp === "number" ? event.currentHp : 0;
            const finalPercent = Math.round((finalCurrHp / finalMaxHp) * 100);

            // Mise à jour de la jauge et recul d'impact franc
            if (isPlayerTarget) {
              setPlayerHp({
                currentHp: finalCurrHp,
                maxHp: finalMaxHp,
                hpPercent: finalPercent,
              });
              setPlayerAnim("is-taking-damage-player");
              await sleep(240);
              setPlayerAnim("");
            } else {
              setOpponentHp({
                currentHp: finalCurrHp,
                maxHp: finalMaxHp,
                hpPercent: finalPercent,
              });
              setOpponentAnim("is-taking-damage-opponent");
              await sleep(240);
              setOpponentAnim("");
            }

            // Laisser le temps à la barre de PV de descendre (y compris jusqu'à 0)
            await sleep(650);
          } else if (event.type === "effectiveness") {
            // Affichage du message d'efficacité après que les dégâts soient visibles
            await sleep(1350);
          } else if (event.type === "critical_hit") {
            await sleep(1250);
          } else if (event.type === "status_inflicted") {
            const isPlayerTarget =
              event.side === "p1" ||
              (!event.side && event.message?.includes(player.nickname || player.name));

            if (isPlayerTarget) {
              setPlayerStatus(event.status || null);
            } else {
              setOpponentStatus(event.status || null);
            }

            if (event.status === "par") playBattleSfx("status_par");
            else if (event.status === "slp") playBattleSfx("status_slp");
            else if (event.status === "brn") playBattleSfx("status_brn");
            else if (event.status === "psn" || event.status === "tox") playBattleSfx("status_psn");
            await sleep(1350);
          } else if (event.type === "status_cleared") {
            const isPlayerTarget =
              event.side === "p1" ||
              (!event.side && event.message?.includes(player.nickname || player.name));

            if (isPlayerTarget) {
              setPlayerStatus(null);
            } else {
              setOpponentStatus(null);
            }
            await sleep(1000);
          } else if (event.type === "faint") {
            const isPlayerFaint =
              event.side === "p1" ||
              (!event.side && event.message?.includes(player.nickname || player.name));

            // S'assurer que les PV sont bien à 0/maxHp lors de l'annonce du K.O.
            if (isPlayerFaint) {
              setPlayerHp({
                currentHp: 0,
                maxHp: player.maxHp > 0 ? player.maxHp : 1,
                hpPercent: 0,
              });
              setPlayerAnim("is-fainting");
              setPlayerStatus(null);
            } else {
              setOpponentHp({
                currentHp: 0,
                maxHp: opponent.maxHp > 0 ? opponent.maxHp : 1,
                hpPercent: 0,
              });
              setOpponentAnim("is-fainting");
              setOpponentStatus(null);
            }

            playBattleSfx("faint");
            await sleep(1500);
          } else if (event.type === "switch") {
            const isPlayerSwitch =
              event.side === "p1" ||
              (!event.side && event.message?.includes(player.nickname || player.name));

            // Sortie de Pokéball du nouveau Pokémon actif
            if (isPlayerSwitch) {
              setPlayerStatus(undefined);
              setPlayerHp(null);
              setState((prev) => ({ ...prev, p1: next.state.p1 }));
              playBattleSfx("switch");
              setPlayerAnim("is-entering-pokeball");
              await sleep(320);
              setPlayerAnim("");
            } else {
              setOpponentStatus(undefined);
              setOpponentHp(null);
              setState((prev) => ({ ...prev, p2: next.state.p2 }));
              playBattleSfx("switch");
              setOpponentAnim("is-entering-pokeball");
              await sleep(320);
              setOpponentAnim("");
            }

            await sleep(650);
          } else if (event.type === "miss") {
            playBattleSfx("miss");
            await sleep(1200);
          } else {
            await sleep(1000);
          }
        }
      }

      // Synchronisation de l'état final
      setState(next.state);
      setPlayerHp(null);
      setOpponentHp(null);
      setPlayerStatus(undefined);
      setOpponentStatus(undefined);
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
            {(() => {
              const effectiveOpponentStatus =
                opponentStatus !== undefined ? opponentStatus : opponent.status;
              return (
                <div className="battle-combatant battle-combatant--opponent">
                  <PokemonStatus
                    pokemon={opponent}
                    hpOverride={opponentHp}
                    statusOverride={opponentStatus}
                  />
                  <div className={`battle-combatant__sprite ${opponentAnim}`}>
                    {effectiveOpponentStatus && (
                      <div
                        className={`status-overlay status-overlay--${effectiveOpponentStatus}`}
                        aria-hidden="true"
                      >
                        {effectiveOpponentStatus === "par" && "⚡"}
                        {effectiveOpponentStatus === "slp" && "💤"}
                        {effectiveOpponentStatus === "brn" && "🔥"}
                        {(effectiveOpponentStatus === "psn" || effectiveOpponentStatus === "tox") && "☠️"}
                        {effectiveOpponentStatus === "frz" && "❄️"}
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
              );
            })()}

            {/* Combattant joueur */}
            {(() => {
              const effectivePlayerStatus =
                playerStatus !== undefined ? playerStatus : player.status;
              return (
                <div className="battle-combatant battle-combatant--player">
                  <div className={`battle-combatant__sprite ${playerAnim}`}>
                    {effectivePlayerStatus && (
                      <div
                        className={`status-overlay status-overlay--${effectivePlayerStatus}`}
                        aria-hidden="true"
                      >
                        {effectivePlayerStatus === "par" && "⚡"}
                        {effectivePlayerStatus === "slp" && "💤"}
                        {effectivePlayerStatus === "brn" && "🔥"}
                        {(effectivePlayerStatus === "psn" || effectivePlayerStatus === "tox") && "☠️"}
                        {effectivePlayerStatus === "frz" && "❄️"}
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
                  <PokemonStatus
                    pokemon={player}
                    hpOverride={playerHp}
                    statusOverride={playerStatus}
                  />
                </div>
              );
            })()}
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
                    : `Que doit faire ${player.nickname || getSpeciesFrenchName(player.speciesId, player.name)} ?`}
                </strong>
              </div>
              <span>
                {state.p1.team.filter((pokemon) => !pokemon.isFainted).length}/
                {state.p1.team.length} disponibles
              </span>
            </div>

            {!showTeam && !switchRequired ? (
              <div className="battle-moves">
                {player.moves.map((move, index) => {
                  const frenchMoveName = getMoveFrenchName(move.id, move.name);
                  const frenchType = TYPE_LABELS_FR[move.type] || move.type;

                  return (
                    <button
                      key={`${move.id}-${index}`}
                      type="button"
                      data-type={move.type}
                      disabled={controlsDisabled || move.disabled || move.pp === 0}
                      onClick={() => void submitAction({ type: "move", moveIndex: index })}
                    >
                      <strong>{frenchMoveName}</strong>
                      <span>
                        {frenchType} · {move.pp}/{move.maxPp} PP
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="battle-switches">
                {state.p1.team.map((pokemon, index) => {
                  const switchName = pokemon.nickname || getSpeciesFrenchName(pokemon.speciesId, pokemon.name);

                  return (
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
                        <strong>{switchName}</strong>
                        <small>
                          {pokemon.isFainted
                            ? "K.O."
                            : pokemon.isActive
                              ? "Au combat"
                              : `${pokemon.currentHp}/${pokemon.maxHp} PV`}
                        </small>
                      </span>
                    </button>
                  );
                })}
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
