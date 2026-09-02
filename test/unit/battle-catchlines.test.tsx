// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BattleCatchlines } from "@/components/combat/battle-catchlines";

describe("BattleCatchlines Component (T-US08-02)", () => {
  it("affiche la catchline d'introduction en phase d'intro", () => {
    render(
      <BattleCatchlines
        trainerName="Fouad"
        trainerTitle="Professeur Réseau"
        introCatchline="Prépare-toi à une tempête de paquets !"
        victoryCatchline="Bien joué !"
        defeatCatchline="Mes routeurs ont surchauffé..."
        currentPhase="intro"
      />
    );

    expect(screen.getByText("Fouad")).toBeDefined();
    expect(screen.getByText("(Professeur Réseau)")).toBeDefined();
    expect(screen.getByText(/Prépare-toi à une tempête de paquets !/)).toBeDefined();
    expect(screen.getByText("Début du combat")).toBeDefined();
  });

  it("affiche la catchline de défaite du dresseur lorsque le joueur gagne (phase victory)", () => {
    render(
      <BattleCatchlines
        trainerName="Fouad"
        introCatchline="Intro"
        victoryCatchline="J'ai gagné !"
        defeatCatchline="Mes routeurs ont surchauffé..."
        currentPhase="victory"
      />
    );

    expect(screen.getByText(/Mes routeurs ont surchauffé.../)).toBeDefined();
    expect(screen.getByText("Victoire !")).toBeDefined();
  });

  it("affiche la catchline de victoire du dresseur lorsque le joueur perd (phase defeat)", () => {
    render(
      <BattleCatchlines
        trainerName="Fouad"
        introCatchline="Intro"
        victoryCatchline="Reviens réviser le modèle OSI !"
        defeatCatchline="Défaite"
        currentPhase="defeat"
      />
    );

    expect(screen.getByText(/Reviens réviser le modèle OSI !/)).toBeDefined();
    expect(screen.getByText("Défaite...")).toBeDefined();
  });

  it("ne s'affiche pas pendant les tours de combat normaux (phase turn)", () => {
    const { container } = render(
      <BattleCatchlines
        trainerName="Fouad"
        introCatchline="Intro"
        victoryCatchline="Victoire"
        defeatCatchline="Défaite"
        currentPhase="turn"
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
