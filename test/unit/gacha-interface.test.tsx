// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GachaBannerConfig } from "@/lib/content/schemas";

const soundPlayerSpies = vi.hoisted(() => ({
  startPortalSearch: vi.fn(),
  startEggHatching: vi.fn(),
  preparePokemonCry: vi.fn(async () => undefined),
  playPokemonCry: vi.fn(async () => undefined),
  stop: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("@/lib/audio/gacha-sound-effects", () => ({
  GACHA_SEARCH_DURATION_MS: 3_000,
  GACHA_HATCH_DURATION_MS: 2_000,
  GachaSoundPlayer: class {
    startPortalSearch = soundPlayerSpies.startPortalSearch;
    startEggHatching = soundPlayerSpies.startEggHatching;
    preparePokemonCry = soundPlayerSpies.preparePokemonCry;
    playPokemonCry = soundPlayerSpies.playPokemonCry;
    stop = soundPlayerSpies.stop;
    destroy = soundPlayerSpies.destroy;
  },
}));

vi.mock("@/components/SpriteProvider", () => ({
  SpriteProvider: ({ alt, speciesId }: { alt: string; speciesId: string }) => (
    <span data-testid="pokemon-sprite">{alt || speciesId}</span>
  ),
}));

import { GachaShop } from "@/components/gacha/gacha-shop";

const banners: GachaBannerConfig[] = [
  {
    id: "banner-standard",
    name: "Clairière des Compagnons",
    description: "Les partenaires de base.",
    costPokedollars: 100,
    rates: { common: 0.7, rare: 0.25, epic: 0.05, shinyRate: 0.01 },
    poolSpecies: ["riolu", "starly"],
    isActive: true,
  },
  {
    id: "banner-mid",
    name: "Étoiles de Sinnoh",
    description: "Les évolutions intermédiaires.",
    costPokedollars: 250,
    rates: { common: 0, rare: 1, epic: 0, shinyRate: 0.01 },
    poolSpecies: ["ivysaur"],
    isActive: true,
  },
  {
    id: "banner-legendary",
    name: "Sanctuaire des Légendes",
    description: "Les partenaires légendaires.",
    costPokedollars: 1_000,
    rates: { common: 0, rare: 0, epic: 1, shinyRate: 0.01 },
    poolSpecies: ["mewtwo"],
    isActive: true,
  },
];

const previewSpecies = [
  { id: "riolu", name: "Riolu", dexNumber: 447, rarity: "RARE" as const },
  { id: "starly", name: "Étourmi", dexNumber: 396, rarity: "COMMON" as const },
  { id: "ivysaur", name: "Herbizarre", dexNumber: 2, rarity: "RARE" as const },
  { id: "mewtwo", name: "Mewtwo", dexNumber: 150, rarity: "EPIC" as const },
];

const successResponse = {
  success: true,
  data: {
    success: true,
    pullId: "pull-1",
    bannerId: "banner-standard",
    pokemon: {
      id: "pokemon-1",
      speciesId: "riolu",
      name: "Riolu",
      level: 5,
      isShiny: false,
      rarity: "RARE",
      nature: "Jolly",
      ivs: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 },
      currentHp: 20,
      maxHp: 20,
    },
    costPaid: 100,
    newBalance: 400,
    isDuplicate: false,
  },
};

describe("interface des portails gacha", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "pull-request-uuid") });
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
    };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("bloque clairement le portail dont le coût dépasse le solde", async () => {
    render(<GachaShop banners={banners} initialBalance={120} previewSpecies={previewSpecies} />);

    expect(screen.getByRole("heading", { name: "Invocations Pokémon" })).toBeTruthy();
    const unavailableButtons = screen.getAllByRole("button", { name: "Solde insuffisant" });
    expect(unavailableButtons).toHaveLength(2);
    expect(unavailableButtons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByText("Clairière des Compagnons").closest("article")?.dataset.theme).toBe("standard");
    expect(screen.getByText("Étoiles de Sinnoh").closest("article")?.dataset.theme).toBe("mid");
    expect(screen.getByText("Sanctuaire des Légendes").closest("article")?.dataset.theme).toBe("legendary");
  });

  it("affiche le pool du portail choisi dans un aperçu fermé sans défilement", () => {
    render(<GachaShop banners={banners} initialBalance={120} previewSpecies={previewSpecies} />);

    fireEvent.click(screen.getByRole("button", { name: "Aperçu de Clairière des Compagnons" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Clairière des Compagnons" })).toBeTruthy();
    expect(screen.getByText("2 Pokémon disponibles")).toBeTruthy();
    expect(screen.getAllByText("Riolu").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Étourmi").length).toBeGreaterThan(0);
    expect(screen.getByText("Commun · 70 %")).toBeTruthy();
    expect(screen.getByText("Rare · 25 %")).toBeTruthy();
    const previewCards = screen.getAllByRole("listitem");
    expect(previewCards[0].textContent).toContain("Étourmi");
    expect(previewCards[1].textContent).toContain("Riolu");
    expect(screen.queryByText("Herbizarre")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Fermer l’aperçu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("affiche l'éclosion, le résultat et synchronise le nouveau solde", async () => {
    vi.useFakeTimers();
    const balanceListener = vi.fn();
    window.addEventListener("heig-odyssey:player-balance", balanceListener);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(successResponse),
      }),
    );

    render(<GachaShop banners={banners} initialBalance={500} previewSpecies={previewSpecies} />);
    fireEvent.click(screen.getByRole("button", { name: /Invoquer pour 100/i }));

    expect(soundPlayerSpies.startPortalSearch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Un nouveau partenaire Pokémon répond à votre appel…")).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(2_999));
    expect(screen.getByText("Un nouveau partenaire Pokémon répond à votre appel…")).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByText("L’œuf est en train d’éclore…")).toBeTruthy();
    expect(soundPlayerSpies.startEggHatching).toHaveBeenCalledTimes(1);
    expect(soundPlayerSpies.preparePokemonCry).toHaveBeenCalledWith("riolu");
    expect(screen.queryByRole("button", { name: /Passer l’animation/i })).toBeNull();

    await act(async () => vi.advanceTimersByTimeAsync(1_999));
    expect(screen.getByText("L’œuf est en train d’éclore…")).toBeTruthy();
    expect(soundPlayerSpies.playPokemonCry).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));

    expect(soundPlayerSpies.playPokemonCry).toHaveBeenCalledTimes(1);
    expect(soundPlayerSpies.playPokemonCry).toHaveBeenCalledWith("riolu");
    expect(screen.getAllByText("Riolu").length).toBeGreaterThan(0);
    expect(screen.getByText("Nouveau Pokémon ajouté au PC")).toBeTruthy();
    expect(screen.getAllByText("400 ₽").length).toBeGreaterThan(0);
    expect(screen.queryByText("Coût du tirage")).toBeNull();
    expect((screen.getByRole("button", { name: /Tirer à nouveau/i }) as HTMLButtonElement).disabled).toBe(false);
    expect(balanceListener).toHaveBeenCalledTimes(1);

    const request = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String((request[1] as RequestInit).body))).toEqual({
      bannerId: "banner-standard",
      idempotencyKey: "pull-request-uuid",
    });
    window.removeEventListener("heig-odyssey:player-balance", balanceListener);
  });

  it("referme la popup et rend l'erreur serveur compréhensible", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: "Solde de Pokédollars insuffisant.",
        }),
      }),
    );

    render(<GachaShop banners={banners} initialBalance={500} previewSpecies={previewSpecies} />);
    fireEvent.click(screen.getByRole("button", { name: /Invoquer pour 100/i }));

    expect(screen.getByText("Un nouveau partenaire Pokémon répond à votre appel…")).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(soundPlayerSpies.stop).toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Solde de Pokédollars insuffisant");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignore un second clic tant que le tirage est en cours", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(<GachaShop banners={banners} initialBalance={500} previewSpecies={previewSpecies} />);
    const pullButton = screen.getByRole("button", { name: /Invoquer pour 100/i });

    fireEvent.click(pullButton);
    fireEvent.click(pullButton);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(soundPlayerSpies.startPortalSearch).toHaveBeenCalledTimes(1);
  });
});
