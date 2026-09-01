import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getQuestsRoute } from "@/app/api/quests/route";
import { POST as claimQuestRoute } from "@/app/api/quests/claim/route";
import { auth } from "@/lib/auth";
import * as questService from "@/lib/quests/quest-progress-service";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

describe("Quest API Routes (T-US13-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/quests", () => {
    it("renvoie 401 si le joueur n'est pas authentifié", async () => {
      (auth.api.getSession as any).mockResolvedValue(null);

      const req = new Request("http://localhost:3000/api/quests");
      const res = await getQuestsRoute(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it("renvoie 200 avec la liste des quêtes de l'utilisateur", async () => {
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "user-123" },
      });

      const mockQuestsState: any = {
        dailyPeriodKey: "2026-09-01",
        weeklyPeriodKey: "2026-W36",
        dailyQuests: [],
        weeklyQuests: [],
        allQuests: [],
      };

      vi.spyOn(questService, "getUserQuests").mockResolvedValue(mockQuestsState);

      const req = new Request("http://localhost:3000/api/quests");
      const res = await getQuestsRoute(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.dailyPeriodKey).toBe("2026-09-01");
    });
  });

  describe("POST /api/quests/claim", () => {
    it("renvoie 401 si le joueur n'est pas authentifié", async () => {
      (auth.api.getSession as any).mockResolvedValue(null);

      const req = new Request("http://localhost:3000/api/quests/claim", {
        method: "POST",
        body: JSON.stringify({ rotationId: "rot-123" }),
      });
      const res = await claimQuestRoute(req);

      expect(res.status).toBe(401);
    });

    it("renvoie 400 si le corps de requête est invalide", async () => {
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "user-123" },
      });

      const req = new Request("http://localhost:3000/api/quests/claim", {
        method: "POST",
        body: JSON.stringify({}), // rotationId manquant
      });
      const res = await claimQuestRoute(req);

      expect(res.status).toBe(400);
    });

    it("renvoie 200 lors d'une réclamation réussie", async () => {
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "user-123" },
      });

      vi.spyOn(questService, "claimQuestReward").mockResolvedValue({
        success: true,
        rotationId: "rot-123",
        rewardPokedollars: 100,
        rewardXp: 200,
        newBalance: 500,
      });

      const req = new Request("http://localhost:3000/api/quests/claim", {
        method: "POST",
        body: JSON.stringify({ rotationId: "rot-123" }),
      });
      const res = await claimQuestRoute(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.rewardPokedollars).toBe(100);
    });
  });
});
