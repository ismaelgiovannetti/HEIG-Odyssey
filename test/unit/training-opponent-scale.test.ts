import { describe, expect, it } from "vitest";
import { computeAverageTeamLevel, generateTrainingOpponent } from "@/lib/combat/training-generator";
import { TrainerSchema } from "@/lib/content/schemas";
import { BattleEngine } from "@/lib/combat/battle-engine";

describe("Mise à l'échelle procédurale de l'entraînement (T-US09-04)", () => {
  it.each([
    ["équipe faible incomplète (1 membre, niveau 5)", [{ level: 5 }], 1],
    ["équipe faible complète (6 membres, niveau 5)", Array.from({ length: 6 }, () => ({ level: 5 })), 6],
    ["équipe forte incomplète (3 membres, niveau 100)", Array.from({ length: 3 }, () => ({ level: 100 })), 3],
    ["équipe forte complète (6 membres, niveau 100)", Array.from({ length: 6 }, () => ({ level: 100 })), 6],
    ["équipe mixte aux deux bornes (niveaux 5 et 100)", [{ level: 5 }, { level: 100 }], 2],
  ] as const)("produit un adversaire légal pour %s", (_label, team, teamSize) => {
    const averageLevel = computeAverageTeamLevel([...team]);
    const opponent = generateTrainingOpponent({ averageLevel, difficulty: "normal", teamSize });

    // "Adversaire valide" au sens littéral de la tâche : conforme au format
    // de combat (TrainerSchema), pas seulement une forme JS quelconque.
    expect(() => TrainerSchema.parse(opponent)).not.toThrow();
    expect(opponent.team).toHaveLength(teamSize);
    expect(opponent.team.every((member) => member.level === averageLevel)).toBe(true);
    // Pas de doublon d'espèce : une équipe adverse cohérente, même générée.
    expect(new Set(opponent.team.map((member) => member.speciesId)).size).toBe(teamSize);
  });

  it("construit un combat réellement jouable pour une équipe adverse très faible", () => {
    const averageLevel = computeAverageTeamLevel([{ level: 5 }]);
    const opponent = generateTrainingOpponent({ averageLevel, difficulty: "easy", teamSize: 1 });

    expect(
      () =>
        new BattleEngine({
          p1: { name: "Joueur", team: opponent.team },
          p2: { name: opponent.name, team: opponent.team },
        }),
    ).not.toThrow();
  });

  it("construit un combat réellement jouable pour une équipe adverse très forte", () => {
    const averageLevel = computeAverageTeamLevel([{ level: 100 }, { level: 100 }]);
    const opponent = generateTrainingOpponent({ averageLevel, difficulty: "hard", teamSize: 6 });

    expect(
      () =>
        new BattleEngine({
          p1: { name: "Joueur", team: opponent.team },
          p2: { name: opponent.name, team: opponent.team },
        }),
    ).not.toThrow();
  });

  it("ramène un niveau sous le plancher à 5 et au-dessus du plafond à 100", () => {
    expect(computeAverageTeamLevel([{ level: 1 }])).toBe(5);
    expect(computeAverageTeamLevel([{ level: 999 }])).toBe(100);
  });

  it("ne lève jamais d'erreur pour une équipe vide (retombe sur le plancher)", () => {
    expect(computeAverageTeamLevel([])).toBe(5);
  });
});
