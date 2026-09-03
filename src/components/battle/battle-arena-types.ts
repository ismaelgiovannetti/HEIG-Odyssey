import type { BattleStartPayload } from "@/lib/combat/battle-client";

export type BattleMode = "campaign" | "training";

export type PlayerAction =
  | { type: "move"; moveIndex: number }
  | { type: "switch"; targetPokemonIndex: number };

export interface BattleArenaProps {
  initialBattle: BattleStartPayload;
  mode: BattleMode;
  onReturn: () => void;
  /** Étape de campagne qui suit celle jouée, si elle existe. */
  nextStageId?: string | null;
  /** Enchaîne directement sur `nextStageId` depuis l'écran de résultat. */
  onAdvance?: () => void;
}

export type OpponentIntroPhase = "trainer" | "leaving" | "pokemon";
