// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { CampaignMap } from "@/components/campaign/campaign-map";
import type { CampaignProgressOverview } from "@/lib/campaign/campaign-service";

const sampleOverview: CampaignProgressOverview = {
  currentWorldId: "bachelor-1",
  totalCompletedStages: 1,
  totalStages: 6,
  nextRecommendedStage: null,
  worlds: [
    {
      id: "bachelor-1",
      name: "Bachelor 1 - Type Normal",
      degree: "BACHELOR",
      description: "Première étape du cursus d'ingénierie.",
      status: "ACCESSIBLE",
      completedStagesCount: 1,
      totalStagesCount: 3,
      isCompleted: false,
      isAccessible: true,
      isLocked: false,
      stages: [
        {
          id: "bachelor-1-stage-1",
          stageNumber: 1,
          name: "Laboratoire Normal - Étape 1",
          description: "Affrontez un étudiant de première année.",
          recommendedLevel: 6,
          trainerId: "trainer-b1-stage-1",
          trainerName: "Étudiant Normal 1",
          trainerTitle: "Étudiant Bachelor - Semestre 1",
          trainerSprite: "/sprites/trainer-player-back.png",
          prerequisiteStageId: null,
          rewardMoney: 40,
          rewardXp: 70,
          status: "COMPLETED",
          isCompleted: true,
          isAccessible: true,
          isLocked: false,
          firstClearedAt: new Date(),
        },
        {
          id: "bachelor-1-stage-2",
          stageNumber: 2,
          name: "Laboratoire Normal - Étape 2",
          description: "Deuxième épreuve normale.",
          recommendedLevel: 8,
          trainerId: "trainer-b1-stage-2",
          trainerName: "Étudiant Normal 2",
          trainerTitle: "Étudiant Bachelor - Semestre 1",
          trainerSprite: "/sprites/trainer-player-back.png",
          prerequisiteStageId: "bachelor-1-stage-1",
          rewardMoney: 50,
          rewardXp: 90,
          status: "ACCESSIBLE",
          isCompleted: false,
          isAccessible: true,
          isLocked: false,
          firstClearedAt: null,
        },
        {
          id: "bachelor-1-stage-3",
          stageNumber: 3,
          name: "Laboratoire Normal - Étape 3",
          description: "Troisième épreuve normale.",
          recommendedLevel: 10,
          trainerId: "trainer-b1-stage-3",
          trainerName: "Étudiant Normal 3",
          trainerTitle: "Étudiant Bachelor - Semestre 1",
          trainerSprite: "/sprites/trainer-player-back.png",
          prerequisiteStageId: "bachelor-1-stage-2",
          rewardMoney: 60,
          rewardXp: 110,
          status: "LOCKED",
          isCompleted: false,
          isAccessible: false,
          isLocked: true,
          firstClearedAt: null,
        },
      ],
    },
    {
      id: "bachelor-2",
      name: "Bachelor 2 - Combat & Vol",
      degree: "BACHELOR",
      description: "Deuxième monde de la campagne.",
      status: "LOCKED",
      completedStagesCount: 0,
      totalStagesCount: 3,
      isCompleted: false,
      isAccessible: false,
      isLocked: true,
      stages: [
        {
          id: "bachelor-2-stage-1",
          stageNumber: 1,
          name: "Arène Combat - Étape 1",
          description: "Premier défi de Bachelor 2.",
          recommendedLevel: 15,
          trainerId: "trainer-b2-stage-1",
          trainerName: "Étudiant Combat 1",
          trainerTitle: "Étudiant Bachelor - Semestre 2",
          trainerSprite: "/sprites/trainer-player-back.png",
          prerequisiteStageId: "bachelor-1-stage-3",
          rewardMoney: 80,
          rewardXp: 150,
          status: "LOCKED",
          isCompleted: false,
          isAccessible: false,
          isLocked: true,
          firstClearedAt: null,
        },
      ],
    },
  ],
};

const startedBattle = {
  success: true,
  battleId: "battle-12345",
  trainer: {
    id: "trainer-b1-stage-2",
    name: "Étudiant Normal 2",
    title: "Étudiant Bachelor - Semestre 1",
    sprite: "/sprites/trainer-player-back.png",
    introCatchline: "Montre-moi ce que tu as appris !",
  },
  state: {
    battleId: "battle-12345",
    turn: 0,
    phase: "action_selection",
    winner: null,
    logs: ["Le combat commence."],
    p1: {
      sideId: "p1",
      name: "Joueur",
      activePokemonIndex: 0,
      team: [
        {
          id: "p1-bulbasaur",
          speciesId: "bulbasaur",
          name: "Bulbizarre",
          level: 8,
          types: ["Grass", "Poison"],
          currentHp: 28,
          maxHp: 28,
          hpPercent: 100,
          status: null,
          moves: [{ id: "tackle", name: "Charge", type: "Normal", category: "physical", power: 40, accuracy: 100, pp: 35, maxPp: 35 }],
          isShiny: false,
          isActive: true,
          isFainted: false,
          baseStats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 },
        },
      ],
    },
    p2: {
      sideId: "p2",
      name: "Étudiant Normal 2",
      activePokemonIndex: 0,
      team: [
        {
          id: "p2-rattata",
          speciesId: "rattata",
          name: "Rattata",
          level: 8,
          types: ["Normal"],
          currentHp: 24,
          maxHp: 24,
          hpPercent: 100,
          status: null,
          moves: [{ id: "tackle", name: "Charge", type: "Normal", category: "physical", power: 40, accuracy: 100, pp: 35, maxPp: 35 }],
          isShiny: false,
          isActive: true,
          isFainted: false,
          baseStats: { hp: 30, attack: 56, defense: 35, specialAttack: 25, specialDefense: 35, speed: 72 },
        },
      ],
    },
  },
};

describe("CampaignMap Component (US-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche la navigation des mondes et le monde actif", () => {
    render(<CampaignMap overview={sampleOverview} />);

    expect(
      screen.getByRole("heading", { name: /Campagne - Bachelor 1/i }),
    ).toBeDefined();

    expect(
      screen.getByRole("button", { name: /Bachelor 1 - Type Normal/i }),
    ).toBeDefined();
  });

  it("distingue les étapes terminées, accessibles et verrouillées", () => {
    render(<CampaignMap overview={sampleOverview} />);

    // Les états sont portés par les nœuds afin d'être visibles et annoncés au clavier.
    expect(
      screen.getByRole("button", { name: /Étape 1 - Terminée/i }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /Étape 2 - Disponible/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Étape 3 - Verrouillée/i })).toBeDefined();
  });

  it("présente la difficulté sans utiliser le niveau comme verrou d'interface", () => {
    render(<CampaignMap overview={sampleOverview} />);

    expect(screen.getByLabelText(/Difficulté 1 sur 5/i)).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: /Lancer le combat : Laboratoire Normal - Étape 2/i })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("permet de basculer vers un autre monde", async () => {
    const user = userEvent.setup();
    render(<CampaignMap overview={sampleOverview} />);

    const b2Tab = screen.getByRole("button", {
      name: /Bachelor 2 - Combat & Vol/i,
    });
    await user.click(b2Tab);

    expect(screen.getByRole("heading", { name: /Campagne - Bachelor 2/i })).toBeDefined();
    expect(screen.getByText("Arène Combat - Étape 1")).toBeDefined();
  });

  it("lance un combat lors du clic sur le bouton défier d'une étape accessible", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => startedBattle,
    });

    render(<CampaignMap overview={sampleOverview} />);

    const challengeButton = screen.getByRole("button", {
      name: /Lancer le combat : Laboratoire Normal - Étape 2/i,
    });
    await user.click(challengeButton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/battle/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: "bachelor-1-stage-2" }),
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", {
        name: "Étudiant Normal 2",
      })).toBeDefined();
    });
  });
});
