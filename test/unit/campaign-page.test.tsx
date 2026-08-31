// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      screen.getByRole("heading", { name: /Progression de la Campagne/i }),
    ).toBeDefined();

    expect(screen.getByText("Bachelor 1 - Type Normal")).toBeDefined();
    expect(screen.getByText("1 / 6")).toBeDefined();
  });

  it("distingue les étapes terminées, accessibles et verrouillées", () => {
    render(<CampaignMap overview={sampleOverview} />);

    // Étape 1 (Terminée)
    expect(screen.getByText("Victoire validée")).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Rejouer : Laboratoire Normal - Étape 1/i }),
    ).toBeDefined();

    // Étape 2 (Accessible)
    expect(screen.getByText("Disponible")).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: /Lancer le combat : Laboratoire Normal - Étape 2/i,
      }),
    ).toBeDefined();

    // Étape 3 (Verrouillée)
    expect(screen.getAllByText("Verrouillé").length).toBeGreaterThan(0);
    const lockedButton = screen.getAllByRole("button", {
      name: /Verrouillé/i,
    })[0];
    expect(lockedButton).toBeDefined();
    expect(lockedButton.hasAttribute("disabled")).toBe(true);
  });

  it("affiche clairement le niveau recommandé comme indication non-bloquante", () => {
    render(<CampaignMap overview={sampleOverview} />);

    expect(screen.getAllByText(/Niveau recommandé :/i).length).toBeGreaterThan(0);
    expect(screen.getByText("6")).toBeDefined();
    expect(screen.getAllByText("(non-bloquant)").length).toBeGreaterThan(0);
  });

  it("permet de basculer vers un autre monde", async () => {
    const user = userEvent.setup();
    render(<CampaignMap overview={sampleOverview} />);

    const b2Tab = screen.getByRole("button", {
      name: /Bachelor 2 - Combat & Vol/i,
    });
    await user.click(b2Tab);

    expect(screen.getByText("Bachelor 2 - Combat & Vol")).toBeDefined();
    expect(screen.getByText("Deuxième monde de la campagne.")).toBeDefined();
  });

  it("lance un combat lors du clic sur le bouton défier d'une étape accessible", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        battleId: "battle-12345",
        trainer: {
          name: "Étudiant Normal 2",
          title: "Étudiant Bachelor - Semestre 1",
          sprite: "/sprites/trainer-player-back.png",
          introCatchline: "Montre-moi ce que tu as appris !",
        },
      }),
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
      expect(
        screen.getByText(/Combat initialisé contre Étudiant Normal 2/i),
      ).toBeDefined();
    });
  });
});
