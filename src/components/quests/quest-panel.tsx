"use client";

import {
  CalendarRange,
  Clock3,
  Coins,
  Diamond,
  RefreshCw,
  Sparkles,
  Sunrise,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface QuestItem {
  rotationId: string;
  questId: string;
  title: string;
  description: string;
  type: "DAILY" | "WEEKLY";
  targetCount: number;
  currentCount: number;
  isCompleted: boolean;
  rewardClaimed: boolean;
  rewardPokedollars: number;
  rewardXp: number;
  endDate: string;
}

interface QuestsState {
  dailyQuests: QuestItem[];
  weeklyQuests: QuestItem[];
}

interface QuestsResponse {
  success: boolean;
  data?: QuestsState;
  error?: string;
}

interface QuestGroupProps {
  id: string;
  title: string;
  icon: LucideIcon;
  quests: QuestItem[];
  now: number;
  claimingRotationId: string | null;
  onClaim: (rotationId: string) => Promise<void>;
}

const GENERIC_LOAD_ERROR =
  "Impossible de charger les missions pour le moment. Réessayez dans quelques instants.";
const GENERIC_CLAIM_ERROR =
  "La récompense n’a pas pu être récupérée. Votre progression reste enregistrée.";

/** Transforme la date de fin de rotation en durée courte côté navigateur. */
function formatTimeRemaining(endDate: string, now: number): string {
  const remainingMilliseconds = new Date(endDate).getTime() - now;

  if (!Number.isFinite(remainingMilliseconds) || remainingMilliseconds <= 0) {
    return "Rotation terminée";
  }

  const totalMinutes = Math.ceil(remainingMilliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} j ${hours} h restantes`;
  if (hours > 0) return `${hours} h ${minutes} min restantes`;
  return `${minutes} min restantes`;
}

/** Signale visuellement une rotation expirée ou arrivant à échéance dans moins d'une heure. */
function isTimeRemainingUrgent(endDate: string, now: number): boolean {
  const remainingMilliseconds = new Date(endDate).getTime() - now;
  return !Number.isFinite(remainingMilliseconds) || remainingMilliseconds < 60 * 60_000;
}

function getQuestClassName(quest: QuestItem) {
  if (quest.rewardClaimed) return "is-claimed";
  if (quest.isCompleted) return "is-completed";
  return "is-active";
}

/** Une carte affiche uniquement la progression renvoyée pour le joueur connecté. */
function QuestCard({
  quest,
  claimingRotationId,
  onClaim,
}: Readonly<{
  quest: QuestItem;
  claimingRotationId: string | null;
  onClaim: (rotationId: string) => Promise<void>;
}>) {
  const currentCount = Math.min(Math.max(quest.currentCount, 0), quest.targetCount);
  const progress = quest.targetCount > 0 ? (currentCount / quest.targetCount) * 100 : 0;
  const statusClassName = getQuestClassName(quest);
  const isClaiming = claimingRotationId === quest.rotationId;

  return (
    <article className={`quest-card ${statusClassName}`}>
      <div className="quest-card__heading">
        <div>
          <h4>{quest.title}</h4>
          <p>{quest.description}</p>
        </div>
      </div>

      <div className="quest-card__progress-line">
        <div
          className="quest-card__progress"
          role="progressbar"
          aria-label={`Progression de ${quest.title}`}
          aria-valuemin={0}
          aria-valuemax={quest.targetCount}
          aria-valuenow={currentCount}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <strong>{currentCount}/{quest.targetCount}</strong>
      </div>

      <div className="quest-card__footer">
        <div className="quest-card__rewards" aria-label="Récompenses">
          <span title="Pokédollars">
            <Coins aria-hidden="true" size={14} />
            {quest.rewardPokedollars} ₽
          </span>
          <span title="Expérience">
            <Sparkles aria-hidden="true" size={14} />
            {quest.rewardXp} XP
          </span>
        </div>

        {quest.isCompleted && !quest.rewardClaimed ? (
          <button
            className="quest-card__claim"
            type="button"
            disabled={claimingRotationId !== null}
            onClick={() => void onClaim(quest.rotationId)}
          >
            {isClaiming ? (
              <RefreshCw aria-hidden="true" className="is-spinning" size={14} />
            ) : (
              <Trophy aria-hidden="true" size={14} />
            )}
            {isClaiming ? "Récupération…" : "Récupérer"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function QuestGroup({
  id,
  title,
  icon: Icon,
  quests,
  now,
  claimingRotationId,
  onClaim,
}: Readonly<QuestGroupProps>) {
  const completedCount = quests.filter((quest) => quest.isCompleted).length;
  const endDate = quests[0]?.endDate;
  const remainingClassName = endDate && isTimeRemainingUrgent(endDate, now)
    ? "quest-group__remaining is-urgent"
    : "quest-group__remaining";
  // Les objectifs encore actifs restent prioritaires. Une mission terminée
  // descend automatiquement sous celles qu'il reste à accomplir.
  const orderedQuests = [...quests].sort(
    (first, second) => Number(first.isCompleted) - Number(second.isCompleted),
  );

  return (
    <section className="quest-group" aria-labelledby={id}>
      <header className="quest-group__header">
        <span className="quest-group__icon" aria-hidden="true"><Icon size={22} /></span>
        <div>
          <h3 id={id}>{title}</h3>
          <p className={remainingClassName}>
            <Clock3 aria-hidden="true" size={13} />
            {endDate ? formatTimeRemaining(endDate, now) : "Aucune rotation active"}
          </p>
        </div>
        <span className="quest-group__summary">{completedCount}/{quests.length}</span>
      </header>

      <div className="quest-group__list">
        {orderedQuests.length > 0 ? orderedQuests.map((quest) => (
          <QuestCard
            key={quest.rotationId}
            quest={quest}
            claimingRotationId={claimingRotationId}
            onClaim={onClaim}
          />
        )) : (
          <p className="quest-group__empty">Aucune mission disponible pour cette rotation.</p>
        )}
      </div>
    </section>
  );
}

/**
 * Bouton compact et panneau de missions communs à tous les espaces du jeu.
 * Un rechargement sans cache garantit les rotations du compte courant.
 */
export function QuestPanel() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const claimInFlightRef = useRef(false);
  const loadedAtRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [quests, setQuests] = useState<QuestsState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [claimingRotationId, setClaimingRotationId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const progressSummary = useMemo(() => {
    const allQuests = quests ? [...quests.dailyQuests, ...quests.weeklyQuests] : [];
    return {
      completed: allQuests.filter((quest) => quest.isCompleted).length,
      total: allQuests.length,
    };
  }, [quests]);

  const loadQuests = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/quests", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as QuestsResponse | null;

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || GENERIC_LOAD_ERROR);
      }

      setQuests(payload.data);
      loadedAtRef.current = Date.now();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : GENERIC_LOAD_ERROR);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  // Le premier chargement alimente le compteur compact avant l'ouverture.
  useEffect(() => {
    void loadQuests();
    return () => requestRef.current?.abort();
  }, [loadQuests]);

  useEffect(() => {
    if (!isOpen) return;
    setNow(Date.now());
    if (Date.now() - loadedAtRef.current > 30_000) void loadQuests();

    const timer = window.setInterval(() => setNow(Date.now()), 60_000);

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, loadQuests]);

  async function claimReward(rotationId: string) {
    // La référence verrouille immédiatement l'action, avant le prochain rendu React.
    // Elle évite que deux clics très rapprochés envoient deux requêtes identiques.
    if (claimInFlightRef.current) return;
    claimInFlightRef.current = true;
    setClaimingRotationId(rotationId);
    setError(null);
    setAnnouncement("");

    try {
      const response = await fetch("/api/quests/claim", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ rotationId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { success: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || GENERIC_CLAIM_ERROR);
      }

      // Mise à jour immédiate de la carte puis synchronisation du solde serveur.
      setQuests((current) => {
        if (!current) return current;
        const markAsClaimed = (quest: QuestItem) =>
          quest.rotationId === rotationId ? { ...quest, rewardClaimed: true } : quest;
        return {
          dailyQuests: current.dailyQuests.map(markAsClaimed),
          weeklyQuests: current.weeklyQuests.map(markAsClaimed),
        };
      });
      setAnnouncement("Récompense récupérée. Votre solde a été mis à jour.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : GENERIC_CLAIM_ERROR);
    } finally {
      claimInFlightRef.current = false;
      setClaimingRotationId(null);
    }
  }

  const counterText = quests
    ? `${progressSummary.completed}/${progressSummary.total}`
    : "–/–";

  return (
    <div className="quest-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        className={isOpen ? "quest-menu__trigger is-open" : "quest-menu__trigger"}
        type="button"
        title="Missions"
        aria-label={`Missions : ${counterText} terminées`}
        aria-expanded={isOpen}
        aria-controls="quest-panel"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Diamond aria-hidden="true" size={11} />
        <strong>{counterText}</strong>
      </button>

      {isOpen ? (
        <div
          className="quest-panel"
          id="quest-panel"
          role="region"
          aria-label="Missions quotidiennes et hebdomadaires"
        >
          <p className="visually-hidden" aria-live="polite">{announcement}</p>

          {error ? (
            <div className="quest-panel__error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => void loadQuests()}>
                <RefreshCw aria-hidden="true" size={14} />
                Réessayer
              </button>
            </div>
          ) : null}

          {isLoading && !quests ? (
            <div className="quest-panel__loading" role="status">
              <RefreshCw aria-hidden="true" className="is-spinning" size={24} />
              Chargement des missions…
            </div>
          ) : null}

          {quests ? (
            <div className="quest-panel__groups">
              <QuestGroup
                id="daily-quests-title"
                title="Quotidiennes"
                icon={Sunrise}
                quests={quests.dailyQuests}
                now={now}
                claimingRotationId={claimingRotationId}
                onClaim={claimReward}
              />
              <QuestGroup
                id="weekly-quests-title"
                title="Hebdomadaires"
                icon={CalendarRange}
                quests={quests.weeklyQuests}
                now={now}
                claimingRotationId={claimingRotationId}
                onClaim={claimReward}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
