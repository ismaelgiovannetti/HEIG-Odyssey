import { Dex } from "@pkmn/sim";
import type { BattleEngine } from "./battle-engine";
import type { BattleAction, AIProfile, BattleSideId, BattlePokemonState, BattleMoveInfo } from "./types";
import type { PokemonType } from "../content/schemas";

const dex = Dex.forGen(4);

/** Picks an action for the AI side according to the given profile ("random", "heuristic" or "expectiminimax"). */
export function selectAIAction(
  profile: AIProfile,
  battleEngine: BattleEngine,
  aiSide: BattleSideId = "p2"
): BattleAction {
  const validActions = battleEngine.getValidActions(aiSide);
  if (validActions.length === 0) {
    return { type: "move", moveIndex: 0 };
  }

  if (validActions.length === 1) {
    return validActions[0];
  }

  switch (profile) {
    case "random":
      return selectRandomAction(validActions);
    case "heuristic":
      return selectHeuristicAction(battleEngine, aiSide, validActions);
    case "expectiminimax":
      return selectExpectiminimaxAction(battleEngine, aiSide, validActions);
    default:
      return selectHeuristicAction(battleEngine, aiSide, validActions);
  }
}

function selectRandomAction(validActions: BattleAction[]): BattleAction {
  // Prefer moves over switches in random mode (85% move, 15% switch)
  const moves = validActions.filter((a) => a.type === "move");
  const switches = validActions.filter((a) => a.type === "switch");

  if (moves.length > 0 && (switches.length === 0 || Math.random() < 0.85)) {
    const idx = Math.floor(Math.random() * moves.length);
    return moves[idx];
  }

  const idx = Math.floor(Math.random() * validActions.length);
  return validActions[idx];
}

function selectHeuristicAction(
  battleEngine: BattleEngine,
  aiSide: BattleSideId,
  validActions: BattleAction[]
): BattleAction {
  const state = battleEngine.getState();
  const mySideState = aiSide === "p1" ? state.p1 : state.p2;
  const oppSideState = aiSide === "p1" ? state.p2 : state.p1;

  const myActive = mySideState.team[mySideState.activePokemonIndex];
  const oppActive = oppSideState.team[oppSideState.activePokemonIndex];

  // If forced switch
  if (state.phase === "switch_required" || myActive.isFainted) {
    return selectBestSwitch(mySideState.team, oppActive, validActions);
  }

  let bestAction: BattleAction = validActions[0];
  let highestScore = -Infinity;

  for (const action of validActions) {
    let score = 0;

    if (action.type === "move") {
      const move = myActive.moves[action.moveIndex];
      if (move) {
        score = evaluateMoveScore(move, myActive, oppActive);
      }
    } else if (action.type === "switch") {
      const targetBench = mySideState.team[action.targetPokemonIndex];
      if (targetBench && !targetBench.isFainted) {
        score = evaluateSwitchScore(myActive, targetBench, oppActive);
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestAction = action;
    }
  }

  return bestAction;
}

function evaluateMoveScore(
  move: BattleMoveInfo,
  user: BattlePokemonState,
  target: BattlePokemonState
): number {
  if (move.pp <= 0) return -100;

  const moveData = dex.moves.get(move.id);
  let score = 0;

  // Type effectiveness
  const effectiveness = calculateTypeEffectiveness(move.type, target.types);

  // Immune = 0 score
  if (effectiveness === 0) {
    return -50;
  }

  // STAB bonus (Same Type Attack Bonus)
  const hasStab = user.types.includes(move.type);
  const stabMultiplier = hasStab ? 1.5 : 1.0;

  if (move.category === "status") {
    // Status moves evaluation
    if (moveData.status) {
      if (target.status) {
        score -= 40; // Target already has a status
      } else {
        score += 35; // Useful status infliction
      }
    } else if (moveData.boosts) {
      score += 25; // Stat boosting move
    } else if (moveData.heal) {
      if (user.hpPercent < 50) score += 45;
      else score -= 10;
    } else {
      score += 15;
    }
  } else {
    // Damaging moves evaluation
    const power = move.power || 40;
    const accuracy = (move.accuracy || 100) / 100;

    score = power * effectiveness * stabMultiplier * accuracy;

    // Super effective bonus
    if (effectiveness > 1) {
      score += 30 * effectiveness;
    } else if (effectiveness < 1) {
      score -= 20;
    }

    // Finishing blow heuristic: if power is high and target is low HP
    const estimatedDamage = (power * effectiveness * stabMultiplier * (user.level / 50)) / 2;
    if (estimatedDamage >= target.currentHp) {
      score += 60; // Prioritize securing KO
    }
  }

  // Priority move bonus if user is faster or target is low
  if (moveData.priority > 0 && target.hpPercent < 30) {
    score += 25;
  }

  return score;
}

function evaluateSwitchScore(
  currentActive: BattlePokemonState,
  benchTarget: BattlePokemonState,
  opponent: BattlePokemonState
): number {
  // Defensive penalty on current active if facing super effective
  let currentThreatLevel = 0;
  for (const oppType of opponent.types) {
    const oppEff = calculateTypeEffectiveness(oppType, currentActive.types);
    if (oppEff >= 2) currentThreatLevel += 30;
  }

  // Bench target resistance against opponent
  let benchAdvantage = 0;
  for (const oppType of opponent.types) {
    const benchEff = calculateTypeEffectiveness(oppType, benchTarget.types);
    if (benchEff < 1) benchAdvantage += 25;
    else if (benchEff >= 2) benchAdvantage -= 30;
  }

  // Bench offensive advantage against opponent
  for (const benchType of benchTarget.types) {
    const offensiveEff = calculateTypeEffectiveness(benchType, opponent.types);
    if (offensiveEff >= 2) benchAdvantage += 35;
  }

  // Only switch if active is severely threatened and bench has clear advantage
  if (currentThreatLevel >= 30 && benchAdvantage > 20 && benchTarget.hpPercent > 60) {
    return 40 + benchAdvantage;
  }

  // Default: switching mid-combat without reason is penalized
  return -30;
}

function selectBestSwitch(
  team: BattlePokemonState[],
  opponent: BattlePokemonState,
  validActions: BattleAction[]
): BattleAction {
  const switchActions = validActions.filter((a) => a.type === "switch");
  if (switchActions.length === 0) return validActions[0];

  let bestSwitch = switchActions[0];
  let highestScore = -Infinity;

  for (const action of switchActions) {
    if (action.type !== "switch") continue;
    const candidate = team[action.targetPokemonIndex];
    if (!candidate || candidate.isFainted) continue;

    let score = candidate.hpPercent; // Prefer healthy Pokémon

    // Offensive advantage
    for (const type of candidate.types) {
      const eff = calculateTypeEffectiveness(type, opponent.types);
      score += eff * 20;
    }

    // Defensive resistance
    for (const oppType of opponent.types) {
      const eff = calculateTypeEffectiveness(oppType, candidate.types);
      if (eff < 1) score += 25;
      else if (eff >= 2) score -= 25;
    }

    if (score > highestScore) {
      highestScore = score;
      bestSwitch = action;
    }
  }

  return bestSwitch;
}

/** Computes the combined Gen 4 type-effectiveness multiplier of an attack type against a (possibly dual-typed) target. */
export function calculateTypeEffectiveness(
  attackType: PokemonType,
  targetTypes: PokemonType[]
): number {
  let totalMultiplier = 1.0;

  for (const defType of targetTypes) {
    if (!dex.getImmunity(attackType, defType)) {
      return 0.0;
    }
    const mult = dex.getEffectiveness(attackType, defType);
    if (mult > 0) {
      totalMultiplier *= Math.pow(2, mult);
    } else if (mult < 0) {
      totalMultiplier *= Math.pow(0.5, -mult);
    }
  }

  return totalMultiplier;
}

function selectExpectiminimaxAction(
  battleEngine: BattleEngine,
  aiSide: BattleSideId,
  validActions: BattleAction[]
): BattleAction {
  // For deep minimax: evaluate 1-ply forward minimax with regret minimization
  const state = battleEngine.getState();
  const mySideState = aiSide === "p1" ? state.p1 : state.p2;
  const oppSideState = aiSide === "p1" ? state.p2 : state.p1;

  const myActive = mySideState.team[mySideState.activePokemonIndex];
  const oppActive = oppSideState.team[oppSideState.activePokemonIndex];

  let bestAction = validActions[0];
  let bestMinimaxScore = -Infinity;

  for (const action of validActions) {
    let baseScore = 0;
    if (action.type === "move") {
      const move = myActive.moves[action.moveIndex];
      baseScore = move ? evaluateMoveScore(move, myActive, oppActive) : 0;
    } else if (action.type === "switch") {
      const bench = mySideState.team[action.targetPokemonIndex];
      baseScore = bench ? evaluateSwitchScore(myActive, bench, oppActive) : 0;
    }

    // Anticipate opponent's best counter-move
    let worstOpponentThreat = 0;
    for (const oppMove of oppActive.moves) {
      const threat = evaluateMoveScore(oppMove, oppActive, myActive);
      if (threat > worstOpponentThreat) worstOpponentThreat = threat;
    }

    // Minimax utility: our advantage minus opponent counter-pressure
    const utility = baseScore - worstOpponentThreat * 0.4;

    if (utility > bestMinimaxScore) {
      bestMinimaxScore = utility;
      bestAction = action;
    }
  }

  return bestAction;
}
