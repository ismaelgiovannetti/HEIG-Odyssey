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
 * Réplique d'introduction / conclusion du dresseur adverse.
 *
 * Les répliques suivent le point de vue du joueur, comme les libellés le
 * suggèrent : `victoryCatchline` s'affiche quand le joueur l'emporte,
 * `defeatCatchline` quand il perd.
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
    if (currentPhase !== "turn") {
      setIsVisible(true);
    }
  }, [currentPhase]);

  if (!isVisible || currentPhase === "turn") {
    return null;
  }

  let textToDisplay = introCatchline;
  let phaseBadge = "Début du combat";
  let tone: "intro" | "victory" | "defeat" = "intro";

  if (currentPhase === "victory") {
    textToDisplay = victoryCatchline;
    phaseBadge = "Victoire !";
    tone = "victory";
  } else if (currentPhase === "defeat") {
    textToDisplay = defeatCatchline;
    phaseBadge = "Défaite…";
    tone = "defeat";
  }

  return (
    <div
      className={`battle-catchline battle-catchline--${tone}`}
      role="region"
      aria-label={`Réplique de ${trainerName}`}
    >
      {trainerSprite && (
        <div className="battle-catchline__portrait" aria-hidden="true">
          <Image
            src={trainerSprite}
            alt=""
            width={72}
            height={72}
            className="battle-catchline__portrait-img"
          />
        </div>
      )}

      <div className="battle-catchline__body">
        <div className="battle-catchline__head">
          <p className="battle-catchline__name">
            {trainerName}
            {trainerTitle && (
              <span className="battle-catchline__title"> · {trainerTitle}</span>
            )}
          </p>
          <span className="battle-catchline__badge">{phaseBadge}</span>
        </div>

        <p className="battle-catchline__quote">« {textToDisplay} »</p>

        {onDismiss && (
          <button
            type="button"
            className="battle-quiet-button battle-catchline__dismiss"
            onClick={() => {
              setIsVisible(false);
              onDismiss();
            }}
          >
            Continuer
          </button>
        )}
      </div>
    </div>
  );
}
