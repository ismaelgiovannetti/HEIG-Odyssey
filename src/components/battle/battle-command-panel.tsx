import { ArrowLeft, RefreshCw, UsersRound } from "lucide-react";
import { SpriteProvider } from "@/components/pokemon/sprite-provider";
import type {
  BattlePokemonPayload,
  BattleStatePayload,
} from "@/lib/combat/battle-client";
import { getMoveFrenchName } from "@/lib/pokemon/move-names-fr";
import { getSpeciesFrenchName } from "@/lib/pokemon/species-names-fr";
import { getPokemonTypeLabel } from "@/lib/pokemon/type-presentation";
import type { PlayerAction } from "./battle-arena-types";

interface BattleCommandPanelProps {
  state: BattleStatePayload;
  player: BattlePokemonPayload;
  currentMessage: string;
  isAnimating: boolean;
  error: string;
  pending: boolean;
  switchRequired: boolean;
  showTeam: boolean;
  controlsDisabled: boolean;
  onSubmitAction: (action: PlayerAction) => Promise<void>;
  onToggleTeam: () => void;
  onReturn: () => void;
}

/** Choix des attaques et remplacements, indépendant de la résolution serveur. */
export function BattleCommandPanel({
  state,
  player,
  currentMessage,
  isAnimating,
  error,
  pending,
  switchRequired,
  showTeam,
  controlsDisabled,
  onSubmitAction,
  onToggleTeam,
  onReturn,
}: Readonly<BattleCommandPanelProps>) {
  return (
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
          <span>
            {switchRequired ? "Remplacement requis" : "À vous de jouer"}
          </span>
          <strong>
            {switchRequired
              ? "Choisissez un Pokémon apte"
              : `Que doit faire ${
                  player.nickname ||
                  getSpeciesFrenchName(player.speciesId, player.name)
                } ?`}
          </strong>
        </div>
        <span>
          {state.p1.team.filter((pokemon) => !pokemon.isFainted).length}/
          {state.p1.team.length} disponibles
        </span>
      </div>

      {!showTeam && !switchRequired ? (
        <div className="battle-moves">
          {player.moves.map((move, index) => (
            <button
              key={`${move.id}-${index}`}
              type="button"
              data-type={move.type}
              disabled={controlsDisabled || move.disabled || move.pp === 0}
              onClick={() =>
                void onSubmitAction({ type: "move", moveIndex: index })
              }
            >
              <strong>{getMoveFrenchName(move.id, move.name)}</strong>
              <span>
                {getPokemonTypeLabel(move.type)} · {move.pp}/{move.maxPp} PP
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="battle-switches">
          {state.p1.team.map((pokemon, index) => {
            const switchName =
              pokemon.nickname ||
              getSpeciesFrenchName(pokemon.speciesId, pokemon.name);

            return (
              <button
                key={pokemon.id}
                type="button"
                disabled={
                  controlsDisabled || pokemon.isActive || pokemon.isFainted
                }
                onClick={() =>
                  void onSubmitAction({
                    type: "switch",
                    targetPokemonIndex: index,
                  })
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
            onClick={onToggleTeam}
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
  );
}
