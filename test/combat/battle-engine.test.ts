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

  it("keeps a fainted Pokémon's serialized state parseable by the client (no 'fnt' status leak)", async () => {
    const { BattleStateSchema } = await import("@/lib/combat/battle-client");

    const glassCannon: TrainerPokemonInput = {
      speciesId: "pikachu",
      level: 50,
      moves: [
        { id: "thunderbolt", name: "Tonnerre", type: "Electric", category: "special", power: 95, accuracy: 100, pp: 15, maxPp: 15, priority: 0 },
      ],
    };
    const fodder: TrainerPokemonInput = {
      speciesId: "magikarp",
      level: 5,
      moves: [
        { id: "splash", name: "Trempette", type: "Normal", category: "status", power: 0, accuracy: 100, pp: 40, maxPp: 40, priority: 0 },
      ],
    };

    // p1 garde un remplaçant : le combat n'est pas terminé, un switch est requis.
    const engine = new BattleEngine({
      p1: { name: "Ash", team: [fodder, glassCannon] },
      p2: { name: "Rival", team: [glassCannon] },
    });

    engine.submitAction("p1", { type: "move", moveIndex: 0 });
    engine.submitAction("p2", { type: "move", moveIndex: 0 });
    const { state } = engine.executeTurn();

    expect(state.phase).toBe("switch_required");
    const fainted = state.p1.team.find((p) => p.isFainted);
    expect(fainted).toBeDefined();
    // @pkmn/sim marque le K.O. via status "fnt" : il ne doit jamais fuir tel quel.
    expect(fainted?.status).toBeNull();

    // Sans la normalisation, ce parse échouerait et figerait l'arène côté client.
    expect(BattleStateSchema.safeParse(state).success).toBe(true);
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

  it("keeps nicknames bound to the right Pokémon after a switch reorders the team", () => {
    const withMoves = (
      speciesId: string,
      nickname: string,
      moveId: string,
    ): TrainerPokemonInput => ({
      speciesId,
      nickname,
      level: 20,
      moves: [
        { id: moveId, name: moveId, type: "Normal", category: "physical", power: 40, accuracy: 100, pp: 30, maxPp: 30, priority: 0 },
      ],
    });

    const engine = new BattleEngine({
      // Deux combattants, dont deux Vigoroth homonymes : le rattachement par
      // index se tromperait après le réordonnancement post-switch.
      p1: {
        name: "Joueur",
        team: [
          withMoves("vigoroth", "Alpha", "scratch"),
          withMoves("vigoroth", "Bravo", "pound"),
          withMoves("bidoof", "Charlie", "tackle"),
        ],
      },
      p2: { name: "IA", team: [withMoves("magikarp", "Cible", "splash")] },
    });

    const before = engine.getState().p1.team;
    expect(before[0]).toMatchObject({ nickname: "Alpha", isActive: true });
    expect(before.find((p) => p.nickname === "Bravo")?.speciesId).toBe("vigoroth");

    engine.submitAction("p1", { type: "switch", targetPokemonIndex: 1 }); // -> Bravo
    engine.submitAction("p2", { type: "move", moveIndex: 0 });
    engine.executeTurn();

    const after = engine.getState().p1.team;
    const active = after.find((p) => p.isActive)!;
    expect(active.nickname).toBe("Bravo"); // pas "Alpha"
    expect(after.find((p) => p.nickname === "Alpha")?.isActive).toBe(false);
    expect(after.find((p) => p.nickname === "Charlie")?.speciesId).toBe("bidoof");

    // Les identifiants restent stables malgré le réordonnancement interne.
    const bravoId = before.find((p) => p.nickname === "Bravo")!.id;
    expect(after.find((p) => p.nickname === "Bravo")!.id).toBe(bravoId);
  });

  it("does not deadlock when a move is turn-locked (Uproar / Bide / Encore ...)", async () => {
    const { selectAIAction } = await import("@/lib/combat/ai");

    const lockUser: TrainerPokemonInput = {
      speciesId: "vigoroth",
      level: 24,
      moves: [
        { id: "encore", name: "Encore", type: "Normal", category: "status", power: 0, accuracy: 100, pp: 8, maxPp: 8, priority: 0 },
        { id: "scratch", name: "Griffe", type: "Normal", category: "physical", power: 40, accuracy: 100, pp: 56, maxPp: 56, priority: 0 },
        { id: "uproar", name: "Brouhaha", type: "Normal", category: "special", power: 50, accuracy: 100, pp: 16, maxPp: 16, priority: 0 },
      ],
    };
    const opponent: TrainerPokemonInput = {
      speciesId: "breloom",
      level: 20,
      moves: [
        { id: "tackle", name: "Charge", type: "Normal", category: "physical", power: 35, accuracy: 95, pp: 56, maxPp: 56, priority: 0 },
      ],
    };

    const engine = new BattleEngine({
      p1: { name: "Joueur", team: [opponent] },
      p2: { name: "Fouad", team: [lockUser] },
    });

    // p2 lance Brouhaha : le simulateur le verrouille sur ce coup pour 2-3 tours.
    expect(engine.submitAction("p1", { type: "move", moveIndex: 0 })).toBe(true);
    expect(engine.submitAction("p2", { type: "move", moveIndex: 2 })).toBe(true);
    engine.executeTurn();

    // Seul le coup verrouillé est proposé, les autres sont grisés pour l'UI.
    const p2Moves = engine.getValidActions("p2").filter((a) => a.type === "move");
    expect(p2Moves).toEqual([{ type: "move", moveIndex: 2 }]);
    const active = engine.getState().p2.team.find((p) => p.isActive);
    expect(active?.moves.filter((m) => !m.disabled).map((m) => m.id)).toEqual(["uproar"]);

    // Le tour suivant : l'IA choisit (n'importe quoi) et le moteur ne rejette pas,
    // là où auparavant submitAction renvoyait false et bloquait tout le combat.
    let advanced = false;
    for (let i = 0; i < 4 && !engine.getRawBattle().ended; i++) {
      const before = engine.getState().turn;
      expect(engine.submitAction("p1", { type: "move", moveIndex: 0 })).toBe(true);
      expect(engine.submitAction("p2", selectAIAction("heuristic", engine, "p2"))).toBe(true);
      const { state } = engine.executeTurn();
      if (state.turn > before || state.phase === "finished" || state.p2.team.some((p) => p.isFainted)) {
        advanced = true;
      }
    }
    expect(advanced).toBe(true);
  });
});
