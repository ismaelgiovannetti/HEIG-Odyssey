"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export type BattlePhase = "intro" | "turn" | "victory" | "defeat";

interface BattleCatchlinesProps {
  trainerName: string;
  trainerTitle?: string;
  trainerSprite?: string;
  introCatchline: string;
  victoryCatchline: string;
  defeatCatchline: string;
  currentPhase: BattlePhase;
  onDismiss?: () => void;
}

/**
 * Boîte de dialogue et répliques d'introduction / conclusion de combat (T-US08-02).
 */
export function BattleCatchlines({
  trainerName,
  trainerTitle,
  trainerSprite = "/sprites/trainer-player-back.png",
  introCatchline,
  victoryCatchline,
  defeatCatchline,
  currentPhase,
  onDismiss,
}: Readonly<BattleCatchlinesProps>) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Si la phase change vers intro, victory ou defeat, on affiche la réplique
    if (currentPhase !== "turn") {
      setIsVisible(true);
    }
  }, [currentPhase]);

  if (!isVisible || currentPhase === "turn") {
    return null;
  }

  let textToDisplay = introCatchline;
  let phaseBadge = "Début du combat";
  let badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/30";

  if (currentPhase === "victory") {
    // Le joueur a gagné -> Le dresseur prononce sa réplique de défaite
    textToDisplay = defeatCatchline;
    phaseBadge = "Victoire !";
    badgeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  } else if (currentPhase === "defeat") {
    // Le joueur a perdu -> Le dresseur prononce sa réplique de victoire
    textToDisplay = victoryCatchline;
    phaseBadge = "Défaite...";
    badgeColor = "bg-rose-500/20 text-rose-300 border-rose-500/30";
  }

  return (
    <div
      className="battle-catchline-overlay relative z-20 w-full max-w-2xl mx-auto my-2 p-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl shadow-2xl transition-all animate-fade-in"
      role="region"
      aria-label={`Réplique de ${trainerName}`}
    >
      <div className="flex items-start gap-4">
        {trainerSprite && (
          <div className="flex-shrink-0 w-16 h-16 relative bg-slate-800 rounded-lg p-1 border border-slate-700 overflow-hidden">
            <Image
              src={trainerSprite}
              alt={trainerName}
              fill
              className="object-contain"
              sizes="64px"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-white text-base truncate">{trainerName}</p>
              {trainerTitle && (
                <span className="text-xs text-slate-400 font-medium">({trainerTitle})</span>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${badgeColor}`}>
              {phaseBadge}
            </span>
          </div>

          <p className="text-slate-200 text-sm leading-relaxed italic">
            « {textToDisplay} »
          </p>
        </div>
      </div>

      {onDismiss && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setIsVisible(false);
              onDismiss();
            }}
            className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-600 transition"
          >
            Continuer
          </button>
        </div>
      )}
    </div>
  );
}
