import { describe, it, expect } from "vitest";
import { BattleEngine } from "@/lib/combat/battle-engine";
import type { TrainerPokemonInput } from "@/lib/content/schemas";

describe("Gen 4 Battle Engine (US-06)", () => {
  const p1Turtwig: TrainerPokemonInput = {
    speciesId: "turtwig",
    level: 15,
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
      {
        id: "vinewhip",
        name: "Fouet Lianes",
        type: "Grass",
        category: "physical",
        power: 45,
        accuracy: 100,
        pp: 25,
        maxPp: 25,
        priority: 0,
      },
      {
        id: "withdraw",
        name: "Repli",
        type: "Water",
        category: "status",
        power: 0,
        accuracy: 100,
        pp: 40,
        maxPp: 40,
        priority: 0,
      },
    ],
  };

  const p2Piplup: TrainerPokemonInput = {
    speciesId: "piplup",
    level: 15,
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
      {
        id: "pound",
        name: "Écras'Face",
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

  it("should initialize battle with valid initial state", () => {
    const engine = new BattleEngine({
      p1: { name: "Red", team: [p1Turtwig] },
      p2: { name: "Blue", team: [p2Piplup] },
    });

    const state = engine.getState();
    expect(state.turn).toBe(1);
    expect(state.phase).toBe("action_selection");
    expect(state.p1.team.length).toBe(1);
    expect(state.p2.team.length).toBe(1);

    const p1Active = state.p1.team[0];
    expect(p1Active.name).toBe("Tortipouss");
    expect(p1Active.currentHp).toBeGreaterThan(0);
    expect(p1Active.isActive).toBe(true);

    const p2Active = state.p2.team[0];
    expect(p2Active.name).toBe("Tiplouf");
    expect(p2Active.currentHp).toBeGreaterThan(0);
    expect(p2Active.isActive).toBe(true);
  });

  it("should return valid move actions for active Pokémon", () => {
    const engine = new BattleEngine({
      p1: { name: "Red", team: [p1Turtwig] },
      p2: { name: "Blue", team: [p2Piplup] },
    });

    const p1Actions = engine.getValidActions("p1");
    expect(p1Actions.length).toBe(3);
    expect(p1Actions.every((a) => a.type === "move")).toBe(true);

    const p2Actions = engine.getValidActions("p2");
    expect(p2Actions.length).toBe(2);
  });

  it("should execute a turn with damage and super-effective calculation", () => {
    const engine = new BattleEngine({
      p1: { name: "Red", team: [p1Turtwig] },
      p2: { name: "Blue", team: [p2Piplup] },
    });

    // P1 uses Vine Whip (Grass, super effective against Water Piplup, 100% accuracy)
    // P2 uses Water Gun (Water, resisted by Grass Turtwig)
    engine.submitAction("p1", { type: "move", moveIndex: 1 }); // vinewhip
    engine.submitAction("p2", { type: "move", moveIndex: 0 }); // watergun

    const result = engine.executeTurn();
    expect(result.events.length).toBeGreaterThan(0);

    const state = engine.getState();
    const p1Active = state.p1.team[0];
    const p2Active = state.p2.team[0];

    // Piplup should have taken heavy super-effective damage
    expect(p2Active.currentHp).toBeLessThan(p2Active.maxHp);
    expect(p1Active.currentHp).toBeLessThan(p1Active.maxHp);

    const hasSuperEffective = result.events.some((e) => e.type === "effectiveness" && e.multiplier === 2);
    expect(hasSuperEffective).toBe(true);
  });

  it("should handle Pokémon fainting and declaring the winner", () => {
    const strongPikachu: TrainerPokemonInput = {
      speciesId: "pikachu",
      level: 50,
      moves: [
        {
          id: "thunderbolt",
          name: "Tonnerre",
          type: "Electric",
          category: "special",
          power: 95,
          accuracy: 100,
          pp: 15,
          maxPp: 15,
          priority: 0,
        },
      ],
    };

    const weakMagikarp: TrainerPokemonInput = {
      speciesId: "magikarp",
      level: 5,
      moves: [
        {
          id: "splash",
          name: "Trempette",
          type: "Normal",
          category: "status",
          power: 0,
          accuracy: 100,
          pp: 40,
          maxPp: 40,
          priority: 0,
        },
      ],
    };

    const engine = new BattleEngine({
      p1: { name: "Ash", team: [strongPikachu] },
      p2: { name: "Fisherman", team: [weakMagikarp] },
    });

    engine.submitAction("p1", { type: "move", moveIndex: 0 }); // thunderbolt
    engine.submitAction("p2", { type: "move", moveIndex: 0 }); // splash

    const result = engine.executeTurn();
    const state = engine.getState();

    expect(state.phase).toBe("finished");
    expect(state.winner).toBe("p1");
    expect(state.p2.team[0].isFainted).toBe(true);
    expect(state.p2.team[0].currentHp).toBe(0);

    const faintEvent = result.events.find((e) => e.type === "faint");
    expect(faintEvent).toBeDefined();

    const endEvent = result.events.find((e) => e.type === "battle_end");
    expect(endEvent).toBeDefined();
    expect(endEvent?.side).toBe("p1");
  });

  it("should handle switching Pokémon during combat", () => {
    const b1Team: TrainerPokemonInput[] = [
      p1Turtwig,
      {
        speciesId: "chimchar",
        level: 15,
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
      },
    ];

    const engine = new BattleEngine({
      p1: { name: "Trainer 1", team: b1Team },
      p2: { name: "Trainer 2", team: [p2Piplup] },
    });

    const initialActions = engine.getValidActions("p1");
    const switchAction = initialActions.find((a) => a.type === "switch");
    expect(switchAction).toBeDefined();

    // P1 switches to Chimchar (index 1)
    engine.submitAction("p1", { type: "switch", targetPokemonIndex: 1 });
    engine.submitAction("p2", { type: "move", moveIndex: 0 });

    const result = engine.executeTurn();
    const state = engine.getState();

    // After switch, Chimchar is now active and Turtwig is on the bench
    const activePkmn = state.p1.team[state.p1.activePokemonIndex];
    expect(activePkmn.speciesId).toBe("chimchar");
    expect(activePkmn.isActive).toBe(true);

    const benchPkmn = state.p1.team.find((p) => p.speciesId === "turtwig");
    expect(benchPkmn).toBeDefined();
    expect(benchPkmn?.isActive).toBe(false);

    const switchEvent = result.events.find((e) => e.type === "switch" && e.side === "p1");
    expect(switchEvent).toBeDefined();
  });
});
