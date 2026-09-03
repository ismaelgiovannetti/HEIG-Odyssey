import { SpriteProvider } from "@/components/pokemon/sprite-provider";
import type {
  BattlePokemonPayload,
  BattleStartPayload,
} from "@/lib/combat/battle-client";
import type { OpponentIntroPhase } from "./battle-arena-types";
import { PokemonStatus, type HpOverride } from "./battle-pokemon-status";

interface CombatantPresentation {
  pokemon: BattlePokemonPayload;
  hpOverride: HpOverride | null;
  statusOverride: string | null | undefined;
  animation: string;
  hideField: boolean;
}

interface BattleSceneProps {
  arena: string;
  trainer: BattleStartPayload["trainer"];
  introTrainerUrl: string | null;
  opponentIntro: OpponentIntroPhase;
  introPlaying: boolean;
  player: CombatantPresentation;
  opponent: CombatantPresentation;
}

function StatusOverlay({ status }: Readonly<{ status: string }>) {
  return (
    <div
      className={`status-overlay status-overlay--${status}`}
      aria-hidden="true"
    >
      {status === "par" && "⚡"}
      {status === "slp" && "💤"}
      {status === "brn" && "🔥"}
      {(status === "psn" || status === "tox") && "☠️"}
      {status === "frz" && "❄️"}
    </div>
  );
}

/** Terrain et combattants, sans logique réseau ni orchestration du tour. */
export function BattleScene({
  arena,
  trainer,
  introTrainerUrl,
  opponentIntro,
  introPlaying,
  player,
  opponent,
}: Readonly<BattleSceneProps>) {
  const effectiveOpponentStatus =
    opponent.statusOverride !== undefined
      ? opponent.statusOverride
      : opponent.pokemon.status;
  const effectivePlayerStatus =
    player.statusOverride !== undefined
      ? player.statusOverride
      : player.pokemon.status;

  return (
    <div
      className="battle-scene"
      aria-label="Arène de combat"
      data-arena={arena}
    >
      <div className="battle-combatant battle-combatant--opponent">
        <PokemonStatus
          pokemon={opponent.pokemon}
          hpOverride={opponent.hpOverride}
          statusOverride={opponent.statusOverride}
          className={introPlaying ? "is-intro-hidden" : ""}
        />
        <div className="battle-combatant__stage">
          <div className="battle-combatant__platform" aria-hidden="true" />
          {opponentIntro !== "pokemon" && introTrainerUrl && (
            <div
              className={`battle-combatant__trainer ${
                opponentIntro === "leaving" ? "is-trainer-leaving" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={introTrainerUrl}
                alt={trainer.name}
                width={210}
                height={210}
              />
            </div>
          )}
          <div
            className={`battle-combatant__sprite ${opponent.animation} ${
              opponent.hideField ? "is-fainted-hidden" : ""
            } ${introPlaying ? "is-intro-hidden" : ""}`}
          >
            {effectiveOpponentStatus && (
              <StatusOverlay status={effectiveOpponentStatus} />
            )}
            <SpriteProvider
              speciesId={opponent.pokemon.speciesId}
              variant={opponent.pokemon.isShiny ? "front_shiny" : "front"}
              alt={opponent.pokemon.nickname || opponent.pokemon.name}
              width={176}
              height={176}
              normalizeVisibleSize
              priority
            />
          </div>
        </div>
      </div>

      <div className="battle-combatant battle-combatant--player">
        <div className="battle-combatant__stage">
          <div className="battle-combatant__platform" aria-hidden="true" />
          <div
            className={`battle-combatant__sprite ${player.animation} ${
              player.hideField ? "is-fainted-hidden" : ""
            } ${introPlaying ? "is-intro-hidden" : ""}`}
          >
            {effectivePlayerStatus && (
              <StatusOverlay status={effectivePlayerStatus} />
            )}
            <SpriteProvider
              speciesId={player.pokemon.speciesId}
              variant={player.pokemon.isShiny ? "back_shiny" : "back"}
              alt={player.pokemon.nickname || player.pokemon.name}
              width={190}
              height={190}
              normalizeVisibleSize
              priority
            />
          </div>
        </div>
        <PokemonStatus
          pokemon={player.pokemon}
          hpOverride={player.hpOverride}
          statusOverride={player.statusOverride}
          className={introPlaying ? "is-intro-hidden" : ""}
        />
      </div>
    </div>
  );
}
