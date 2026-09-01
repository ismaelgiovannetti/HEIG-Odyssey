import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaignProgress: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
    },
  },
}));

import {
  getCampaignProgressForUser,
  canUserAccessStage,
} from "@/lib/campaign/campaign-service";

describe("Campaign Service (US-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCampaignProgressForUser", () => {
    it("débloque uniquement la première étape du Bachelor 1 pour un nouveau joueur", async () => {
      // Aucun progrès en base
      mocks.findMany.mockResolvedValue([]);

      const overview = await getCampaignProgressForUser("user-new");

      expect(overview.worlds.length).toBe(8);
      expect(overview.totalCompletedStages).toBe(0);
      expect(overview.totalStages).toBeGreaterThan(0);

      // Bachelor 1
      const b1 = overview.worlds.find((w) => w.id === "bachelor-1");
      expect(b1).toBeDefined();
      expect(b1?.status).toBe("ACCESSIBLE");
      expect(b1?.isCompleted).toBe(false);

      // Étape 1 : accessible
      expect(b1?.stages[0].status).toBe("ACCESSIBLE");
      expect(b1?.stages[0].isAccessible).toBe(true);
      expect(b1?.stages[0].isLocked).toBe(false);
      expect(b1?.stages[0].isCompleted).toBe(false);

      // Étape 2 : verrouillée
      expect(b1?.stages[1].status).toBe("LOCKED");
      expect(b1?.stages[1].isAccessible).toBe(false);
      expect(b1?.stages[1].isLocked).toBe(true);

      // Bachelor 2 : verrouillé (car aucune étape accessible)
      const b2 = overview.worlds.find((w) => w.id === "bachelor-2");
      expect(b2?.status).toBe("LOCKED");
      expect(b2?.isLocked).toBe(true);

      // Prochaine étape recommandée : première étape
      expect(overview.nextRecommendedStage?.id).toBe("bachelor-1-stage-1");
    });

    it("reflète la reprise de session avec étapes complétées et étapes suivantes débloquées", async () => {
      // Le joueur a complété l'étape 1 et l'étape 2 du Bachelor 1
      mocks.findMany.mockResolvedValue([
        {
          id: "prog-1",
          userId: "user-1",
          worldId: "bachelor-1",
          stageId: "bachelor-1-stage-1",
          isCompleted: true,
          firstClearedAt: new Date("2026-08-01"),
        },
        {
          id: "prog-2",
          userId: "user-1",
          worldId: "bachelor-1",
          stageId: "bachelor-1-stage-2",
          isCompleted: true,
          firstClearedAt: new Date("2026-08-02"),
        },
      ]);

      const overview = await getCampaignProgressForUser("user-1");

      const b1 = overview.worlds.find((w) => w.id === "bachelor-1");
      expect(b1).toBeDefined();

      // Étapes 1 et 2 complétées
      expect(b1?.stages[0].status).toBe("COMPLETED");
      expect(b1?.stages[0].isCompleted).toBe(true);
      expect(b1?.stages[1].status).toBe("COMPLETED");
      expect(b1?.stages[1].isCompleted).toBe(true);

      // Étape 3 accessible car son prérequis (stage-2) est complété
      expect(b1?.stages[2].status).toBe("ACCESSIBLE");
      expect(b1?.stages[2].isAccessible).toBe(true);
      expect(b1?.stages[2].isLocked).toBe(false);

      // Étape 4 encore verrouillée
      expect(b1?.stages[3].status).toBe("LOCKED");

      expect(overview.totalCompletedStages).toBe(2);
      expect(overview.nextRecommendedStage?.id).toBe("bachelor-1-stage-3");
    });

    it("marque un monde comme COMPLETED lorsque toutes ses étapes sont remportées", async () => {
      // Toutes les étapes de Bachelor 1 complétées (6 étapes)
      const b1StagesCompleted = [
        "bachelor-1-stage-1",
        "bachelor-1-stage-2",
        "bachelor-1-stage-3",
        "bachelor-1-stage-4",
        "bachelor-1-stage-5",
        "bachelor-1-stage-6",
      ].map((stageId) => ({
        id: `prog-${stageId}`,
        userId: "user-1",
        worldId: "bachelor-1",
        stageId,
        isCompleted: true,
        firstClearedAt: new Date(),
      }));

      mocks.findMany.mockResolvedValue(b1StagesCompleted);

      const overview = await getCampaignProgressForUser("user-1");

      const b1 = overview.worlds.find((w) => w.id === "bachelor-1");
      expect(b1?.status).toBe("COMPLETED");
      expect(b1?.isCompleted).toBe(true);
      expect(b1?.completedStagesCount).toBe(6);

      // Bachelor 2 devient ACCESSIBLE grâce à la fin du monde Bachelor 1
      const b2 = overview.worlds.find((w) => w.id === "bachelor-2");
      expect(b2?.status).toBe("ACCESSIBLE");
      expect(b2?.stages[0].status).toBe("ACCESSIBLE");
    });
  });

  describe("canUserAccessStage (T-US07-06)", () => {
    it("autorise immédiatement l'accès à une étape sans prérequis (bachelor-1-stage-1)", async () => {
      const result = await canUserAccessStage("user-1", "bachelor-1-stage-1");

      expect(result.allowed).toBe(true);
      expect(result.stage?.id).toBe("bachelor-1-stage-1");
      expect(result.trainerId).toBe("trainer-b1-stage-1");
      expect(mocks.findUnique).not.toHaveBeenCalled();
    });

    it("refuse l'accès à une étape verrouillée si le prérequis n'est pas validé en base", async () => {
      mocks.findUnique.mockResolvedValue(null);

      const result = await canUserAccessStage("user-1", "bachelor-1-stage-2");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("verrouillée");
      expect(mocks.findUnique).toHaveBeenCalledWith({
        where: {
          userId_stageId: {
            userId: "user-1",
            stageId: "bachelor-1-stage-1",
          },
        },
      });
    });

    it("autorise l'accès à une étape si son prérequis est marqué isCompleted: true", async () => {
      mocks.findUnique.mockResolvedValue({
        userId: "user-1",
        stageId: "bachelor-1-stage-1",
        isCompleted: true,
      });

      const result = await canUserAccessStage("user-1", "bachelor-1-stage-2");

      expect(result.allowed).toBe(true);
      expect(result.stage?.id).toBe("bachelor-1-stage-2");
    });

    it("autorise le combat indépendamment du niveau recommandé (caractère non-bloquant)", async () => {
      // Doctorat Stage 1 requiert master-2-stage-12 avec niveau recommandé 90
      mocks.findUnique.mockResolvedValue({
        userId: "user-1",
        stageId: "master-2-stage-12",
        isCompleted: true,
      });

      const result = await canUserAccessStage("user-1", "doctorat-stage-1");

      expect(result.allowed).toBe(true);
      expect(result.stage?.recommendedLevel).toBe(90);
    });

    it("retourne une erreur si l'étape demandée n'existe pas", async () => {
      const result = await canUserAccessStage("user-1", "stage-inexistant-999");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("introuvable");
    });
  });
});
