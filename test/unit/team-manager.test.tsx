// @vitest-environment jsdom

import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftFromCollection, movePokemon } from "@/lib/team/team-draft";
import type { UpdateTeamInput } from "@/lib/team/team-contract";
import {
  snapshotAfterSave,
  teamPokemon,
  teamSnapshot,
} from "../helpers/team-interface-fixture";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/components/SpriteProvider", () => ({
  SpriteProvider: ({
    speciesId,
    variant,
  }: {
    speciesId: string;
    variant: string;
  }) => <span data-sprite={speciesId} data-variant={variant} />,
}));

import { TeamManager } from "@/components/team/team-manager";

// L'interface envoie toujours toutes les positions du PC, même si l'API
// permet à d'autres clients de ne modifier que l'équipe active.
type FullTeamInput = Required<UpdateTeamInput>;

const api = vi.fn<typeof fetch>();
const nativeDialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "showModal",
  ),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close"),
};
const response = (body: unknown = teamSnapshot(), status = 200) =>
  new Response(JSON.stringify(body), { status });
const teamSlot = (slot: number) =>
  screen.getByRole("button", {
    name: new RegExp(`^Équipe, emplacement ${slot} :`),
  });
const pcSlot = (slot: number, box = 1) =>
  screen.getByRole("button", {
    name: new RegExp(`^Boîte ${box}, case ${slot} :`),
  });
const detailsButton = (name: string) =>
  screen.getByRole("button", {
    name: `Voir les détails de ${name}`,
  }) as HTMLButtonElement;
async function waitForSave(count = 1) {
  await waitFor(() => {
    expect(navigation.refresh).toHaveBeenCalledTimes(count);
    expect(teamSlot(1).getAttribute("aria-disabled")).toBe("false");
  });
}

async function openPc() {
  render(<TeamManager />);
  await screen.findByRole("grid", { name: "Boîte 1" });
}

describe("interface de gestion d'équipe", () => {
  beforeEach(() => {
    // JSDOM ne gère pas la couche modale du navigateur. On simule uniquement
    // son ouverture et sa fermeture ; le confinement natif de Tab se vérifie en navigateur.
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      }),
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute("open");
      }),
    });
    let server = teamSnapshot();
    // La fausse API conserve chaque version : un deuxième déplacement doit
    // utiliser la révision confirmée, et une relecture doit retrouver le PC.
    api.mockReset().mockImplementation(async (_url, options) => {
      if (options?.method === "PUT") {
        const input = JSON.parse(String(options.body)) as FullTeamInput;
        if (input.expectedRevision !== server.revision) {
          return response({ code: "COLLECTION_CHANGED" }, 409);
        }
        server = snapshotAfterSave(server, {
          team: input.teamPokemonIds,
          pc: input.pcPlacements,
        });
      }
      return response(server);
    });
    navigation.refresh.mockClear();
    vi.stubGlobal("fetch", api);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const [method, descriptor] of Object.entries(nativeDialogMethods)) {
      if (descriptor)
        Object.defineProperty(HTMLDialogElement.prototype, method, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, method);
    }
  });

  it("présente six places, une grille 7 × 10 et aucune recherche", async () => {
    await openPc();
    expect(
      within(
        screen.getByRole("group", { name: "Emplacements de l'équipe" }),
      ).getAllByRole("button", { name: /^Équipe, emplacement/ }),
    ).toHaveLength(6);
    expect(screen.getAllByRole("row")).toHaveLength(10);
    expect(screen.getAllByRole("gridcell")).toHaveLength(70);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Enregistrer l’équipe" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Annuler les modifications" }),
    ).toBeNull();
    expect(screen.queryByText("Un dernier geste pour sauvegarder")).toBeNull();
    expect(
      screen.getByText(
        /Chaque déplacement ou échange enregistre automatiquement/,
      ),
    ).toBeDefined();
    expect(
      pcSlot(2).querySelector('[data-variant="front_shiny"]'),
    ).not.toBeNull();
  });

  it("enregistre automatiquement un échange au clavier et le retrouve après rechargement", async () => {
    const user = userEvent.setup();
    await openPc();
    // Une flèche rejoint la deuxième colonne de l'équipe, la suivante le PC.
    await user.click(teamSlot(1));
    await user.keyboard("{ArrowRight}{ArrowRight}{Enter}");
    await waitForSave();
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Carapuce");
    expect(pcSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(document.activeElement).toBe(pcSlot(1));
    expect(api).toHaveBeenCalledTimes(2);
    cleanup();
    await openPc();
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Carapuce");
    expect(pcSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(api).toHaveBeenCalledTimes(3);
    expect(api.mock.calls[2][1]?.method).toBe("GET");
  });

  it("parcourt les deux colonnes d'équipe sans prise ni sauvegarde", async () => {
    const user = userEvent.setup();
    await openPc();
    act(() => teamSlot(1).focus());
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(teamSlot(2));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(teamSlot(4));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(teamSlot(6));
    await user.keyboard("{ArrowLeft}{ArrowUp}");
    expect(document.activeElement).toBe(teamSlot(3));
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("porte les états de déplacement sur la carte entière, y compris une place vide", async () => {
    await openPc();
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "",
      dropEffect: "",
    };
    const source = teamSlot(1);
    const empty = teamSlot(3);
    expect(empty.parentElement?.hasAttribute("data-empty")).toBe(true);
    fireEvent.dragStart(source, { dataTransfer });
    expect(source.parentElement?.hasAttribute("data-picked")).toBe(true);
    expect(source.hasAttribute("data-picked")).toBe(false);
    fireEvent.dragOver(empty, { dataTransfer });
    expect(empty.parentElement?.hasAttribute("data-over")).toBe(true);
    expect(empty.hasAttribute("data-over")).toBe(false);
    fireEvent.dragEnd(source);
    expect(source.parentElement?.hasAttribute("data-picked")).toBe(false);
    expect(empty.parentElement?.hasAttribute("data-over")).toBe(false);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("annule une prise avec Échap sans écrire sur le serveur", async () => {
    const user = userEvent.setup();
    await openPc();
    await user.click(pcSlot(1));
    await user.keyboard("{ArrowRight}{Escape}");
    expect(pcSlot(1).getAttribute("aria-pressed")).toBe("false");
    expect(api).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toContain(
      "Déplacement annulé",
    );
  });

  it("transporte un Pokémon vers une autre boîte au clavier", async () => {
    const user = userEvent.setup();
    await openPc();
    await user.click(pcSlot(1));
    await user.keyboard("{PageDown}{Enter}");
    await waitForSave();
    expect(pcSlot(1, 2).getAttribute("aria-label")).toContain("Carapuce");
    await user.click(screen.getByRole("button", { name: "Boîte précédente" }));
    expect(pcSlot(1).getAttribute("aria-label")).toContain("vide");
  });

  it("utilise le même échange en glisser-déposer et ignore les dépôts externes", async () => {
    await openPc();
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "",
      dropEffect: "",
    };
    fireEvent.drop(pcSlot(1), { dataTransfer });
    expect(api).toHaveBeenCalledTimes(1);
    fireEvent.dragStart(teamSlot(1), { dataTransfer });
    fireEvent.dragOver(pcSlot(1), { dataTransfer });
    fireEvent.drop(pcSlot(1), { dataTransfer });
    await waitForSave();
    expect(api).toHaveBeenCalledTimes(2);
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Carapuce");
    expect(pcSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
  });

  it("enregistre toutes les boîtes et adopte la réponse du serveur", async () => {
    const user = userEvent.setup();
    const initial = teamSnapshot();
    const changed = movePokemon(
      draftFromCollection(initial.pokemon),
      { area: "team", slot: 1 },
      { area: "pc", box: 1, slot: 1 },
      initial.pokemon,
    ).draft;
    const saved = snapshotAfterSave(initial, changed);
    // Le niveau modifié dans la réponse prouve que le client relit bien celle-ci.
    saved.pokemon[2].level = 9;
    api
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response(saved));
    await openPc();
    await user.click(teamSlot(1));
    await user.click(pcSlot(1));
    await waitForSave();
    const [, options] = api.mock.calls[1];
    expect(options?.method).toBe("PUT");
    expect(options?.credentials).toBe("same-origin");
    expect(JSON.parse(String(options?.body))).toEqual({
      expectedRevision: 7,
      teamPokemonIds: ["charlie", "bravo"],
      pcPlacements: changed.pc,
    });
    expect(teamSlot(1).getAttribute("aria-label")).toContain("niveau 9");
    expect(screen.getByRole("status").textContent).toContain("enregistrés");
  });

  it("garde le brouillon en cas de conflit et n'écrase rien automatiquement", async () => {
    const user = userEvent.setup();
    api
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ code: "COLLECTION_CHANGED" }, 409));
    await openPc();
    await user.click(teamSlot(1));
    await user.click(pcSlot(1));
    await screen.findByRole("alert");
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Carapuce");
    expect(teamSlot(1).getAttribute("aria-disabled")).toBe("true");
    await user.click(pcSlot(2));
    expect(pcSlot(2).getAttribute("aria-pressed")).toBe("false");
    expect(api).toHaveBeenCalledTimes(2);
    expect(navigation.refresh).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(
      screen.getByRole("button", { name: "Recharger la collection" }),
    );
    expect(api).toHaveBeenCalledTimes(2);
    await user.click(
      screen.getByRole("button", { name: "Recharger la collection" }),
    );
    await waitFor(() =>
      expect(teamSlot(1).getAttribute("aria-label")).toContain("Bulbizarre"),
    );
    expect(api.mock.calls[2][1]?.method).toBe("GET");
  });

  it("bloque une nouvelle sauvegarde après une coupure réseau ambiguë", async () => {
    const user = userEvent.setup();
    api
      .mockResolvedValueOnce(response())
      .mockRejectedValueOnce(new TypeError("Network error"));
    await openPc();
    await user.click(teamSlot(1));
    await user.click(pcSlot(1));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "peut-être abouti",
    );
    expect(teamSlot(1).getAttribute("aria-disabled")).toBe("true");
    await user.click(pcSlot(2));
    await user.click(teamSlot(2));
    expect(api).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toContain(
      "Sauvegarde non confirmée",
    );
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("explique une session expirée et un chargement impossible", async () => {
    const user = userEvent.setup();
    api
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(response({}, 401));
    render(<TeamManager />);
    await user.click(
      await screen.findByRole("button", { name: "Recharger la collection" }),
    );
    expect(
      (
        await screen.findByRole("link", { name: "Vérifier ma session" })
      ).getAttribute("href"),
    ).toBe("/auth/continue");
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("bloque les déplacements et les doubles écritures pendant la sauvegarde", async () => {
    const user = userEvent.setup();
    let resolveSave!: (response: Response) => void;
    api.mockResolvedValueOnce(response()).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveSave = resolve;
        }),
    );
    await openPc();
    await user.click(teamSlot(1));
    await user.click(pcSlot(1));
    expect(screen.getByRole("status").textContent).toContain(
      "Enregistrement automatique",
    );
    expect(teamSlot(1).getAttribute("aria-disabled")).toBe("true");
    expect(detailsButton("Carapuce").disabled).toBe(true);
    await user.click(detailsButton("Carapuce"));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(pcSlot(2));
    expect(pcSlot(2).getAttribute("aria-pressed")).toBe("false");
    expect(api).toHaveBeenCalledTimes(2);
    const input = JSON.parse(
      String(api.mock.calls[1][1]?.body),
    ) as FullTeamInput;
    resolveSave(
      response(
        snapshotAfterSave(teamSnapshot(), {
          team: input.teamPokemonIds,
          pc: input.pcPlacements,
        }),
      ),
    );
    await waitForSave();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("affiche une collection représentative sans augmenter le nombre de cases visibles", async () => {
    const data = teamSnapshot();
    data.pokemon = data.pokemon.filter((p) => p.teamPosition !== null);
    for (let i = 0; i < 210; i++)
      data.pokemon.push(
        teamPokemon({
          id: `stored-${i}`,
          boxNumber: Math.floor(i / 70) + 1,
          boxSlot: (i % 70) + 1,
        }),
      );
    data.count = data.pokemon.length;
    api.mockResolvedValueOnce(response(data));
    await openPc();
    expect(screen.getAllByRole("gridcell")).toHaveLength(70);
    expect(screen.getByText("1 / 15 · 70 / 70 places")).toBeDefined();
  });

  it("explique le refus de retirer le dernier Pokémon et conserve sa place", async () => {
    const user = userEvent.setup();
    const data = teamSnapshot();
    data.pokemon = [data.pokemon[0]];
    data.count = 1;
    api.mockResolvedValueOnce(response(data));
    await openPc();
    await user.click(teamSlot(1));
    await user.click(pcSlot(1));
    expect(screen.getByRole("alert").textContent).toContain(
      "au moins un Pokémon",
    );
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(pcSlot(1).getAttribute("aria-label")).toContain("vide");
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("avertit avant de quitter pendant la sauvegarde puis libère la navigation", async () => {
    const user = userEvent.setup();
    let resolveSave!: (response: Response) => void;
    api.mockResolvedValueOnce(response()).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveSave = resolve;
        }),
    );
    await openPc();
    await user.click(teamSlot(1));
    await user.click(pcSlot(1));
    vi.mocked(window.confirm).mockReturnValue(false);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen
      .getByRole("link", { name: "Retour à l'accueil" })
      .dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Une sauvegarde est en cours"),
    );
    const beforeSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeSave);
    expect(beforeSave.defaultPrevented).toBe(true);
    resolveSave(response());
    await waitForSave();
    const afterSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterSave);
    expect(afterSave.defaultPrevented).toBe(false);
  });

  it("supporte le remontage de développement sans garder une réponse périmée", async () => {
    render(
      <StrictMode>
        <TeamManager />
      </StrictMode>,
    );
    await screen.findByRole("grid", { name: "Boîte 1" });
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(
      api.mock.calls.every(([, options]) => options?.method === "GET"),
    ).toBe(true);
  });

  it("ne sauvegarde pas les prises, la navigation ou un dépôt sur la même case", async () => {
    const user = userEvent.setup();
    await openPc();
    await user.click(pcSlot(1));
    await user.keyboard("{PageDown}{PageUp}");
    await user.click(pcSlot(1));
    expect(api).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toContain(
      "rangement reste inchangé",
    );
  });

  it("enregistre deux changements successifs avec les révisions confirmées", async () => {
    const user = userEvent.setup();
    await openPc();
    await user.click(teamSlot(1));
    await user.click(pcSlot(1));
    await waitForSave();
    // Le deuxième échange ne doit ni annuler le premier ni réutiliser sa version.
    await user.click(pcSlot(1));
    await user.click(pcSlot(2));
    await waitForSave(2);
    const bodies = api.mock.calls
      .slice(1)
      .map(([, options]) => JSON.parse(String(options?.body)) as FullTeamInput);
    expect(bodies.map((input) => input.expectedRevision)).toEqual([7, 8]);
    expect(bodies[1].teamPokemonIds).toEqual(["charlie", "bravo"]);
    expect(bodies[1].pcPlacements).toEqual(
      expect.arrayContaining([
        { pokemonId: "alpha", boxNumber: 1, boxSlot: 2 },
        { pokemonId: "delta", boxNumber: 1, boxSlot: 1 },
      ]),
    );
    expect(api).toHaveBeenCalledTimes(3);
  });

  it("rétablit le rangement après un refus serveur puis permet un autre déplacement", async () => {
    const user = userEvent.setup();
    api.mockResolvedValueOnce(response()).mockResolvedValueOnce(
      response(
        {
          details: ["Cette composition est refusée."],
        },
        400,
      ),
    );
    await openPc();
    await user.click(teamSlot(1));
    await user.click(pcSlot(1));
    expect((await screen.findByRole("alert")).textContent).toContain("refusée");
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(pcSlot(1).getAttribute("aria-label")).toContain("Carapuce");
    expect(teamSlot(1).getAttribute("aria-disabled")).toBe("false");
    expect(screen.getByRole("status").textContent).toContain(
      "rangement enregistré est rétabli",
    );
    expect(navigation.refresh).not.toHaveBeenCalled();
    await user.click(pcSlot(1));
    await user.click(pcSlot(3));
    await waitForSave();
    expect(pcSlot(3).getAttribute("aria-label")).toContain("Carapuce");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      JSON.parse(String(api.mock.calls[2][1]?.body)).expectedRevision,
    ).toBe(7);
  });

  it("relit une sauvegarde ayant abouti malgré une réponse réseau perdue", async () => {
    const user = userEvent.setup();
    const initial = teamSnapshot();
    const changed = movePokemon(
      draftFromCollection(initial.pokemon),
      { area: "team", slot: 1 },
      { area: "pc", box: 1, slot: 1 },
      initial.pokemon,
    ).draft;
    api
      .mockResolvedValueOnce(response(initial))
      .mockRejectedValueOnce(new TypeError("Network error"))
      .mockResolvedValueOnce(response(snapshotAfterSave(initial, changed)));
    await openPc();
    await user.click(teamSlot(1));
    await user.click(pcSlot(1));
    await screen.findByRole("alert");
    await user.click(
      screen.getByRole("button", { name: "Recharger la collection" }),
    );
    await waitFor(() =>
      expect(teamSlot(1).getAttribute("aria-disabled")).toBe("false"),
    );
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Carapuce");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(api.mock.calls.map(([, options]) => options?.method)).toEqual([
      "GET",
      "PUT",
      "GET",
    ]);
  });

  it("propose les fiches uniquement sur les Pokémon actifs, sans panneau permanent", async () => {
    const user = userEvent.setup();
    await openPc();
    const team = screen.getByRole("group", {
      name: "Emplacements de l'équipe",
    });
    expect(
      within(team).getAllByRole("button", { name: /^Voir les détails de/ }),
    ).toHaveLength(2);
    expect(
      within(screen.getByRole("grid", { name: "Boîte 1" })).queryByRole(
        "button",
        {
          name: /^Voir les détails de/,
        },
      ),
    ).toBeNull();
    expect(screen.queryByRole("region", { name: /^Fiche de/ })).toBeNull();
    await user.hover(pcSlot(1));
    fireEvent.focus(pcSlot(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Les deux actions sont sœurs : aucun bouton interactif imbriqué.
    expect(
      detailsButton("Bulbizarre").parentElement?.closest("button"),
    ).toBeNull();
    expect(within(teamSlot(1)).queryByRole("button")).toBeNull();
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("ouvre la fiche complète sans déplacer ni enregistrer le Pokémon", async () => {
    const user = userEvent.setup();
    await openPc();
    const trigger = detailsButton("Bulbizarre");
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Bulbizarre" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(
      within(dialog).getByRole("heading", { name: "Statistiques" }),
    ).toBeDefined();
    expect(
      within(dialog).getByRole("heading", { name: "Capacités actuelles" }),
    ).toBeDefined();
    expect(within(dialog).getByText("Overgrow")).toBeDefined();
    expect(within(dialog).getByText("Hardy")).toBeDefined();
    expect(within(dialog).getByText("0 XP")).toBeDefined();
    expect(within(dialog).getByText("Charge")).toBeDefined();
    expect(within(dialog).getByText("0/35 PP")).toBeDefined();
    expect(within(dialog).getByText("Puissance : 35")).toBeDefined();
    expect(within(dialog).getByText("Précision : 95 %")).toBeDefined();
    expect(teamSlot(1).getAttribute("aria-pressed")).toBe("false");
    expect(api).toHaveBeenCalledTimes(1);
    expect(navigation.refresh).not.toHaveBeenCalled();
    const close = within(dialog).getByRole("button", {
      name: "Fermer la fiche du Pokémon",
    });
    expect(document.activeElement).toBe(close);
    await user.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("ouvre au clavier et restaure le focus et le défilement après Échap", async () => {
    const user = userEvent.setup();
    await openPc();
    const previousOverflow = document.documentElement.style.overflow;
    // Tab depuis la case rejoint son bouton de fiche, Entrée ouvre sans prise.
    act(() => teamSlot(1).focus());
    await user.tab();
    const trigger = detailsButton("Bulbizarre");
    expect(document.activeElement).toBe(trigger);
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", { name: "Bulbizarre" });
    expect(document.documentElement.style.overflow).toBe("hidden");
    // Dans le navigateur, Échap produit cet événement natif cancel.
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.documentElement.style.overflow).toBe(previousOverflow);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("n'ouvre pas une fiche pendant une prise et suit l'équipe après un échange", async () => {
    const user = userEvent.setup();
    await openPc();
    await user.click(pcSlot(1));
    expect(detailsButton("Bulbizarre").disabled).toBe(true);
    await user.click(detailsButton("Bulbizarre"));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(teamSlot(1));
    await waitForSave();
    expect(
      screen.queryByRole("button", { name: "Voir les détails de Bulbizarre" }),
    ).toBeNull();
    await user.click(detailsButton("Carapuce"));
    expect(
      await screen.findByRole("dialog", { name: "Carapuce" }),
    ).toBeDefined();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("affiche les informations absentes sans inventer de statistiques ou d'attaques", async () => {
    const user = userEvent.setup();
    const initial = teamSnapshot();
    Object.assign(initial.pokemon[0], {
      stats: null,
      moves: [],
      ability: null,
      nature: null,
    });
    api.mockResolvedValueOnce(response(initial));
    await openPc();
    await user.click(detailsButton("Bulbizarre"));
    const dialog = await screen.findByRole("dialog", { name: "Bulbizarre" });
    expect(
      within(dialog).getByText("Statistiques indisponibles."),
    ).toBeDefined();
    expect(
      within(dialog).getByText("Aucune capacité renseignée."),
    ).toBeDefined();
    expect(within(dialog).getByText("Non renseigné")).toBeDefined();
    expect(within(dialog).getByText("Non renseignée")).toBeDefined();
  });
});
