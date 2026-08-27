import type { PokemonType } from "../content/schemas";

export type AIProfile = "random" | "heuristic" | "expectiminimax";

export type BattlePhase = "action_selection" | "switch_required" | "finished";

export type BattleSideId = "p1" | "p2";

export interface BattleMoveInfo {
  id: string;
  name: string;
  type: PokemonType;
  category: "physical" | "special" | "status";
  power: number;
  accuracy: number;
  pp: number;
  maxPp: number;
  disabled?: boolean;
}

export interface BattlePokemonState {
  id: string; // unique identifier in the battle
  speciesId: string;
  name: string;
  nickname?: string;
  level: number;
  types: PokemonType[];
  currentHp: number;
  maxHp: number;
  hpPercent: number;
  status: "brn" | "par" | "slp" | "psn" | "tox" | "frz" | null;
  moves: BattleMoveInfo[];
  isShiny: boolean;
  isActive: boolean;
  isFainted: boolean;
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  boosts?: {
    atk?: number;
    def?: number;
    spa?: number;
    spd?: number;
    spe?: number;
    accuracy?: number;
    evasion?: number;
  };
}

export interface BattleSideState {
  sideId: BattleSideId;
  name: string;
  avatar?: string;
  team: BattlePokemonState[];
  activePokemonIndex: number;
}

export type BattleAction =
  | { type: "move"; moveIndex: number; target?: number }
  | { type: "switch"; targetPokemonIndex: number };

export type BattleEventType =
  | "turn_start"
  | "move"
  | "damage"
  | "heal"
  | "status_inflicted"
  | "status_cleared"
  | "stat_boost"
  | "faint"
  | "switch"
  | "weather"
  | "effectiveness"
  | "critical_hit"
  | "miss"
  | "message"
  | "battle_end";

export interface BattleEvent {
  type: BattleEventType;
  turn: number;
  side?: BattleSideId;
  pokemonIndex?: number;
  targetSide?: BattleSideId;
  targetPokemonIndex?: number;
  moveId?: string;
  moveName?: string;
  damage?: number;
  heal?: number;
  currentHp?: number;
  maxHp?: number;
  hpPercent?: number;
  status?: string;
  multiplier?: number; // for effectiveness (e.g. 2 for super-effective, 0.5, 0 for immune)
  message: string;
}

export interface BattleState {
  battleId: string;
  turn: number;
  phase: BattlePhase;
  p1: BattleSideState;
  p2: BattleSideState;
  winner: BattleSideId | null;
  logs: string[];
}

export interface TurnExecutionResult {
  turn: number;
  events: BattleEvent[];
  state: BattleState;
}
