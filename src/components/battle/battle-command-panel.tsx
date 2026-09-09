import { useEffect, useRef } from "react";
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
import {
  GAMEPAD_EVENTS,
  type GamepadActionEventDetail,
} from "@/lib/gamepad/gamepad-types";

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
  const movesContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-focus le premier bouton disponible lorsque le tour commence
  useEffect(() => {
    if (controlsDisabled || isAnimating) return;
    const firstActiveButton =
      movesContainerRef.current?.querySelector<HTMLButtonElement>(
        "button:not([disabled])",
      );
    if (firstActiveButton) {
      firstActiveButton.focus({ preventScroll: true });
    }
  }, [controlsDisabled, isAnimating, showTeam, switchRequired]);

  // Écoute des commandes de manette Xbox dans le combat
  useEffect(() => {
    const onGamepadAction = (e: Event) => {
      const custom = e as CustomEvent<GamepadActionEventDetail>;
      const action = custom.detail?.action;
      if (controlsDisabled) return;

      // X ou LB/RB : bascule entre attaques et banc Pokémon
      if (
        action === "context" ||
        action === "prev_tab" ||
        action === "next_tab"
      ) {
        if (!switchRequired && state.p1.team.length >= 2) {
          custom.preventDefault();
          onToggleTeam();
        }
      } else if (action === "cancel") {
        custom.preventDefault();
        if (showTeam && !switchRequired) {
          onToggleTeam();
        } else if (!showTeam) {
          onReturn();
        }
      }
    };

    window.addEventListener(GAMEPAD_EVENTS.ACTION, onGamepadAction);
    return () =>
      window.removeEventListener(GAMEPAD_EVENTS.ACTION, onGamepadAction);
  }, [
    controlsDisabled,
    switchRequired,
    showTeam,
    onToggleTeam,
    onReturn,
    state.p1.team.length,
  ]);
  return (
    <aside className="battle-command" aria-label="Commandes de combat">
      <div className="battle-command__dialogue">
        <div className="battle-log" aria-live="polite" aria-atomic="true">
          <div className="battle-log__header">
            <strong>Journal de combat</strong>
            {isAnimating && (
              <span className="battle-log__indicator" aria-hidden="true">
                ▼
              </span>
            )}
          </div>
          <p className="battle-log__message">{currentMessage}</p>
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
      </div>

      <div className="battle-command__actions-wrapper" ref={movesContainerRef}>
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
          <span className="battle-command__count">
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
                <span className="battle-moves__name">
                  {getMoveFrenchName(move.id, move.name)}
                </span>
                <span className="battle-moves__meta">
                  <span className="battle-moves__type">
                    {getPokemonTypeLabel(move.type)}
                  </span>
                  <span className="battle-moves__pp">
                    {move.pp}/{move.maxPp} PP
                  </span>
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
                    width={44}
                    height={44}
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
              <span
                className="gamepad-hint gamepad-hint--button-x"
                aria-hidden="true"
              >
                X
              </span>
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
            <span
              className="gamepad-hint gamepad-hint--button-b"
              aria-hidden="true"
            >
              B
            </span>
            <ArrowLeft aria-hidden="true" size={16} /> Quitter le combat
          </button>
        </div>
      </div>
    </aside>
  );
}
