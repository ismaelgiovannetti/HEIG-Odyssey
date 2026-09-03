"use client";

import { useEffect, useRef, useState } from "react";
import { Swords } from "lucide-react";
import {
  SoundtrackPlayer,
  type SoundtrackPhase,
} from "@/components/audio/soundtrack-player";
import { BattleCatchlines } from "@/components/combat/battle-catchlines";
import { BattleCommandPanel } from "./battle-command-panel";
import { BattleResult } from "./battle-result";
import { BattleScene } from "./battle-scene";
import type {
  BattleArenaProps,
  OpponentIntroPhase,
  PlayerAction,
} from "./battle-arena-types";
import type { HpOverride } from "./battle-pokemon-status";
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
import { playBattleSfx } from "@/lib/audio/battle-sfx";

/** Retrouve le combattant visible tout en conservant un repli sûr. */
function activePokemon(side: BattleStatePayload["p1"]): BattlePokemonPayload {
  return (
    side.team.find((pokemon) => pokemon.isActive) ??
    side.team[side.activePokemonIndex] ??
    side.team[0]
  );
}

/** Normalise un champ `sprite` de dresseur en URL exploitable. */
function trainerSpriteUrl(sprite?: string): string | null {
  if (!sprite) return null;
  if (sprite.startsWith("/") || sprite.startsWith("http")) return sprite;
  return `/sprites/${sprite}${sprite.endsWith(".png") ? "" : ".png"}`;
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
  const [playerStatus, setPlayerStatus] = useState<string | null | undefined>(
    undefined,
  );
  const [opponentStatus, setOpponentStatus] = useState<
    string | null | undefined
  >(undefined);

  const requestLock = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const player = activePokemon(state.p1);
  const opponent = activePokemon(state.p2);
  // Un combattant K.O. reste absent du terrain une fois son animation de chute
  // terminée, jusqu'à ce qu'un remplaçant prenne sa place : son sprite ne doit
  // pas réapparaître pendant le choix du Pokémon suivant.
  const hidePlayerField = player.isFainted && playerAnim !== "is-fainting";
  const hideOpponentField =
    opponent.isFainted && opponentAnim !== "is-fainting";
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
    const pokeballEntrance = (setAnim: (value: string) => void, delay = 0) => {
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
      let pendingEffectiveness: { multiplier: number; message: string } | null =
        null;
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

        if (
          event.message &&
          type !== "critical_hit" &&
          type !== "effectiveness"
        ) {
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
            typeof event.currentHp === "number"
              ? Math.max(0, event.currentHp)
              : 0;
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
            typeof event.currentHp === "number"
              ? Math.max(0, event.currentHp)
              : 0;
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
          else if (status === "psn" || status === "tox")
            playBattleSfx("status_psn");
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

        if (
          type === "stat_boost" ||
          type === "cant" ||
          type === "fail" ||
          type === "message"
        ) {
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
            setCurrentMessage(
              `${outgoing.nickname || outgoing.name}, reviens !`,
            );
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
              {mode === "training"
                ? "Simulation tactique"
                : "Combat de campagne"}
            </p>
            <h1 id="battle-title">{initialBattle.trainer.name}</h1>
            <p>{initialBattle.trainer.title || "Dresseur adverse"}</p>
          </div>
          <div
            className="battle-interface__turn"
            aria-label={`Tour ${state.turn}`}
          >
            <Swords aria-hidden="true" size={20} />
            <span>Tour</span>
            <strong>{state.turn}</strong>
          </div>
        </header>

        <BattleCatchlines
          trainerName={initialBattle.trainer.name}
          trainerTitle={initialBattle.trainer.title}
          trainerSprite={initialBattle.trainer.sprite}
          introCatchline={
            initialBattle.trainer.introCatchline || "Le combat commence."
          }
          victoryCatchline={trainerVictoryCatchline(initialBattle.trainer)}
          defeatCatchline={trainerDefeatCatchline(initialBattle.trainer)}
          currentPhase={soundtrackPhase}
        />

        <div className="battle-interface__body">
          <BattleScene
            arena={
              initialBattle.arena ??
              (mode === "training" ? "training" : "neutral")
            }
            trainer={initialBattle.trainer}
            introTrainerUrl={introTrainerUrl}
            opponentIntro={opponentIntro}
            introPlaying={introPlaying}
            player={{
              pokemon: player,
              hpOverride: playerHp,
              statusOverride: playerStatus,
              animation: playerAnim,
              hideField: hidePlayerField,
            }}
            opponent={{
              pokemon: opponent,
              hpOverride: opponentHp,
              statusOverride: opponentStatus,
              animation: opponentAnim,
              hideField: hideOpponentField,
            }}
          />

          <BattleCommandPanel
            state={state}
            player={player}
            currentMessage={currentMessage}
            isAnimating={isAnimating}
            error={error}
            pending={pending}
            switchRequired={switchRequired}
            showTeam={showTeam}
            controlsDisabled={controlsDisabled}
            onSubmitAction={submitAction}
            onToggleTeam={() => setShowTeam((visible) => !visible)}
            onReturn={onReturn}
          />
        </div>
      </section>
    </>
  );
}

function trainerVictoryCatchline(
  trainer: BattleStartPayload["trainer"],
): string {
  return (
    trainer.victoryCatchline || `${trainer.name} remporte cette confrontation.`
  );
}

function trainerDefeatCatchline(
  trainer: BattleStartPayload["trainer"],
): string {
  return trainer.defeatCatchline || `${trainer.name} reconnaît votre victoire.`;
}
