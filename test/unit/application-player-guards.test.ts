import { beforeEach, describe, expect, it, vi } from "vitest";

const guardMocks = vi.hoisted(() => ({
  findProfile: vi.fn(),
  getServerSession: vi.fn(),
  redirect: vi.fn(),
}));

// Le marqueur et le cache React sont neutralisés pour isoler chaque scénario.
vi.mock("server-only", () => ({}));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    cache: <T extends (...arguments_: never[]) => unknown>(callback: T) =>
      callback,
  };
});

vi.mock("next/navigation", () => ({
  redirect: guardMocks.redirect,
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerSession: guardMocks.getServerSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userProfile: {
      findUnique: guardMocks.findProfile,
    },
  },
}));

import {
  getApplicationPlayer,
  getOnboardingPlayer,
  getPlayerAccessContext,
} from "@/lib/player/application-player";

describe("gardes serveur du joueur", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Next.js interrompt le rendu lorsqu'une redirection est décidée.
    guardMocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`NEXT_REDIRECT:${destination}`);
    });
  });

  it("ne consulte pas PostgreSQL pour une session absente", async () => {
    guardMocks.getServerSession.mockResolvedValue(null);

    await expect(getPlayerAccessContext()).resolves.toEqual({
      state: "anonymous",
    });
    expect(guardMocks.findProfile).not.toHaveBeenCalled();
  });

  it("construit le contexte uniquement depuis l'identité de session", async () => {
    guardMocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", name: "Kim" },
    });
    guardMocks.findProfile.mockResolvedValue({
      pokedollars: 1250,
      hasCompletedOnboarding: true,
    });

    await expect(getPlayerAccessContext()).resolves.toEqual({
      state: "ready",
      player: { id: "user-1", name: "Kim", pokedollars: 1250 },
    });
    expect(guardMocks.findProfile).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: {
        pokedollars: true,
        hasCompletedOnboarding: true,
      },
    });
  });

  it("traite un profil absent comme un onboarding requis", async () => {
    guardMocks.getServerSession.mockResolvedValue({
      user: { id: "legacy-user", name: "Kim" },
    });
    guardMocks.findProfile.mockResolvedValue(null);

    await expect(getPlayerAccessContext()).resolves.toEqual({
      state: "onboarding-required",
      player: { id: "legacy-user", name: "Kim", pokedollars: 0 },
    });
  });

  it("redirige un visiteur anonyme vers la connexion", async () => {
    guardMocks.getServerSession.mockResolvedValue(null);

    await expect(getApplicationPlayer()).rejects.toThrow(
      "NEXT_REDIRECT:/login?sessionExpired=1",
    );
  });

  it("redirige un joueur incomplet vers l'onboarding", async () => {
    guardMocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", name: "Kim" },
    });
    guardMocks.findProfile.mockResolvedValue({
      pokedollars: 0,
      hasCompletedOnboarding: false,
    });

    await expect(getApplicationPlayer()).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding",
    );
  });

  it("autorise un joueur prêt à charger le shell", async () => {
    guardMocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", name: "Kim" },
    });
    guardMocks.findProfile.mockResolvedValue({
      pokedollars: 90,
      hasCompletedOnboarding: true,
    });

    await expect(getApplicationPlayer()).resolves.toEqual({
      id: "user-1",
      name: "Kim",
      pokedollars: 90,
    });
  });

  it("autorise seulement un joueur incomplet sur l'onboarding", async () => {
    guardMocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", name: "Kim" },
    });
    guardMocks.findProfile.mockResolvedValue({
      pokedollars: 0,
      hasCompletedOnboarding: false,
    });

    await expect(getOnboardingPlayer()).resolves.toEqual({
      id: "user-1",
      name: "Kim",
    });
  });

  it("refuse l'onboarding à une session absente", async () => {
    guardMocks.getServerSession.mockResolvedValue(null);

    await expect(getOnboardingPlayer()).rejects.toThrow(
      "NEXT_REDIRECT:/login?sessionExpired=1",
    );
  });

  it("renvoie un joueur déjà initialisé vers le dashboard", async () => {
    guardMocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", name: "Kim" },
    });
    guardMocks.findProfile.mockResolvedValue({
      pokedollars: 90,
      hasCompletedOnboarding: true,
    });

    await expect(getOnboardingPlayer()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });
});
