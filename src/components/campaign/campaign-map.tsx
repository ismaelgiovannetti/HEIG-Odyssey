"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Lock,
  Play,
  Swords,
  Coins,
  Sparkles,
  Info,
  ChevronRight,
  GraduationCap,
  Award,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type {
  CampaignProgressOverview,
  CampaignWorldView,
  CampaignStageView,
} from "@/lib/campaign/campaign-service";

interface CampaignMapProps {
  overview: CampaignProgressOverview;
}

export function CampaignMap({ overview }: Readonly<CampaignMapProps>) {
  const [selectedWorldId, setSelectedWorldId] = useState<string>(
    overview.currentWorldId,
  );
  const [launchingStageId, setLaunchingStageId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [activeBattleData, setActiveBattleData] = useState<{
    battleId: string;
    trainer: {
      name: string;
      title: string;
      sprite: string;
      introCatchline: string;
    };
  } | null>(null);

  const selectedWorld: CampaignWorldView =
    overview.worlds.find((w) => w.id === selectedWorldId) ??
    overview.worlds[0];

  const handleLaunchBattle = async (stage: CampaignStageView) => {
    if (stage.isLocked || launchingStageId) return;

    setLaunchingStageId(stage.id);
    setLaunchError(null);

    try {
      const response = await fetch("/api/battle/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: stage.id }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setLaunchError(
          data.error ??
            "Impossible de lancer le combat. Vérifiez votre équipe active.",
        );
        setLaunchingStageId(null);
        return;
      }

      setActiveBattleData({
        battleId: data.battleId,
        trainer: data.trainer,
      });
    } catch {
      setLaunchError(
        "Une erreur de communication est survenue lors du démarrage du combat.",
      );
    } finally {
      setLaunchingStageId(null);
    }
  };

  const getDegreeLabel = (degree: string) => {
    switch (degree) {
      case "BACHELOR":
        return "Cursus Bachelor";
      case "MASTER":
        return "Spécialisation Master";
      case "DOCTORAT":
        return "Endgame Doctorat";
      default:
        return degree;
    }
  };

  return (
    <div className="campaign-container">
      {/* En-tête global de campagne */}
      <header className="campaign-header">
        <div className="campaign-header__info">
          <p className="campaign-header__eyebrow">
            <GraduationCap aria-hidden="true" size={18} />
            Aventure principale — 8 Mondes
          </p>
          <h1 className="campaign-header__title">Progression de la Campagne</h1>
          <p className="campaign-header__subtitle">
            Progressez à travers les mondes académiques, relevez les épreuves et
            préparez votre équipe pour le Doctorat.
          </p>
        </div>

        <div
          className="campaign-header__stats"
          aria-label="Statistiques globales de progression"
        >
          <div className="campaign-stat-badge">
            <Award aria-hidden="true" size={20} className="text-amber-400" />
            <div>
              <strong>
                {overview.totalCompletedStages} / {overview.totalStages}
              </strong>
              <span>Étapes validées</span>
            </div>
          </div>
        </div>
      </header>

      {/* Message d'erreur de lancement */}
      {launchError && (
        <div
          className="campaign-alert campaign-alert--error"
          role="alert"
          tabIndex={-1}
        >
          <AlertTriangle aria-hidden="true" size={20} />
          <div>
            <strong>Erreur de lancement</strong>
            <p>{launchError}</p>
          </div>
        </div>
      )}

      {/* Confirmation visuelle de lancement réussi */}
      {activeBattleData && (
        <div
          className="campaign-alert campaign-alert--success"
          role="status"
          aria-live="polite"
        >
          <Swords aria-hidden="true" size={24} />
          <div>
            <strong>
              Combat initialisé contre {activeBattleData.trainer.name} !
            </strong>
            <p className="text-sm opacity-90">
              « {activeBattleData.trainer.introCatchline} »
            </p>
            <p className="text-xs mt-1 text-emerald-300">
              ID de combat : {activeBattleData.battleId} (Session enregistrée)
            </p>
          </div>
        </div>
      )}

      {/* Navigation entre les 8 mondes */}
      <nav
        className="campaign-worlds-nav"
        aria-label="Navigation entre les mondes de la campagne"
      >
        <ol className="campaign-worlds-list">
          {overview.worlds.map((world, index) => {
            const isSelected = world.id === selectedWorldId;

            return (
              <li key={world.id}>
                <button
                  type="button"
                  className={`campaign-world-tab ${
                    isSelected ? "is-active" : ""
                  } ${world.isCompleted ? "is-completed" : ""} ${
                    world.isLocked ? "is-locked" : ""
                  }`}
                  onClick={() => {
                    setSelectedWorldId(world.id);
                    setLaunchError(null);
                  }}
                  aria-current={isSelected ? "page" : undefined}
                  aria-label={`${world.name} (${
                    world.completedStagesCount
                  }/${world.totalStagesCount} terminées)${
                    world.isLocked ? " - Verrouillé" : ""
                  }`}
                >
                  <span className="campaign-world-tab__number">
                    {index + 1}
                  </span>
                  <span className="campaign-world-tab__info">
                    <strong className="campaign-world-tab__name">
                      {world.name.split(" - ")[0]}
                    </strong>
                    <span className="campaign-world-tab__count">
                      {world.isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 size={13} aria-hidden="true" />
                          Terminé
                        </span>
                      ) : world.isLocked ? (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Lock size={13} aria-hidden="true" />
                          Verrouillé
                        </span>
                      ) : (
                        <span>
                          {world.completedStagesCount} / {world.totalStagesCount}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Détail du monde sélectionné */}
      <section
        className="campaign-world-detail"
        aria-labelledby="selected-world-heading"
      >
        <div className="campaign-world-banner">
          <div className="campaign-world-banner__header">
            <div>
              <span className="campaign-world-banner__degree">
                {getDegreeLabel(selectedWorld.degree)}
              </span>
              <h2
                id="selected-world-heading"
                className="campaign-world-banner__title"
              >
                {selectedWorld.name}
              </h2>
            </div>

            <div className="campaign-world-banner__progress-badge">
              <strong>
                {selectedWorld.completedStagesCount} /{" "}
                {selectedWorld.totalStagesCount}
              </strong>
              <span>Épreuves réussies</span>
            </div>
          </div>

          <p className="campaign-world-banner__desc">
            {selectedWorld.description}
          </p>

          {/* Barre de progression du monde */}
          <div
            className="campaign-progress-bar"
            role="progressbar"
            aria-valuenow={selectedWorld.completedStagesCount}
            aria-valuemin={0}
            aria-valuemax={selectedWorld.totalStagesCount}
            aria-label={`Progression dans ${selectedWorld.name}`}
          >
            <div
              className="campaign-progress-bar__fill"
              style={{
                width: `${
                  (selectedWorld.completedStagesCount /
                    selectedWorld.totalStagesCount) *
                  100
                }%`,
              }}
            />
          </div>
        </div>

        {/* Liste des étapes / combats du monde */}
        <div className="campaign-stages-container">
          <h3 className="campaign-stages-heading">
            Épreuves et Dresseurs à affronter
          </h3>

          <ol className="campaign-stages-list">
            {selectedWorld.stages.map((stage) => {
              const isLaunching = launchingStageId === stage.id;

              return (
                <li key={stage.id} className="campaign-stage-item">
                  <article
                    className={`campaign-stage-card ${
                      stage.isCompleted ? "is-completed" : ""
                    } ${stage.status === "ACCESSIBLE" ? "is-accessible" : ""} ${
                      stage.isLocked ? "is-locked" : ""
                    }`}
                    aria-labelledby={`stage-title-${stage.id}`}
                  >
                    {/* Badge d'étape */}
                    <div className="campaign-stage-card__number">
                      <span>{stage.stageNumber}</span>
                    </div>

                    {/* Avatar de l'adversaire */}
                    <div className="campaign-stage-card__avatar">
                      <Image
                        src={stage.trainerSprite}
                        alt={`Sprite de ${stage.trainerName}`}
                        width={64}
                        height={64}
                        className="campaign-stage-card__sprite"
                      />
                    </div>

                    {/* Contenu et informations de l'étape */}
                    <div className="campaign-stage-card__content">
                      <div className="campaign-stage-card__header">
                        <div>
                          <h4
                            id={`stage-title-${stage.id}`}
                            className="campaign-stage-card__title"
                          >
                            {stage.name}
                          </h4>
                          <p className="campaign-stage-card__trainer-title">
                            {stage.trainerName} — {stage.trainerTitle}
                          </p>
                        </div>

                        {/* Statut visuel de l'étape */}
                        <div className="campaign-stage-card__status-badge">
                          {stage.status === "COMPLETED" && (
                            <span className="badge badge--completed">
                              <CheckCircle2 size={15} aria-hidden="true" />
                              Victoire validée
                            </span>
                          )}
                          {stage.status === "ACCESSIBLE" && (
                            <span className="badge badge--accessible">
                              <Play size={14} aria-hidden="true" />
                              Disponible
                            </span>
                          )}
                          {stage.status === "LOCKED" && (
                            <span className="badge badge--locked">
                              <Lock size={14} aria-hidden="true" />
                              Verrouillé
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="campaign-stage-card__description">
                        {stage.description}
                      </p>

                      {/* Métadonnées : Niveau recommandé (informatif) et Récompenses */}
                      <div className="campaign-stage-card__meta">
                        <div
                          className="campaign-meta-pill campaign-meta-pill--level"
                          title="Niveau suggéré pour votre équipe active. Purement informatif, ne bloque pas le combat."
                        >
                          <Info size={15} aria-hidden="true" />
                          <span>
                            Niveau recommandé :{" "}
                            <strong>{stage.recommendedLevel}</strong>
                          </span>
                          <span className="campaign-meta-pill__sub">
                            (non-bloquant)
                          </span>
                        </div>

                        <div className="campaign-meta-pill campaign-meta-pill--rewards">
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <Coins size={14} aria-hidden="true" />
                            <strong>{stage.rewardMoney}</strong> ₽
                          </span>
                          <span className="inline-flex items-center gap-1 text-cyan-300">
                            <Sparkles size={14} aria-hidden="true" />
                            <strong>{stage.rewardXp}</strong> XP
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action de combat */}
                    <div className="campaign-stage-card__action">
                      {stage.isLocked ? (
                        <button
                          type="button"
                          className="campaign-btn campaign-btn--locked"
                          disabled
                          aria-disabled="true"
                        >
                          <Lock size={16} aria-hidden="true" />
                          <span>Verrouillé</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`campaign-btn ${
                            stage.isCompleted
                              ? "campaign-btn--replay"
                              : "campaign-btn--primary"
                          }`}
                          onClick={() => handleLaunchBattle(stage)}
                          disabled={isLaunching}
                          aria-label={`${
                            stage.isCompleted ? "Rejouer" : "Lancer le combat"
                          } : ${stage.name}`}
                        >
                          {isLaunching ? (
                            <>
                              <Loader2
                                size={16}
                                className="animate-spin"
                                aria-hidden="true"
                              />
                              <span>Préparation...</span>
                            </>
                          ) : (
                            <>
                              <Swords size={16} aria-hidden="true" />
                              <span>
                                {stage.isCompleted
                                  ? "Rejouer"
                                  : "Défier l'adversaire"}
                              </span>
                              <ChevronRight size={16} aria-hidden="true" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </div>
  );
}
