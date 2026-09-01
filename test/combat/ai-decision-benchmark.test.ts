import { describe, expect, it } from "vitest";
import { BattleEngine } from "@/lib/combat/battle-engine";
import { selectAIAction } from "@/lib/combat/ai";
import type { AIProfile, TrainerPokemonInput } from "@/lib/content/schemas";

// Scénario de référence : réutilise exactement celui déjà établi dans
// ai.test.ts (Turtwig vs Chimchar, un move super efficace parmi trois) pour
// ne pas dupliquer de fixture ni introduire un cas non représentatif.
function buildReferenceScenario(): BattleEngine {
  const playerTurtwig: TrainerPokemonInput = {
    speciesId: "turtwig",
    level: 20,
    moves: [
      { id: "tackle", name: "Charge", type: "Normal", category: "physical", power: 35, accuracy: 100, pp: 35, maxPp: 35, priority: 0 },
    ],
  };

  const aiChimchar: TrainerPokemonInput = {
    speciesId: "chimchar",
    level: 20,
    moves: [
      { id: "scratch", name: "Griffe", type: "Normal", category: "physical", power: 40, accuracy: 100, pp: 35, maxPp: 35, priority: 0 },
      { id: "ember", name: "Flammèche", type: "Fire", category: "special", power: 40, accuracy: 100, pp: 25, maxPp: 25, priority: 0 },
      { id: "leer", name: "Groz'Yeux", type: "Normal", category: "status", power: 0, accuracy: 100, pp: 30, maxPp: 30, priority: 0 },
    ],
  };

  return new BattleEngine({
    p1: { name: "Player", team: [playerTurtwig] },
    p2: { name: "AI", team: [aiChimchar] },
  });
}

// Budget documenté (voir docs/02-conception/HEIG_Odyssey_T-US10-05_Mesure_Decision_IA.md) :
// large marge au-dessus des temps mesurés (~1 ms) pour absorber la variance
// d'une machine chargée sans masquer une vraie régression de performance.
const DECISION_BUDGET_MS = 50;
const REFERENCE_RUNS = 30;

describe("Mesure du temps de décision et budget des IA (T-US10-05)", () => {
  it.each<AIProfile>(["random", "heuristic", "expectiminimax"])(
    "reste sous le budget de décision (%s)",
    (profile) => {
      let maxDurationMs = 0;

      for (let i = 0; i < REFERENCE_RUNS; i++) {
        const engine = buildReferenceScenario();
        const start = performance.now();
        selectAIAction(profile, engine, "p2");
        const duration = performance.now() - start;
        maxDurationMs = Math.max(maxDurationMs, duration);
      }

      expect(maxDurationMs).toBeLessThan(DECISION_BUDGET_MS);
    },
  );

  it("heuristique et expectiminimax convergent de façon déterministe vers le move optimal", () => {
    const heuristicChoices = new Set<number>();
    const expectiminimaxChoices = new Set<number>();

    for (let i = 0; i < REFERENCE_RUNS; i++) {
      const heuristicAction = selectAIAction("heuristic", buildReferenceScenario(), "p2");
      const expectiminimaxAction = selectAIAction("expectiminimax", buildReferenceScenario(), "p2");
      if (heuristicAction.type === "move") heuristicChoices.add(heuristicAction.moveIndex);
      if (expectiminimaxAction.type === "move") expectiminimaxChoices.add(expectiminimaxAction.moveIndex);
    }

    // Flammèche (index 1) est le seul choix rationnel : super efficace + STAB.
    expect(heuristicChoices).toEqual(new Set([1]));
    expect(expectiminimaxChoices).toEqual(new Set([1]));
  });

  it("le profil aléatoire produit une réelle variance, contrairement aux deux autres", () => {
    const randomChoices = new Set<number>();

    for (let i = 0; i < REFERENCE_RUNS; i++) {
      const action = selectAIAction("random", buildReferenceScenario(), "p2");
      if (action.type === "move") randomChoices.add(action.moveIndex);
    }

    // Comportement qualitativement distinct : contrairement aux IA
    // déterministes ci-dessus, le hasard ne converge pas vers un choix unique.
    expect(randomChoices.size).toBeGreaterThan(1);
  });
});
