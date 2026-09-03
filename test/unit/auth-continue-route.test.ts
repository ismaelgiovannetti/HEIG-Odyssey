import { beforeEach, describe, expect, it, vi } from "vitest";

// La route est testée à ses frontières : Better Auth fournit l'identité,
// Prisma fournit l'état d'onboarding et la configuration fournit l'origine sûre.
const routeMocks = vi.hoisted(() => ({
  findProfile: vi.fn(),
  getApplicationOrigin: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: routeMocks.getSession,
    },
  },
}));

vi.mock("@/lib/auth/environment", () => ({
  getApplicationOrigin: routeMocks.getApplicationOrigin,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userProfile: {
      findUnique: routeMocks.findProfile,
    },
  },
}));

import { GET } from "@/app/auth/continue/route";

const APPLICATION_ORIGIN = "https://heig-odyssey.online";

function createRequest(next?: string): Request {
  // Cet hôte volontairement non fiable prouve que la réponse n'utilise jamais
  // l'origine reçue dans la requête pour construire une redirection.
  const url = new URL("https://untrusted-host.example/auth/continue");
  if (next) {
    url.searchParams.set("next", next);
  }
  return new Request(url);
}

describe("GET /auth/continue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    routeMocks.getApplicationOrigin.mockReturnValue(APPLICATION_ORIGIN);
  });

  // Aucune lecture du profil n'est permise sans identité authentifiée.
  it("redirige une session absente vers la connexion", async () => {
    routeMocks.getSession.mockResolvedValue(null);

    const response = await GET(createRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `${APPLICATION_ORIGIN}/login?sessionExpired=1`,
    );
    expect(routeMocks.findProfile).not.toHaveBeenCalled();
  });

  // L'onboarding reste prioritaire sur la destination demandée par le client.
  it("redirige une session valide vers l'onboarding si le profil est incomplet", async () => {
    routeMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    routeMocks.findProfile.mockResolvedValue({ hasCompletedOnboarding: false });

    const response = await GET(createRequest("/campaign"));

    expect(routeMocks.findProfile).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { hasCompletedOnboarding: true },
    });
    expect(response.headers.get("location")).toBe(
      `${APPLICATION_ORIGIN}/onboarding`,
    );
  });

  it("traite un profil absent comme un onboarding incomplet", async () => {
    routeMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    routeMocks.findProfile.mockResolvedValue(null);

    const response = await GET(createRequest());

    expect(response.headers.get("location")).toBe(
      `${APPLICATION_ORIGIN}/onboarding`,
    );
  });

  // Un joueur initialisé peut reprendre le jeu depuis une destination interne.
  it("envoie un joueur prêt vers le tableau de bord par défaut", async () => {
    routeMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    routeMocks.findProfile.mockResolvedValue({ hasCompletedOnboarding: true });

    const response = await GET(createRequest());

    expect(response.headers.get("location")).toBe(
      `${APPLICATION_ORIGIN}/dashboard`,
    );
  });

  it("conserve une destination interne autorisée pour une session valide", async () => {
    routeMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    routeMocks.findProfile.mockResolvedValue({ hasCompletedOnboarding: true });

    const response = await GET(createRequest("/campaign?world=bachelor-1"));

    expect(response.headers.get("location")).toBe(
      `${APPLICATION_ORIGIN}/campaign?world=bachelor-1`,
    );
  });

  // Ces valeurs couvrent les redirections externes et les boucles d'authentification.
  it.each([
    "https://malicious.example",
    "//malicious.example",
    "/login",
    "/signup",
    "/verify-email",
    "/logout",
    "/auth/continue",
    "/onboarding",
  ])(
    "remplace la destination interdite %s par le tableau de bord",
    async (destination) => {
      routeMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
      routeMocks.findProfile.mockResolvedValue({
        hasCompletedOnboarding: true,
      });

      const response = await GET(createRequest(destination));

      expect(response.headers.get("location")).toBe(
        `${APPLICATION_ORIGIN}/dashboard`,
      );
    },
  );

  // Cette vérification empêche une régression vers request.url ou l'en-tête Host.
  it("utilise toujours l'origine configurée plutôt que l'hôte de la requête", async () => {
    routeMocks.getSession.mockResolvedValue(null);

    const response = await GET(createRequest());

    expect(response.headers.get("location")).not.toContain(
      "untrusted-host.example",
    );
    expect(routeMocks.getApplicationOrigin).toHaveBeenCalledOnce();
  });
});
