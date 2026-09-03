"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Gauge,
  Lock,
  MapPinned,
  Star,
  Swords,
  Zap,
} from "lucide-react";
import { BattleArena } from "@/components/battle/battle-arena";
import { MenuSoundtrack } from "@/components/audio/menu-soundtrack";
import {
  CAMPAIGN_TRACKS,
  DEFAULT_CAMPAIGN_TRACK,
} from "@/lib/audio/soundtrack-tracks";
import {
  BattleRequestError,
  readBattleStartResponse,
  type BattleStartPayload,
} from "@/lib/combat/battle-client";
import {
  getCampaignStagePoint,
  getCampaignWorldMap,
} from "@/lib/campaign/campaign-map-config";
import type {
  CampaignProgressOverview,
  CampaignStageView,
  CampaignWorldView,
} from "@/lib/campaign/campaign-service";
import styles from "./campaign-map.module.css";

interface CampaignMapProps {
  overview: CampaignProgressOverview;
}

const WORLD_ACCENTS: Readonly<Record<string, string>> = {
  "bachelor-1": "#7993aa",
  "bachelor-2": "#59a967",
  "bachelor-3": "#f1b82d",
  "bachelor-4": "#c56f35",
  "bachelor-5": "#e85d9a",
  "master-1": "#8a50b8",
  "master-2": "#63bde8",
  doctorat: "#e6b84f",
};

const shortName = (world: CampaignWorldView) => world.name.split(" - ")[0];

const theme = (world: CampaignWorldView) =>
  world.name.split(" - ")[1]?.replace(/^(?:Double )?Type /, "") ?? world.degree;

/** Carte interactive : le serveur reste seul responsable des accès et combats. */
export function CampaignMap({ overview }: Readonly<CampaignMapProps>) {
  const router = useRouter();
  const [worldId, setWorldId] = useState(overview.currentWorldId);
  const [stageId, setStageId] = useState<string | null>(
    overview.nextRecommendedStage?.id ?? null,
  );
  const [launching, setLaunching] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeBattle, setActiveBattle] = useState<BattleStartPayload | null>(
    null,
  );
  // Étape effectivement lancée : sert à proposer « Combat suivant » à l'issue.
  const [battleStageId, setBattleStageId] = useState<string | null>(null);

  // L'ordre du contenu est l'unique ordre de progression, frontières de mondes
  // comprises : la même règle que le service de récompenses côté serveur.
  const orderedStageIds = overview.worlds.flatMap((item) =>
    item.stages.map((stage) => stage.id),
  );
  const nextStageId = (() => {
    if (!battleStageId) return null;
    const index = orderedStageIds.indexOf(battleStageId);
    return index !== -1 && index + 1 < orderedStageIds.length
      ? orderedStageIds[index + 1]
      : null;
  })();

  const world =
    overview.worlds.find((item) => item.id === worldId) ?? overview.worlds[0];
  const stage =
    world.stages.find((item) => item.id === stageId) ??
    world.stages.find((item) => item.status === "ACCESSIBLE") ??
    world.stages[0];
  const progress = world.totalStagesCount
    ? Math.round((world.completedStagesCount / world.totalStagesCount) * 100)
    : 0;
  const worldIndex = overview.worlds.findIndex((item) => item.id === world.id);
  const previousWorld = overview.worlds[worldIndex - 1];
  const nextWorld = overview.worlds[worldIndex + 1];

  function selectWorld(next: CampaignWorldView) {
    setWorldId(next.id);
    setStageId(
      next.stages.find((item) => item.status === "ACCESSIBLE")?.id ??
        next.stages.at(-1)?.id ??
        null,
    );
    setMessage(null);
  }

  async function startBattleForStage(stageId: string) {
    setMessage(null);
    try {
      // Seul l'identifiant de l'étape est transmis : le serveur contrôle
      // l'accès, choisit le dresseur et relit l'équipe du compte connecté.
      const response = await fetch("/api/battle/start", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
      setActiveBattle(await readBattleStartResponse(response));
      setBattleStageId(stageId);
    } catch (cause) {
      setMessage(
        cause instanceof BattleRequestError
          ? cause.message
          : "Une erreur de communication est survenue lors du démarrage du combat.",
      );
    }
  }

  async function launch(target: CampaignStageView) {
    if (target.isLocked || launching) return;
    setLaunching(target.id);
    try {
      await startBattleForStage(target.id);
    } finally {
      setLaunching(null);
    }
  }

  if (activeBattle) {
    return (
      <BattleArena
        key={activeBattle.battleId}
        initialBattle={activeBattle}
        mode="campaign"
        nextStageId={nextStageId}
        onReturn={() => {
          setActiveBattle(null);
          setBattleStageId(null);
          setMessage(null);
          // Les gains et le déblocage de l'étape suivante viennent du serveur.
          router.refresh();
        }}
        onAdvance={
          nextStageId
            ? () => {
                // On enchaîne sur l'étape suivante ; l'accès reste vérifié par
                // le serveur, et la carte se rafraîchira au prochain retour.
                router.refresh();
                void startBattleForStage(nextStageId);
              }
            : undefined
        }
      />
    );
  }

  const campaignTrack =
    CAMPAIGN_TRACKS[world.degree] ?? DEFAULT_CAMPAIGN_TRACK;

  return (
    <section
      className={styles.root}
      aria-labelledby="campaign-title"
      style={
        {
          "--campaign-accent": WORLD_ACCENTS[world.id] ?? "#7993aa",
        } as CSSProperties
      }
    >
      <MenuSoundtrack trackId={campaignTrack} />
      <header className={styles.heading}>
        <p className={styles.eyebrow}>
          <MapPinned aria-hidden="true" size={16} /> Parcours académique
        </p>
        <div className={styles.headingLine}>
          <h1 id="campaign-title">Campagne - {shortName(world)}</h1>
          <p>{world.description}</p>
        </div>
      </header>

      <div
        className={styles.map}
        role="region"
        aria-label={`Carte des étapes de ${world.name}`}
      >
        <div className={styles.mapViewport}>
          <div
            className={styles.canvas}
            style={{
              backgroundImage: `linear-gradient(rgba(8, 13, 24, 0.1), rgba(8, 13, 24, 0.18)), url(${getCampaignWorldMap(world.id)})`,
            }}
          >
            {/* Un seul monde reste visible. Les flèches conservent un parcours
              prévisible et permettent aussi de consulter les mondes verrouillés. */}
            <nav
              className={styles.worldSelector}
              aria-label="Navigation entre les mondes de la campagne"
            >
              <button
                type="button"
                className={styles.worldArrow}
                onClick={() => previousWorld && selectWorld(previousWorld)}
                disabled={!previousWorld}
                aria-label={
                  previousWorld
                    ? `Afficher le monde précédent : ${previousWorld.name}`
                    : "Aucun monde précédent"
                }
              >
                <ChevronLeft aria-hidden="true" />
              </button>

              <div
                className={styles.worldCurrent}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                aria-label={`Monde actuel : ${world.name} (${world.completedStagesCount}/${world.totalStagesCount} terminées)${world.isLocked ? " - Verrouillé" : ""}`}
              >
                <span className={styles.worldIdentity}>
                  <span>{shortName(world)}</span>
                  <strong>{theme(world)}</strong>
                </span>
                <span className={styles.worldProgressCopy}>
                  <span>
                    Progression du monde
                    <strong>
                      {world.completedStagesCount}/{world.totalStagesCount}
                    </strong>
                  </span>
                  <span
                    className={styles.progress}
                    role="progressbar"
                    aria-label={`Progression de ${world.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  >
                    <span style={{ width: `${progress}%` }} />
                  </span>
                </span>
              </div>

              <button
                type="button"
                className={styles.worldArrow}
                onClick={() => nextWorld && selectWorld(nextWorld)}
                disabled={!nextWorld}
                aria-label={
                  nextWorld
                    ? `Afficher le monde suivant : ${nextWorld.name}`
                    : "Aucun monde suivant"
                }
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </nav>

            {message && (
              <p className={styles.message} role="alert">
                {message}
              </p>
            )}

            <ol className={styles.stageList}>
              {world.stages.map((item, index) => {
                const point = getCampaignStagePoint(
                  world.id,
                  index,
                  world.stages.length,
                );
                const selected = item.id === stage?.id;
                const boss = index === world.stages.length - 1;

                return (
                  <li
                    key={item.id}
                    className={styles.stageItem}
                    style={{ left: `${point.left}%`, top: `${point.top}%` }}
                  >
                    <button
                      type="button"
                      className={styles.stageNode}
                      data-status={item.status.toLowerCase()}
                      data-selected={selected || undefined}
                      data-boss={boss || undefined}
                      onClick={() => setStageId(item.id)}
                      aria-label={`${item.name} - ${item.isCompleted ? "Terminée" : item.isLocked ? "Verrouillée" : "Disponible"}`}
                      aria-pressed={selected}
                    >
                      {item.isCompleted ? (
                        <Check aria-hidden="true" size={22} strokeWidth={3} />
                      ) : item.isLocked ? (
                        <Lock aria-hidden="true" size={19} />
                      ) : boss ? (
                        <Star
                          aria-hidden="true"
                          size={25}
                          fill="currentColor"
                        />
                      ) : (
                        <span>{item.stageNumber}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>

            <aside className={styles.legend} aria-label="Légende de la carte">
              <span>
                <i data-status="completed">
                  <Check aria-hidden="true" size={10} />
                </i>
                Terminé
              </span>
              <span>
                <i data-status="accessible" /> Disponible
              </span>
              <span>
                <i data-status="locked">
                  <Lock aria-hidden="true" size={9} />
                </i>
                Verrouillé
              </span>
            </aside>
          </div>
        </div>

        {stage && (
          <article className={styles.stageCard} aria-live="polite">
            <div className={styles.stageTopline}>
              <span className={styles.typePill}>{theme(world)}</span>
              <span
                className={styles.stageStatus}
                data-status={stage.status.toLowerCase()}
              >
                {stage.isCompleted ? (
                  <Check aria-hidden="true" size={14} />
                ) : stage.isLocked ? (
                  <Lock aria-hidden="true" size={14} />
                ) : (
                  <CircleDot aria-hidden="true" size={14} />
                )}
                {stage.isCompleted
                  ? "Terminée"
                  : stage.isLocked
                    ? "Verrouillée"
                    : "Disponible"}
              </span>
            </div>

            <div className={styles.stageHeading}>
              <span>Épreuve {stage.stageNumber}</span>
              <h2>{stage.name}</h2>
            </div>

            <div className={styles.trainerBlock}>
              <Image
                src={stage.trainerSprite}
                alt=""
                width={96}
                height={96}
                className={styles.stageSprite}
              />
              <div className={styles.trainerCopy}>
                <span>Adversaire</span>
                <strong>{stage.trainerName}</strong>
                <p>{stage.description}</p>
              </div>
            </div>

            <div className={styles.stageMeta}>
              <div
                className={styles.levelMeta}
                aria-label={`Niveau recommandé : ${stage.recommendedLevel}. Difficulté ${Math.min(5, Math.max(1, Math.ceil(stage.recommendedLevel / 20)))} sur 5`}
              >
                <Gauge aria-hidden="true" size={20} />
                <span>Niveau recommandé :</span>
                <strong>{stage.recommendedLevel}</strong>
              </div>
              <div className={styles.rewardRow}>
                <div
                  className={styles.moneyReward}
                  aria-label={`${stage.rewardMoney} Pokédollars`}
                >
                  <span className={styles.currencyMark} aria-hidden="true">
                    ₽
                  </span>
                  <strong>{stage.rewardMoney}</strong>
                </div>
                <div
                  className={styles.xpReward}
                  aria-label={`${stage.rewardXp} points d'expérience`}
                >
                  <Zap aria-hidden="true" size={20} />
                  <strong>+{stage.rewardXp} XP</strong>
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.fightButton}
              onClick={() => launch(stage)}
              disabled={stage.isLocked || launching !== null}
              aria-label={`${stage.isCompleted ? "Rejouer" : "Lancer le combat"} : ${stage.name}`}
            >
              {launching === stage.id ? (
                "Préparation..."
              ) : stage.isLocked ? (
                <>
                  <Lock aria-hidden="true" size={17} /> Verrouillé
                </>
              ) : (
                <>
                  <Swords aria-hidden="true" size={18} />
                  {stage.isCompleted ? "Rejouer" : "Combattre"}
                </>
              )}
            </button>
          </article>
        )}
      </div>
    </section>
  );
}
