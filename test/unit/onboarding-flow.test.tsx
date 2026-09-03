// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const onboardingMocks = vi.hoisted(() => ({
  prefetch: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: onboardingMocks.useRouter }));

// Les sprites ont déjà leurs propres tests ; ce substitut garde ici le focus
// sur le parcours, les choix et le contrat envoyé à l'API.
vi.mock("@/components/SpriteProvider", () => ({
  SpriteProvider: ({ alt }: { alt: string }) => (
    <span data-testid="sprite">{alt}</span>
  ),
}));

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

const catalogResponse = {
  success: true,
  starters: [
    {
      speciesId: "bulbasaur",
      dexNumber: 1,
      name: "Bulbizarre",
      generation: 1,
      types: ["Grass", "Poison"],
      level: 5,
      moves: [{ id: "tackle", name: "Charge", type: "Normal" }],
      baseStats: {
        hp: 45,
        attack: 49,
        defense: 49,
        specialAttack: 65,
        specialDefense: 65,
        speed: 45,
      },
    },
    {
      speciesId: "charmander",
      dexNumber: 4,
      name: "Salamèche",
      generation: 1,
      types: ["Fire"],
      level: 5,
      moves: [{ id: "scratch", name: "Griffe", type: "Normal" }],
      baseStats: {
        hp: 39,
        attack: 52,
        defense: 43,
        specialAttack: 60,
        specialDefense: 50,
        speed: 65,
      },
    },
  ],
};

describe("interface d'onboarding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(
      async () => undefined,
    );
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );
    onboardingMocks.useRouter.mockReturnValue({
      prefetch: onboardingMocks.prefetch,
      refresh: onboardingMocks.refresh,
      replace: onboardingMocks.replace,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("présente la boucle de jeu avant la sélection", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(catalogResponse),
      }),
    );
    render(<OnboardingFlow />);

    expect(
      screen.getByRole("heading", {
        name: "Un partenaire, quatre façons de progresser",
      }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "Campagne" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Entraînement" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Équipe" })).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Boutique gacha" }),
    ).toBeDefined();
    await user.click(
      screen.getByRole("button", { name: "Choisir mon premier partenaire" }),
    );
    expect(
      (await screen.findAllByRole("button", { name: /Bulbizarre/ })).length,
    ).toBeGreaterThan(0);
  });

  it("recrute le choix confirmé sans envoyer d'identifiant utilisateur", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(catalogResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: vi.fn().mockResolvedValue({
          success: true,
          pokemon: {
            id: "pokemon-1",
            speciesId: "charmander",
            name: "Flamme",
            level: 5,
            isShiny: false,
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<OnboardingFlow />);
    await user.click(
      screen.getByRole("button", { name: "Choisir mon premier partenaire" }),
    );
    const salamecheButtons = await screen.findAllByRole("button", {
      name: /Salamèche/,
    });
    await user.click(salamecheButtons[0]);
    await user.click(screen.getByRole("button", { name: "Choisir Salamèche" }));
    await user.type(screen.getByLabelText(/Surnom/), "Flamme");
    await user.click(
      screen.getByRole("button", { name: "Confirmer le recrutement" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Flamme rejoint votre équipe !",
      }),
    ).toBeDefined();
    const body = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    );
    expect(body).toEqual({ speciesId: "charmander", nickname: "Flamme" });
    expect(body).not.toHaveProperty("userId");

    await user.click(
      screen.getByRole("button", { name: "Accéder à l’accueil" }),
    );
    expect(onboardingMocks.replace).toHaveBeenCalledWith("/dashboard");
    expect(onboardingMocks.refresh).toHaveBeenCalledOnce();
  });

  it("permet de retenter le chargement après une erreur du catalogue", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(catalogResponse),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<OnboardingFlow />);
    await user.click(
      screen.getByRole("button", { name: "Choisir mon premier partenaire" }),
    );

    expect(
      await screen.findByText(
        "Le catalogue ne peut pas être chargé pour le moment.",
      ),
    ).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(
      (await screen.findAllByRole("button", { name: /Bulbizarre/ })).length,
    ).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renvoie vers la connexion si la session expire pendant le recrutement", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(catalogResponse),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: vi.fn().mockResolvedValue({
            success: false,
            error: "Authentification requise.",
          }),
        }),
    );

    render(<OnboardingFlow />);
    await user.click(
      screen.getByRole("button", { name: "Choisir mon premier partenaire" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Choisir Bulbizarre",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirmer le recrutement" }),
    );

    await waitFor(() => {
      expect(onboardingMocks.replace).toHaveBeenCalledWith(
        "/login?sessionExpired=1",
      );
    });
  });

  it("affiche un conflit contrôlé lorsque le recrutement est rejoué", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(catalogResponse),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: vi.fn().mockResolvedValue({
            success: false,
            error: "L'onboarding a déjà été complété pour ce compte.",
          }),
        }),
    );

    render(<OnboardingFlow />);
    await user.click(
      screen.getByRole("button", { name: "Choisir mon premier partenaire" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Choisir Bulbizarre",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirmer le recrutement" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Ce recrutement a déjà été utilisé. Actualisez la page pour continuer.",
    );
    expect(
      screen.queryByRole("heading", { name: /rejoint votre équipe/ }),
    ).toBeNull();
  });
});
