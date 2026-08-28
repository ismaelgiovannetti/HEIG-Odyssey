import { describe, it, expect } from "vitest";
import { BattleEngine } from "@/lib/combat/battle-engine";
import { selectAIAction, calculateTypeEffectiveness } from "@/lib/combat/ai";
import type { TrainerPokemonInput } from "@/lib/content/schemas";

describe("AI Battle Profiles (US-10)", () => {
  it("should calculate correct type effectiveness in Gen 4", () => {
    // Super effective
    expect(calculateTypeEffectiveness("Water", ["Fire"])).toBe(2.0);
    expect(calculateTypeEffectiveness("Fire", ["Grass"])).toBe(2.0);
    expect(calculateTypeEffectiveness("Electric", ["Water"])).toBe(2.0);

    // Double super effective (4x)
    expect(calculateTypeEffectiveness("Grass", ["Water", "Ground"])).toBe(4.0); // e.g. vs Swampert/Gastrodon
    expect(calculateTypeEffectiveness("Ice", ["Dragon", "Flying"])).toBe(4.0); // e.g. vs Dragonite/Salamence

    // Resisted (0.5x)
    expect(calculateTypeEffectiveness("Fire", ["Water"])).toBe(0.5);
    expect(calculateTypeEffectiveness("Grass", ["Fire"])).toBe(0.5);

    // Immune (0x)
    expect(calculateTypeEffectiveness("Electric", ["Ground"])).toBe(0.0);
    expect(calculateTypeEffectiveness("Normal", ["Ghost"])).toBe(0.0);
    expect(calculateTypeEffectiveness("Ghost", ["Normal"])).toBe(0.0);
    expect(calculateTypeEffectiveness("Poison", ["Steel"])).toBe(0.0);
  });

  it("should make a valid move with random profile", () => {
    const p1: TrainerPokemonInput = {
      speciesId: "turtwig",
      level: 10,
      moves: [
        {
          id: "tackle",
          name: "Charge",
          type: "Normal",
          category: "physical",
          power: 35,
          accuracy: 100,
          pp: 35,
          maxPp: 35,
          priority: 0,
        },
      ],
    };

    const p2: TrainerPokemonInput = {
      speciesId: "chimchar",
      level: 10,
      moves: [
        {
          id: "scratch",
          name: "Griffe",
          type: "Normal",
          category: "physical",
          power: 40,
          accuracy: 100,
          pp: 35,
          maxPp: 35,
          priority: 0,
        },
      ],
    };

    const engine = new BattleEngine({
      p1: { name: "Player", team: [p1] },
      p2: { name: "AI", team: [p2] },
    });

    const action = selectAIAction("random", engine, "p2");
    expect(action).toBeDefined();
    expect(action.type).toBe("move");
  });

  it("heuristic AI should select the super-effective move over normal/resisted moves", () => {
    // Player has Grass Turtwig
    const playerTurtwig: TrainerPokemonInput = {
      speciesId: "turtwig",
      level: 20,
      moves: [
        {
          id: "tackle",
          name: "Charge",
          type: "Normal",
          category: "physical",
          power: 35,
          accuracy: 100,
          pp: 35,
          maxPp: 35,
          priority: 0,
        },
      ],
    };

    // AI Chimchar has:
    // 0: Scratch (Normal, 40 power, 1x)
    // 1: Ember (Fire, 40 power, 2x super effective + 1.5x STAB)
    // 2: Leer (Status)
    const aiChimchar: TrainerPokemonInput = {
      speciesId: "chimchar",
      level: 20,
      moves: [
        {
          id: "scratch",
          name: "Griffe",
          type: "Normal",
          category: "physical",
          power: 40,
          accuracy: 100,
          pp: 35,
          maxPp: 35,
          priority: 0,
        },
        {
          id: "ember",
          name: "Flammèche",
          type: "Fire",
          category: "special",
          power: 40,
          accuracy: 100,
          pp: 25,
          maxPp: 25,
          priority: 0,
        },
        {
          id: "leer",
          name: "Groz'Yeux",
          type: "Normal",
          category: "status",
          power: 0,
          accuracy: 100,
          pp: 30,
          maxPp: 30,
          priority: 0,
        },
      ],
    };

    const engine = new BattleEngine({
      p1: { name: "Player", team: [playerTurtwig] },
      p2: { name: "AI", team: [aiChimchar] },
    });

    const action = selectAIAction("heuristic", engine, "p2");
    expect(action.type).toBe("move");
    if (action.type === "move") {
      // Index 1 corresponds to Ember (super effective)
      expect(action.moveIndex).toBe(1);
    }
  });

  it("expectiminimax AI should select the best competitive action", () => {
    const playerPiplup: TrainerPokemonInput = {
      speciesId: "piplup",
      level: 30,
      moves: [
        {
          id: "watergun",
          name: "Pistolet à O",
          type: "Water",
          category: "special",
          power: 40,
          accuracy: 100,
          pp: 25,
          maxPp: 25,
          priority: 0,
        },
      ],
    };

    const aiLuxray: TrainerPokemonInput = {
      speciesId: "luxray",
      level: 35,
      moves: [
        {
          id: "spark",
          name: "Étincelle",
          type: "Electric",
          category: "physical",
          power: 65,
          accuracy: 100,
          pp: 20,
          maxPp: 20,
          priority: 0,
        },
        {
          id: "tackle",
          name: "Charge",
          type: "Normal",
          category: "physical",
          power: 35,
          accuracy: 100,
          pp: 35,
          maxPp: 35,
          priority: 0,
        },
      ],
    };

    const engine = new BattleEngine({
      p1: { name: "Player", team: [playerPiplup] },
      p2: { name: "AI", team: [aiLuxray] },
    });

    const action = selectAIAction("expectiminimax", engine, "p2");
    expect(action.type).toBe("move");
    if (action.type === "move") {
      // Spark is Electric against Water (super-effective + STAB)
      expect(action.moveIndex).toBe(0);
    }
  });
});

