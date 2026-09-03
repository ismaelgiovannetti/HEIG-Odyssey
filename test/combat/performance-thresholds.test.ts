import { describe, it, expect } from "vitest";
import { BattleEngine } from "@/lib/combat/battle-engine";
import { selectAIAction } from "@/lib/combat/ai";
import type { AIProfile } from "@/lib/combat/types";
import type { TrainerPokemonInput, PokemonType } from "@/lib/content/schemas";
import { measureMedianDurationMs } from "../helpers/performance";

/**
 * Seuils fixés par T-NFR03-01 à partir de la mesure d'une tranche verticale
 * représentative (équipe complète 6 Pokémon, IA random/heuristic/expectiminimax).
 * Protocole et valeurs mesurées : docs/02-conception/HEIG_Odyssey_T-NFR03-01_Seuils_Performance.md
 */
const AI_DECISION_BUDGET_MS = 20;
const BATTLE_TURN_BUDGET_MS = 50;
const BATTLE_INIT_BUDGET_MS = 50;

const ALL_PROFILES: AIProfile[] = ["random", "heuristic", "expectiminimax"];

function move(
  id: string,
  name: string,
  type: PokemonType,
  category: "physical" | "special" | "status",
  power: number,
) {
  return {
    id,
    name,
    type,
    category,
    power,
    accuracy: 100,
    pp: 20,
    maxPp: 20,
    priority: 0,
  };
}

// Équipe complète de 6 Pokémon à 4 capacités, représentative d'un combat de fin de campagne
// (charge de calcul maximale pour l'heuristique et l'expectiminimax, qui évaluent chaque capacité).
function representativeFullTeam(): TrainerPokemonInput[] {
  return [
    {
      speciesId: "venusaur",
      level: 50,
      moves: [
        move("vinewhip", "Fouet Lianes", "Grass", "physical", 45),
        move("tackle", "Charge", "Normal", "physical", 35),
        move("leechseed", "Vampigraine", "Grass", "status", 0),
        move("growl", "Grondement", "Normal", "status", 0),
      ],
    },
    {
      speciesId: "charizard",
      level: 50,
      moves: [
        move("ember", "Flammèche", "Fire", "special", 40),
        move("scratch", "Griffe", "Normal", "physical", 40),
        move("smokescreen", "Écran Fumée", "Normal", "status", 0),
        move("growl", "Grondement", "Normal", "status", 0),
      ],
    },
    {
      speciesId: "blastoise",
      level: 50,
      moves: [
        move("watergun", "Pistolet à O", "Water", "special", 40),
        move("bite", "Morsure", "Dark", "physical", 60),
        move("withdraw", "Repli", "Water", "status", 0),
        move("tackle", "Charge", "Normal", "physical", 35),
      ],
    },
    {
      speciesId: "pikachu",
      level: 50,
      moves: [
        move("thunderbolt", "Tonnerre", "Electric", "special", 95),
        move("quickattack", "Vive-Attaque", "Normal", "physical", 40),
        move("tailwhip", "Mimi-Queue", "Normal", "status", 0),
        move("thunderwave", "Cage-Éclair", "Electric", "status", 0),
      ],
    },
    {
      speciesId: "gengar",
      level: 50,
      moves: [
        move("lick", "Léchouille", "Ghost", "physical", 30),
        move("hypnosis", "Hypnose", "Psychic", "status", 0),
        move("confuseray", "Choc Mental", "Ghost", "status", 0),
        move("nightshade", "Ombre Nocturne", "Ghost", "special", 0),
      ],
    },
    {
      speciesId: "dragonite",
      level: 50,
      moves: [
        move("dragonrage", "Draco-Rage", "Dragon", "special", 0),
        move("wingattack", "Cyclaile", "Flying", "physical", 60),
        move("agility", "Voltige", "Psychic", "status", 0),
        move("hyperbeam", "Ultimatum", "Normal", "special", 150),
      ],
    },
  ];
}

function newRepresentativeEngine(): BattleEngine {
  return new BattleEngine({
    p1: { name: "Joueur", team: representativeFullTeam() },
    p2: { name: "Dresseur", team: representativeFullTeam() },
  });
}

describe("Seuils de performance de la tranche verticale (T-NFR03-01)", () => {
  it.each(ALL_PROFILES)(
    `la décision de l'IA '%s' reste sous le budget médian de ${AI_DECISION_BUDGET_MS}ms sur une équipe complète`,
    (profile) => {
      const elapsed = measureMedianDurationMs(
        newRepresentativeEngine,
        (engine) => selectAIAction(profile, engine, "p2"),
      );
      const action = selectAIAction(profile, newRepresentativeEngine(), "p2");

      expect(action).toBeDefined();
      expect(elapsed).toBeLessThan(AI_DECISION_BUDGET_MS);
    },
  );

  it.each(ALL_PROFILES)(
    `un tour complet avec l'IA '%s' reste sous le budget médian de ${BATTLE_TURN_BUDGET_MS}ms`,
    (profile) => {
      const playTurn = (engine: BattleEngine) => {
        engine.submitAction("p1", { type: "move", moveIndex: 0 });
        const aiAction = selectAIAction(profile, engine, "p2");
        engine.submitAction("p2", aiAction);
        return engine.executeTurn();
      };
      const elapsed = measureMedianDurationMs(
        newRepresentativeEngine,
        playTurn,
      );
      const result = playTurn(newRepresentativeEngine());

      expect(result.state.turn).toBeGreaterThanOrEqual(1);
      expect(elapsed).toBeLessThan(BATTLE_TURN_BUDGET_MS);
    },
  );

  it("le démarrage d'un combat (construction du moteur + état initial) reste sous le budget", () => {
    const elapsed = measureMedianDurationMs(
      () => undefined,
      () => newRepresentativeEngine().getState(),
    );
    const state = newRepresentativeEngine().getState();

    expect(state.phase).toBe("action_selection");
    expect(elapsed).toBeLessThan(BATTLE_INIT_BUDGET_MS);
  });
});
