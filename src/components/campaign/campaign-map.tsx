"use client";

import { useState } from "react";
import { Check, Lock, Loader2, Star } from "lucide-react";

import type {
  CampaignProgressOverview,
  CampaignStageView,
  CampaignWorldView,
} from "@/lib/campaign/campaign-service";

interface CampaignMapProps {
  overview: CampaignProgressOverview;
}

// Le tracé alterne volontairement les hauteurs pour rappeler le parcours du
// mockup tout en restant lisible quel que soit le nombre d'étapes du monde.
const STAGE_POSITIONS = [
  { left: 11, top: 72 },
  { left: 33, top: 31 },
  { left: 40, top: 69 },
  { left: 58, top: 29 },
  { left: 76, top: 68 },
  { left: 89, top: 20 },
] as const;

function getStagePosition(index: number, total: number) {
  const predefinedPosition = STAGE_POSITIONS[index];
  if (predefinedPosition) return predefinedPosition;

  // Les mondes plus longs prolongent la courbe sans superposer les nœuds.
  const progress = total <= 1 ? 0.5 : index / (total - 1);
  return { left: 8 + progress * 84, top: index % 2 === 0 ? 70 : 28 };
}

/**
 * Carte interactive de la campagne. Les mondes changent la région affichée et
 * les étapes conservent les trois états du mockup : terminée, active et bloquée.
 */
export function CampaignMap({ overview }: Readonly<CampaignMapProps>) {
  const [selectedWorldId, setSelectedWorldId] = useState(overview.currentWorldId);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(
    overview.nextRecommendedStage?.id ?? null,
  );
  const [launchingStageId, setLaunchingStageId] = useState<string | null>(null);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

  const selectedWorld: CampaignWorldView =
    overview.worlds.find((world) => world.id === selectedWorldId) ?? overview.worlds[0];
  const selectedStage =
    selectedWorld.stages.find((stage) => stage.id === selectedStageId) ??
    selectedWorld.stages.find((stage) => stage.status === "ACCESSIBLE") ??
    selectedWorld.stages[0];

  const selectWorld = (world: CampaignWorldView) => {
    setSelectedWorldId(world.id);
    setSelectedStageId(
      world.stages.find((stage) => stage.status === "ACCESSIBLE")?.id ??
        world.stages[0]?.id ??
        null,
    );
    setLaunchMessage(null);
  };

  const handleLaunchBattle = async (stage: CampaignStageView) => {
    if (stage.isLocked || launchingStageId) return;

    setLaunchingStageId(stage.id);
    setLaunchMessage(null);

    try {
      const response = await fetch("/api/battle/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: stage.id }),
      });
      const data = await response.json();

      setLaunchMessage(
        response.ok && data.success
          ? `Combat initialisé contre ${data.trainer.name} !`
          : data.error ?? "Impossible de lancer le combat. Vérifiez votre équipe active.",
      );
    } catch {
      // Le message reste volontairement générique : aucun détail réseau n'est
      // exposé dans l'interface du joueur.
      setLaunchMessage(
        "Une erreur de communication est survenue lors du démarrage du combat.",
      );
    } finally {
      setLaunchingStageId(null);
    }
  };

  return (
    <section className="campaign-container" aria-labelledby="campaign-title">
      <h1 id="campaign-title" className="campaign-title">
        Campagne - {selectedWorld.name.split(" - ")[0]}
      </h1>

      <div className="campaign-panel">
        <nav className="campaign-worlds-nav" aria-label="Navigation entre les mondes de la campagne">
          <span className="campaign-worlds-label">
            {selectedWorld.name.split(" - ")[0]} - ...
          </span>
          <ol className="campaign-worlds-list">
            {overview.worlds.map((world, index) => (
              <li key={world.id}>
                <button
                  type="button"
                  className={`campaign-world-tab ${world.id === selectedWorldId ? "is-active" : ""} ${world.isCompleted ? "is-completed" : ""}`}
                  onClick={() => selectWorld(world)}
                  aria-current={world.id === selectedWorldId ? "page" : undefined}
                  aria-label={`${world.name} (${world.completedStagesCount}/${world.totalStagesCount} terminées)${world.isLocked ? " - Verrouillé" : ""}`}
                >
                  {index + 1}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {launchMessage && <p className="campaign-message" role="status">{launchMessage}</p>}

        <div className="campaign-map" aria-label={`Étapes de ${selectedWorld.name}`}>
          <ol className="campaign-stages-list">
            {selectedWorld.stages.map((stage, index) => {
              const position = getStagePosition(index, selectedWorld.stages.length);
              const isSelected = stage.id === selectedStage?.id;

              return (
                <li
                  key={stage.id}
                  className="campaign-stage-item"
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                >
                  <button
                    type="button"
                    className={`campaign-stage-node is-${stage.status.toLowerCase()} ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setSelectedStageId(stage.id)}
                    aria-label={`${stage.name} - ${stage.isCompleted ? "Terminée" : stage.isLocked ? "Verrouillée" : "Disponible"}`}
                    aria-pressed={isSelected}
                  >
                    {stage.isCompleted ? (
                      <Check aria-hidden="true" size={22} strokeWidth={2.5} />
                    ) : stage.isLocked ? (
                      <Lock aria-hidden="true" size={21} />
                    ) : stage.stageNumber === selectedWorld.stages.length ? (
                      <Star aria-hidden="true" size={25} />
                    ) : (
                      <span>{stage.stageNumber}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          {selectedStage && (
            <article className="campaign-stage-card" aria-live="polite">
              <h2>{selectedStage.name}</h2>
              <p>Adversaire: <strong>{selectedStage.trainerName}</strong></p>
              <p>
                Type: <span className="campaign-type-pill">
                  {selectedWorld.name.split(" - ")[1] ?? selectedWorld.degree}
                </span>
              </p>
              <p className="campaign-difficulty" aria-label={`Difficulté ${Math.min(5, Math.max(1, Math.ceil(selectedStage.recommendedLevel / 20)))} sur 5`}>
                Difficulté: <span aria-hidden="true">☆ ☆ ☆ ☆ ☆</span>
              </p>
              <button
                type="button"
                className="campaign-fight-button"
                onClick={() => handleLaunchBattle(selectedStage)}
                disabled={selectedStage.isLocked || launchingStageId !== null}
                aria-label={`${selectedStage.isCompleted ? "Rejouer" : "Lancer le combat"} : ${selectedStage.name}`}
              >
                {launchingStageId === selectedStage.id ? (
                  <><Loader2 aria-hidden="true" size={16} className="animate-spin" />Préparation...</>
                ) : selectedStage.isLocked ? "Verrouillé" : selectedStage.isCompleted ? "Rejouer" : "Combattre"}
              </button>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
