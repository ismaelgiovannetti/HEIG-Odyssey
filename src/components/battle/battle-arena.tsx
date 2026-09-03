"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
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
import { publishQuestProgressInvalidated } from "@/lib/quests/quest-progress-events";
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
  /** Étape de campagne qui suit celle jouée, si elle existe. */
  nextStageId?: string | null;
  /** Enchaîne directement sur `nextStageId` depuis l'écran de résultat. */
  onAdvance?: () => void;
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

/** Normalise un champ `sprite` de dresseur en URL exploitable. */
function trainerSpriteUrl(sprite?: string): string | null {
  if (!sprite) return null;
  if (sprite.startsWith("/") || sprite.startsWith("http")) return sprite;
  return `/sprites/${sprite}${sprite.endsWith(".png") ? "" : ".png"}`;
}

type OpponentIntroPhase = "trainer" | "leaving" | "pokemon";

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
  className = "",
}: {
  pokemon: BattlePokemonPayload;
  hpOverride?: HpOverride | null;
  statusOverride?: string | null;
  className?: string;
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
    <div className={`battle-pokemon-status ${className}`}>
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
  canAdvance,
  onAdvance,
}: {
  state: BattleStatePayload;
  rewards?: BattleRewardPayload;
  trainer: BattleStartPayload["trainer"];
  mode: BattleMode;
  onReturn: () => void;
  canAdvance: boolean;
  onAdvance?: () => void;
}) {
  const won = state.winner === "p1";
  const showAdvance = won && canAdvance && !!onAdvance;
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
        {showAdvance && (
          <button
            className="battle-primary-button battle-result__next"
            type="button"
            onClick={onAdvance}
          >
            <ArrowRight aria-hidden="true" size={18} />
            Combat suivant
          </button>
        )}
        <button
          className={
            showAdvance ? "battle-quiet-button" : "battle-primary-button"
          }
          type="button"
          onClick={onReturn}
        >
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
  nextStageId,
  onAdvance,
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

  // Lancement du combat : le dresseur adverse reste en scène le temps de sa
  // réplique, glisse hors champ, puis laisse place à son Pokémon.
  const introTrainerUrl = trainerSpriteUrl(initialBattle.trainer.sprite);
  const [opponentIntro, setOpponentIntro] = useState<OpponentIntroPhase>(
    introTrainerUrl ? "trainer" : "pokemon",
  );

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
  // Un combattant K.O. reste absent du terrain une fois son animation de chute
  // terminée, jusqu'à ce qu'un remplaçant prenne sa place : son sprite ne doit
  // pas réapparaître pendant le choix du Pokémon suivant.
  const hidePlayerField = player.isFainted && playerAnim !== "is-fainting";
  const hideOpponentField = opponent.isFainted && opponentAnim !== "is-fainting";
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

  // Séquence de lancement. Pas de garde par ref : sous React.StrictMode le
  // cycle monter → nettoyer → remonter annule puis reprogramme proprement les
  // minuteries (une garde figerait l'intro après le premier nettoyage).
  useEffect(() => {
    const timers: number[] = [];

    // Sortie de Pokéball : on repart de "" puis on repose la classe au tick
    // suivant pour forcer le redémarrage de l'animation (utile sous StrictMode).
    const pokeballEntrance = (
      setAnim: (value: string) => void,
      delay = 0,
    ) => {
      timers.push(window.setTimeout(() => setAnim(""), delay));
      timers.push(
        window.setTimeout(() => setAnim("is-entering-pokeball"), delay + 20),
      );
      timers.push(window.setTimeout(() => setAnim(""), delay + 420));
    };

    // Sans dresseur à l'écran : les deux Pokémon entrent tout de suite.
    if (!introTrainerUrl) {
      setOpponentIntro("pokemon");
      pokeballEntrance(setPlayerAnim);
      pokeballEntrance(setOpponentAnim);
      return () => timers.forEach((id) => clearTimeout(id));
    }

    // Le dresseur reste 1,5 s en scène, glisse hors champ (420 ms), puis les
    // deux Pokémon apparaissent une fois son animation terminée.
    const HOLD_MS = 1500;
    const SLIDE_MS = 420;
    timers.push(
      window.setTimeout(() => {
        setOpponentIntro("leaving");
        playBattleSfx("switch");
      }, HOLD_MS),
    );
    timers.push(
      window.setTimeout(() => {
        setOpponentIntro("pokemon");
        pokeballEntrance(setPlayerAnim);
        pokeballEntrance(setOpponentAnim);
      }, HOLD_MS + SLIDE_MS),
    );

    return () => timers.forEach((id) => clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Quitter l'arène sans conclure le combat doit libérer la session serveur,
  // sinon l'équipe / les attaques restent verrouillées comme « en combat ».
  const battleConcludedRef = useRef(false);
  const questRefreshPublishedBattleIdRef = useRef<string | null>(null);
  const realMountRef = useRef(false);

  useEffect(() => {
    if (state.phase !== "finished") return;

    battleConcludedRef.current = true;
    if (questRefreshPublishedBattleIdRef.current !== state.battleId) {
      questRefreshPublishedBattleIdRef.current = state.battleId;
      publishQuestProgressInvalidated(state.battleId);
    }
  }, [state.battleId, state.phase]);

  useEffect(() => {
    // Le cycle simulé de React.StrictMode (montage → démontage immédiat →
    // remontage) ne laisse jamais ce drapeau passer à true : seul un vrai
    // démontage libère la session.
    const flagId = window.setTimeout(() => {
      realMountRef.current = true;
    }, 0);

    const battleId = initialBattle.battleId;
    const releaseSession = (viaBeacon: boolean) => {
      if (battleConcludedRef.current) return;
      const body = JSON.stringify({ battleId });
      if (
        viaBeacon &&
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        const queued = navigator.sendBeacon(
          "/api/battle/abandon",
          new Blob([body], { type: "application/json" }),
        );
        if (queued) return;
      }
      try {
        const pending = fetch("/api/battle/abandon", {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body,
        }) as Promise<Response> | undefined;
        void pending?.catch?.(() => {});
      } catch {
        /* best effort : la fenêtre d'inactivité serveur prend le relais */
      }
    };

    const onPageHide = (event: PageTransitionEvent) => {
      // Mise en cache bfcache : la page peut revenir telle quelle, on ne libère
      // pas encore (la fenêtre d'inactivité serveur prendra le relais au besoin).
      if (event.persisted) return;
      releaseSession(true);
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearTimeout(flagId);
      window.removeEventListener("pagehide", onPageHide);
      if (realMountRef.current) releaseSession(false);
    };
  }, [initialBattle.battleId]);

  async function submitAction(action: PlayerAction) {
    if (
      requestLock.current ||
      finished ||
      isAnimating ||
      opponentIntro !== "pokemon"
    ) {
      return;
    }
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

      // Déroulement séquentiel et immersif des événements du tour.
      // Les marqueurs d'efficacité et de coup critique précèdent les dégâts dans
      // le protocole : on les diffère pour respecter le rythme cinématographique
      // (impact → efficacité → coup critique → suite du tour).
      let pendingCrit = false;
      let pendingEffectiveness: { multiplier: number; message: string } | null = null;
      let consecutiveHits = 0;
      // Camps dont le combattant vient d'être mis K.O. ce tour : leur
      // remplacement ne doit pas rejouer l'animation de rappel (le Pokémon a
      // déjà disparu via l'animation de K.O.).
      const faintedThisTurn = new Set<string>();

      const targetIsPlayer = (evt: { side?: string; message?: string }) =>
        evt.side === "p1" ||
        (!evt.side &&
          !!evt.message &&
          evt.message.includes(player.nickname || player.name));

      const flushHitFeedback = async () => {
        if (pendingCrit) {
          setCurrentMessage("Coup critique !");
          await sleep(900);
          pendingCrit = false;
        }
        if (pendingEffectiveness) {
          setCurrentMessage(pendingEffectiveness.message);
          await sleep(900);
          pendingEffectiveness = null;
        }
      };

      const events = next.events ?? [];
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const type = event.type;
        const keepsHitGroup =
          type === "damage" ||
          type === "critical_hit" ||
          type === "effectiveness" ||
          type === "hit_count";

        // Tout autre évènement clôt le groupe de coups en cours : on affiche
        // d'abord les messages différés, puis on remet le compteur à zéro.
        if (!keepsHitGroup) {
          await flushHitFeedback();
          consecutiveHits = 0;
        }

        if (type === "turn_start") {
          await sleep(150);
          continue;
        }

        if (event.message && type !== "critical_hit" && type !== "effectiveness") {
          setCurrentMessage(event.message);
        }

        if (type === "move") {
          // 1. Annonce lue par le joueur, puis élan net et pause d'anticipation.
          await sleep(700);
          if (targetIsPlayer(event)) {
            setPlayerAnim("is-attacking-player");
            await sleep(280);
            setPlayerAnim("");
          } else {
            setOpponentAnim("is-attacking-opponent");
            await sleep(280);
            setOpponentAnim("");
          }
          await sleep(200);
          continue;
        }

        if (type === "critical_hit") {
          pendingCrit = true;
          continue;
        }

        if (type === "effectiveness") {
          const multiplier =
            typeof event.multiplier === "number" ? event.multiplier : 1;
          if (multiplier === 0) {
            // Immunité : aucun dégât ne suit, on annonce immédiatement.
            setCurrentMessage(event.message);
            await sleep(900);
          } else {
            pendingEffectiveness = { multiplier, message: event.message };
          }
          continue;
        }

        if (type === "damage") {
          const playerTarget = targetIsPlayer(event);
          const residual = event.residual === true;
          const stateMaxHp = playerTarget ? player.maxHp : opponent.maxHp;
          const maxHp =
            typeof event.maxHp === "number" && event.maxHp > 0
              ? event.maxHp
              : stateMaxHp > 0
                ? stateMaxHp
                : 1;
          const currentHp =
            typeof event.currentHp === "number" ? Math.max(0, event.currentHp) : 0;
          const hpPercent = Math.round((currentHp / maxHp) * 100);
          const micro = consecutiveHits > 0;

          // 2. SFX d'impact choisi selon le contexte (critique > efficacité > normal).
          if (pendingCrit) playBattleSfx("critical");
          else if (pendingEffectiveness && pendingEffectiveness.multiplier >= 2)
            playBattleSfx("super_effective");
          else if (
            pendingEffectiveness &&
            pendingEffectiveness.multiplier > 0 &&
            pendingEffectiveness.multiplier < 1
          )
            playBattleSfx("resisted");
          else playBattleSfx("hit");

          // 3. Jauge de PV et recul d'impact déclenchés simultanément.
          if (playerTarget) {
            setPlayerHp({ currentHp, maxHp, hpPercent });
            setPlayerAnim("is-taking-damage-player");
            await sleep(micro ? 140 : 240);
            setPlayerAnim("");
          } else {
            setOpponentHp({ currentHp, maxHp, hpPercent });
            setOpponentAnim("is-taking-damage-opponent");
            await sleep(micro ? 140 : 240);
            setOpponentAnim("");
          }
          consecutiveHits += 1;

          // 4. Descente fluide de la barre (transition CSS 600 ms).
          await sleep(residual ? 800 : micro ? 260 : 750);
          continue;
        }

        if (type === "hit_count") {
          const hits =
            typeof event.hitCount === "number" && event.hitCount > 0
              ? event.hitCount
              : consecutiveHits;
          if (hits > 1) {
            setCurrentMessage(`Touché ${hits} fois !`);
            await sleep(800);
          }
          await flushHitFeedback();
          consecutiveHits = 0;
          continue;
        }

        if (type === "heal") {
          const playerTarget = targetIsPlayer(event);
          const stateMaxHp = playerTarget ? player.maxHp : opponent.maxHp;
          const maxHp =
            typeof event.maxHp === "number" && event.maxHp > 0
              ? event.maxHp
              : stateMaxHp > 0
                ? stateMaxHp
                : 1;
          const currentHp =
            typeof event.currentHp === "number" ? Math.max(0, event.currentHp) : 0;
          if (currentHp > 0) {
            const hpPercent = Math.round((currentHp / maxHp) * 100);
            if (playerTarget) setPlayerHp({ currentHp, maxHp, hpPercent });
            else setOpponentHp({ currentHp, maxHp, hpPercent });
          }
          await sleep(800);
          continue;
        }

        if (type === "status_inflicted") {
          const playerTarget = targetIsPlayer(event);
          const status = event.status || null;

          // Apparition instantanée du badge et de l'overlay au moment du log.
          if (playerTarget) setPlayerStatus(status);
          else setOpponentStatus(status);

          if (status === "par") playBattleSfx("status_par");
          else if (status === "slp") playBattleSfx("status_slp");
          else if (status === "brn") playBattleSfx("status_brn");
          else if (status === "psn" || status === "tox") playBattleSfx("status_psn");
          else if (status === "frz") playBattleSfx("status_frz");
          await sleep(1000);
          continue;
        }

        if (type === "status_cleared") {
          if (targetIsPlayer(event)) setPlayerStatus(null);
          else setOpponentStatus(null);
          await sleep(900);
          continue;
        }

        if (type === "weather") {
          // 7. Météo résolue en fin de tour, avant les dégâts qu'elle inflige.
          await sleep(800);
          continue;
        }

        if (type === "stat_boost" || type === "cant" || type === "fail" || type === "message") {
          await sleep(900);
          continue;
        }

        if (type === "miss") {
          playBattleSfx("miss");
          await sleep(1000);
          continue;
        }

        if (type === "faint") {
          const playerFaint = targetIsPlayer(event);
          faintedThisTurn.add(playerFaint ? "p1" : "p2");

          // 8. Les PV affichent 0 / max (jamais 0/0), puis chute et fondu.
          if (playerFaint) {
            setPlayerHp({
              currentHp: 0,
              maxHp: player.maxHp > 0 ? player.maxHp : 1,
              hpPercent: 0,
            });
            setPlayerStatus(null);
            setPlayerAnim("is-fainting");
          } else {
            setOpponentHp({
              currentHp: 0,
              maxHp: opponent.maxHp > 0 ? opponent.maxHp : 1,
              hpPercent: 0,
            });
            setOpponentStatus(null);
            setOpponentAnim("is-fainting");
          }
          playBattleSfx("faint");
          await sleep(1200);
          continue;
        }

        if (type === "switch") {
          const playerSwitch = targetIsPlayer(event);
          const setAnim = playerSwitch ? setPlayerAnim : setOpponentAnim;
          const setHp = playerSwitch ? setPlayerHp : setOpponentHp;
          const setStatus = playerSwitch ? setPlayerStatus : setOpponentStatus;
          const outgoing = playerSwitch ? player : opponent;

          // PV d'entrée en jeu (avant les dégâts du tour) pour que la jauge parte
          // de là et descende visiblement lors du coup adverse.
          const switchInHp =
            typeof event.currentHp === "number" &&
            typeof event.maxHp === "number" &&
            event.maxHp > 0
              ? {
                  currentHp: Math.max(0, event.currentHp),
                  maxHp: event.maxHp,
                  hpPercent: Math.round(
                    (Math.max(0, event.currentHp) / event.maxHp) * 100,
                  ),
                }
              : null;

          // Beat 1 — rappel explicite du combattant sortant. On le saute quand
          // il vient d'être mis K.O. ce tour (l'animation de K.O. l'a déjà fait
          // disparaître) : `outgoing` est un instantané d'avant le tour et peut
          // encore le montrer vivant.
          const switchSide = event.side ?? (playerSwitch ? "p1" : "p2");
          const outgoingFainted =
            faintedThisTurn.has(switchSide) ||
            outgoing.isFainted ||
            outgoing.currentHp <= 0;
          if (!outgoingFainted) {
            setCurrentMessage(`${outgoing.nickname || outgoing.name}, reviens !`);
            setAnim("is-recalling");
            await sleep(360);
          }

          // Beat 2 — le nouveau combattant remplace l'ancien et sort de sa Ball.
          setStatus(undefined);
          setHp(switchInHp);
          if (playerSwitch) {
            setState((prev) => ({ ...prev, p1: next.state.p1 }));
          } else {
            setState((prev) => ({ ...prev, p2: next.state.p2 }));
          }
          playBattleSfx("switch");
          setCurrentMessage(event.message);
          setAnim("is-entering-pokeball");
          await sleep(360);
          setAnim("");

          // Beat 3 — temps mort pour bien enregistrer l'entrée avant la suite.
          await sleep(620);
          continue;
        }

        if (type === "battle_end") {
          // La mise K.O. finale a déjà marqué sa pause : transition brève ici.
          await sleep(600);
          continue;
        }

        await sleep(800);
      }

      // Derniers marqueurs différés éventuels (efficacité/critique en fin de liste).
      await flushHitFeedback();

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
            canAdvance={mode === "campaign" && !!nextStageId}
            onAdvance={onAdvance}
          />
        </div>
      </>
    );
  }

  // Aucune action tant que le dresseur n'a pas cédé la place à son Pokémon.
  const introPlaying = opponentIntro !== "pokemon";
  const controlsDisabled = pending || isAnimating || introPlaying;

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
          <div
            className="battle-scene"
            aria-label="Arène de combat"
            data-arena={
              initialBattle.arena ??
              (mode === "training" ? "training" : "neutral")
            }
          >
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
                    className={introPlaying ? "is-intro-hidden" : ""}
                  />
                  <div className="battle-combatant__stage">
                  <div
                    className="battle-combatant__platform"
                    aria-hidden="true"
                  />
                  {opponentIntro !== "pokemon" && introTrainerUrl && (
                    <div
                      className={`battle-combatant__trainer ${
                        opponentIntro === "leaving" ? "is-trainer-leaving" : ""
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={introTrainerUrl}
                        alt={initialBattle.trainer.name}
                        width={210}
                        height={210}
                      />
                    </div>
                  )}
                  <div
                    className={`battle-combatant__sprite ${opponentAnim} ${hideOpponentField ? "is-fainted-hidden" : ""} ${introPlaying ? "is-intro-hidden" : ""}`}
                  >
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
                </div>
              );
            })()}

            {/* Combattant joueur */}
            {(() => {
              const effectivePlayerStatus =
                playerStatus !== undefined ? playerStatus : player.status;
              return (
                <div className="battle-combatant battle-combatant--player">
                  <div className="battle-combatant__stage">
                  <div
                    className="battle-combatant__platform"
                    aria-hidden="true"
                  />
                  <div
                    className={`battle-combatant__sprite ${playerAnim} ${hidePlayerField ? "is-fainted-hidden" : ""} ${introPlaying ? "is-intro-hidden" : ""}`}
                  >
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
                  </div>
                  <PokemonStatus
                    pokemon={player}
                    hpOverride={playerHp}
                    statusOverride={playerStatus}
                    className={introPlaying ? "is-intro-hidden" : ""}
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
