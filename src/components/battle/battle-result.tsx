import {
  ArrowLeft,
  ArrowRight,
  Coins,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { BattleCatchlines } from "@/components/combat/battle-catchlines";
import type {
  BattleRewardPayload,
  BattleStartPayload,
  BattleStatePayload,
} from "@/lib/combat/battle-client";
import { formatGameInteger } from "@/lib/format-number";
import type { BattleMode } from "./battle-arena-types";

interface BattleResultProps {
  state: BattleStatePayload;
  rewards?: BattleRewardPayload;
  trainer: BattleStartPayload["trainer"];
  mode: BattleMode;
  onReturn: () => void;
  canAdvance: boolean;
  onAdvance?: () => void;
}

/** Présente uniquement les gains persistés renvoyés avec le dernier tour. */
export function BattleResult({
  state,
  rewards,
  trainer,
  mode,
  onReturn,
  canAdvance,
  onAdvance,
}: Readonly<BattleResultProps>) {
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
          victoryCatchline={
            trainer.victoryCatchline ||
            `${trainer.name} remporte cette confrontation.`
          }
          defeatCatchline={
            trainer.defeatCatchline ||
            `${trainer.name} reconnaît votre victoire.`
          }
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
                  <Coins aria-hidden="true" size={18} /> +{rewards.moneyEarned}{" "}
                  ₽
                </dd>
              </div>
              <div>
                <dt>Expérience</dt>
                <dd>
                  <Sparkles aria-hidden="true" size={18} /> +{rewards.xpEarned}{" "}
                  XP
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
                      {pokemon.name} : niv. {pokemon.oldLevel} →{" "}
                      {pokemon.newLevel}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="battle-result__missing">
            Le résultat est terminé, mais le récapitulatif des gains n’est pas
            disponible. Revenez à l’espace précédent pour actualiser vos
            données.
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
