import { beforeEach, describe, expect, it, vi } from "vitest";

// Les dépendances Next.js sont simulées pour vérifier uniquement la décision
// d'accès prise par chaque layout à partir de la session serveur.
const sessionMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerSession: sessionMocks.getServerSession,
}));

vi.mock("next/navigation", () => ({
  redirect: sessionMocks.redirect,
}));

import PublicAuthLayout from "@/app/(auth)/layout";
import ProtectedLayout from "@/app/(protected)/layout";

describe("gardes des pages d'authentification", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // La vraie fonction redirect interrompt immédiatement le rendu Next.js.
    sessionMocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`NEXT_REDIRECT:${destination}`);
    });
  });

  // Une page publique reste disponible tant qu'aucune session n'est active.
  it("laisse une session anonyme accéder aux formulaires publics", async () => {
    sessionMocks.getServerSession.mockResolvedValue(null);

    await expect(PublicAuthLayout({ children: "formulaire public" })).resolves.toBe(
      "formulaire public"
    );
    expect(sessionMocks.redirect).not.toHaveBeenCalled();
  });

  it("éloigne une session valide des formulaires publics", async () => {
    sessionMocks.getServerSession.mockResolvedValue({
      user: { id: "user-1" },
    });

    await expect(PublicAuthLayout({ children: "formulaire public" })).rejects.toThrow(
      "NEXT_REDIRECT:/auth/continue"
    );
    expect(sessionMocks.redirect).toHaveBeenCalledWith("/auth/continue");
  });

  // Une page privée ne doit jamais produire ses enfants pour un visiteur anonyme.
  it("refuse une page protégée sans session valide", async () => {
    sessionMocks.getServerSession.mockResolvedValue(null);

    await expect(ProtectedLayout({ children: "contenu privé" })).rejects.toThrow(
      "NEXT_REDIRECT:/login?sessionExpired=1"
    );
    expect(sessionMocks.redirect).toHaveBeenCalledWith("/login?sessionExpired=1");
  });

  it("autorise une session valide à afficher une page protégée", async () => {
    sessionMocks.getServerSession.mockResolvedValue({
      user: { id: "user-1" },
    });

    await expect(ProtectedLayout({ children: "contenu privé" })).resolves.toBe(
      "contenu privé"
    );
    expect(sessionMocks.redirect).not.toHaveBeenCalled();
  });
});
