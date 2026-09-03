import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getBannersRoute } from "@/app/api/gacha/banners/route";
import { POST as pullRoute } from "@/app/api/gacha/pull/route";
import * as gachaService from "@/lib/gacha/gacha-service";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock("@/lib/auth/environment", () => ({
  getApplicationOrigin: () => "http://localhost:3000",
}));

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/gacha/pull", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("Gacha API Routes (T-US12-02, T-US12-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/gacha/banners", () => {
    it("renvoie la liste des bannières actives avec code 200", async () => {
      const res = await getBannersRoute(
        new Request("http://localhost:3000/api/gacha/banners"),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0]).toHaveProperty("id");
      expect(json.data[0]).toHaveProperty("costPokedollars");
      expect(json.data[0]).toHaveProperty("rates");
    });
  });

  describe("POST /api/gacha/pull", () => {
    it("renvoie 401 si le joueur n'est pas authentifié", async () => {
      getSessionMock.mockResolvedValue(null);

      const req = new Request("http://localhost:3000/api/gacha/pull", {
        method: "POST",
        body: JSON.stringify({ bannerId: "banner-standard" }),
      });

      const res = await pullRoute(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Authentification requise");
    });

    it("renvoie 400 si le body est invalide", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "usr_123", emailVerified: true },
        session: { id: "ses_123" },
      });

      const req = postRequest({}); // Manque bannerId et clé d'idempotence.

      const res = await pullRoute(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("renvoie 400 si les fonds sont insuffisants", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "usr_poor", emailVerified: true },
        session: { id: "ses_123" },
      });

      vi.spyOn(gachaService, "executeGachaPull").mockRejectedValue(
        new gachaService.InsufficientFundsError("Solde insuffisant"),
      );

      const req = postRequest({
        bannerId: "banner-standard",
        idempotencyKey: "pull-poor-123",
      });

      const res = await pullRoute(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Solde insuffisant");
    });

    it("exécute le tirage et renvoie 200 avec les données du Pokémon obtenu", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "usr_rich", emailVerified: true },
        session: { id: "ses_123" },
      });

      vi.spyOn(gachaService, "executeGachaPull").mockResolvedValue({
        success: true,
        pullId: "pull_abc",
        bannerId: "banner-standard",
        pokemon: {
          id: "pkmn_xyz",
          speciesId: "riolu",
          name: "Riolu",
          level: 5,
          isShiny: false,
          rarity: "RARE",
          nature: "Jolly",
          ivs: { hp: 31, atk: 31, def: 31, spa: 10, spd: 25, spe: 31 },
          currentHp: 20,
          maxHp: 20,
        },
        costPaid: 100,
        newBalance: 900,
        isDuplicate: false,
      });

      const req = postRequest({
        bannerId: "banner-standard",
        idempotencyKey: "pull-rich-123",
      });

      const res = await pullRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.pokemon.speciesId).toBe("riolu");
      expect(json.data.newBalance).toBe(900);
    });

    it("refuse une origine différente avant toute dépense", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "usr_123", emailVerified: true },
        session: { id: "ses_123" },
      });

      const res = await pullRoute(
        postRequest(
          { bannerId: "banner-standard", idempotencyKey: "foreign-origin" },
          { Origin: "https://example.net" },
        ),
      );

      expect(res.status).toBe(403);
      expect(gachaService.executeGachaPull).not.toHaveBeenCalled();
    });

    it("refuse un compte dont l'adresse e-mail n'est pas vérifiée", async () => {
      getSessionMock.mockResolvedValue({
        user: { id: "usr_123", emailVerified: false },
        session: { id: "ses_123" },
      });

      const res = await pullRoute(
        postRequest({
          bannerId: "banner-standard",
          idempotencyKey: "email-unverified",
        }),
      );

      expect(res.status).toBe(403);
      expect(gachaService.executeGachaPull).not.toHaveBeenCalled();
    });
  });
});
