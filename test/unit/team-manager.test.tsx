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
    normalizeVisibleSize = false,
  }: {
    speciesId: string;
    variant: string;
    normalizeVisibleSize?: boolean;
  }) => (
    <span
      data-sprite={speciesId}
      data-variant={variant}
      data-normalized={normalizeVisibleSize}
    />
  ),
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
  render(<TeamManager playerName="tiago2" />);
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
      } else if (options?.method === "DELETE") {
        const input = JSON.parse(String(options.body)) as {
          expectedRevision: number;
          pokemonId: string;
        };
        if (input.expectedRevision !== server.revision) {
          return response({ code: "COLLECTION_CHANGED" }, 409);
        }
        const released = server.pokemon.find(
          (pokemon) => pokemon.id === input.pokemonId,
        );
        server = {
          ...server,
          revision: server.revision + 1,
          count: server.count - 1,
          pokemon: server.pokemon
            .filter((pokemon) => pokemon.id !== input.pokemonId)
            .map((pokemon) => ({
              ...pokemon,
              teamPosition:
                released?.teamPosition &&
                pokemon.teamPosition &&
                pokemon.teamPosition > released.teamPosition
                  ? pokemon.teamPosition - 1
                  : pokemon.teamPosition,
            })),
        };
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

  it("présente six places, une grille 7 × 5 et aucune recherche", async () => {
    const user = userEvent.setup();
    await openPc();
    expect(
      within(
        screen.getByRole("group", { name: "Emplacements de l'équipe" }),
      ).getAllByRole("button", { name: /^Équipe, emplacement/ }),
    ).toHaveLength(6);
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(screen.getAllByRole("gridcell")).toHaveLength(35);
    const pc = screen.getByRole("grid", { name: "Boîte 1" });
    expect(pc.getAttribute("aria-rowcount")).toBe("5");
    expect(pc.getAttribute("aria-colcount")).toBe("7");
    // Le CSS reçoit la même géométrie que les cases et les contrôles clavier.
    expect(pc.style.getPropertyValue("--pc-rows")).toBe("5");
    expect(pc.style.getPropertyValue("--pc-columns")).toBe("7");
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Enregistrer l’équipe" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Annuler les modifications" }),
    ).toBeNull();
    expect(screen.queryByText("Un dernier geste pour sauvegarder")).toBeNull();
    // L'ampoule garde l'aide hors du flux jusqu'à son ouverture explicite.
    const tipsTrigger = screen.getByRole("button", {
      name: "Afficher les Tips",
    });
    expect(tipsTrigger.closest("header")).not.toBeNull();
    expect(screen.queryByRole("dialog", { name: "Tips" })).toBeNull();
    await user.click(tipsTrigger);
    const tips = await screen.findByRole("dialog", { name: "Tips" });
    // Les trois rubriques suivent le même ordre visuel et accessible.
    expect(
      within(tips).getAllByRole("heading", { level: 3 }).map((heading) =>
        heading.textContent?.trim(),
      ),
    ).toEqual(["Souris", "Clavier", "Général"]);
    expect(within(tips).getAllByRole("list")).toHaveLength(3);
    for (const [name, count] of [
      ["Souris", 3],
      ["Clavier", 4],
      ["Général", 4],
    ] as const) {
      const group = within(tips).getByRole("region", { name });
      expect(within(group).getAllByRole("listitem")).toHaveLength(count);
    }
    expect(
      within(tips).getAllByRole("listitem").map((item) =>
        item.querySelector("strong")?.textContent,
      ),
    ).toEqual([
      "Clic ou glisser-déposer :",
      "Cadre de la boîte :",
      "Changer de boîte en glissant :",
      "Entrée / Espace :",
      "Flèches directionnelles :",
      "Tab :",
      "Échap :",
      "Case occupée :",
      "Échap :",
      "Sauvegarde automatique :",
      "Relâcher un Pokémon :",
    ]);
    expect(within(tips).getByText("Cadre de la boîte :")).toBeDefined();
    expect(
      within(tips).getByText("Changer de boîte en glissant :"),
    ).toBeDefined();
    expect(within(tips).getByText("Case occupée :")).toBeDefined();
    expect(
      within(tips).getByText(
        /sont enregistrés après chaque déplacement/,
      ),
    ).toBeDefined();
    expect(
      pcSlot(2).querySelector('[data-variant="front_shiny"]'),
    ).not.toBeNull();
    // Les deux zones normalisent désormais les silhouettes à leur propre taille.
    expect(
      teamSlot(1).querySelector('[data-normalized="true"]'),
    ).not.toBeNull();
    expect(
      pcSlot(1).querySelector('[data-normalized="true"]'),
    ).not.toBeNull();
  });

  it("ouvre les Tips dans une fenêtre et restaure le focus à la fermeture", async () => {
    const user = userEvent.setup();
    await openPc();
    const trigger = screen.getByRole("button", {
      name: "Afficher les Tips",
    });
    await user.click(trigger);
    const tips = await screen.findByRole("dialog", { name: "Tips" });
    expect(tips.hasAttribute("open")).toBe(true);
    expect(within(tips).getAllByRole("list")).toHaveLength(3);
    expect(within(tips).getAllByRole("listitem")).toHaveLength(11);
    await user.click(
      within(tips).getByRole("button", { name: "Fermer les Tips" }),
    );
    expect(screen.queryByRole("dialog", { name: "Tips" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    // Ce réglage visuel ne modifie ni l'équipe ni la collection sur le serveur.
    expect(api).toHaveBeenCalledTimes(1);
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("ouvre les Tips au clavier et les ferme avec Échap", async () => {
    const user = userEvent.setup();
    await openPc();
    const trigger = screen.getByRole("button", { name: "Afficher les Tips" });
    act(() => trigger.focus());
    await user.keyboard("{Enter}");
    const tips = await screen.findByRole("dialog", { name: "Tips" });
    fireEvent(tips, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog", { name: "Tips" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it.each([
    [0, "0 Pokémon au total"],
    [1, "1 Pokémon au total"],
    [2, "2 Pokémons au total"],
  ] as const)(
    "affiche le total %i au pied du PC avec le bon libellé",
    async (count, label) => {
      const data = teamSnapshot();
      data.pokemon = data.pokemon.slice(0, count);
      data.count = count;
      api.mockResolvedValueOnce(response(data));
      await openPc();
      const panel = screen.getByRole("region", { name: "PC de tiago2" });
      expect(
        within(panel).getByRole("heading", { name: "PC de tiago2" }),
      ).toBeDefined();
      const total = within(panel).getByText(label);
      expect(total.closest("p")).not.toBeNull();
      expect(total.closest("header")).toBeNull();
      // L'aide est uniquement dans Tips, jamais mélangée au compteur du PC.
      expect(within(panel).queryByText(/maintenez le Pokémon/)).toBeNull();
    },
  );

  it("demande confirmation puis relâche un Pokémon du PC", async () => {
    const user = userEvent.setup();
    await openPc();
    await user.click(pcSlot(1));
    const release = screen.getByRole("button", {
      name: /Relâcher Carapuce dans la nature/,
    });
    await user.click(release);
    const dialog = await screen.findByRole("dialog", {
      name: "Relâcher dans la nature",
    });
    expect(dialog.textContent).toContain("relâcher Carapuce");
    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api).toHaveBeenCalledTimes(1);

    await user.click(pcSlot(1));
    await user.click(
      screen.getByRole("button", {
        name: /Relâcher Carapuce dans la nature/,
      }),
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Confirmer",
      }),
    );
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("button", { name: /Boîte 1, case 1 : Carapuce/ }),
    ).toBeNull();
    expect(api.mock.calls[1][1]?.method).toBe("DELETE");
    expect(JSON.parse(String(api.mock.calls[1][1]?.body))).toMatchObject({
      expectedRevision: 7,
      pokemonId: "charlie",
    });
  });

  it("sépare l'arrêt Tab de chaque carte de celui de sa fiche", async () => {
    const user = userEvent.setup();
    await openPc();
    act(() => teamSlot(1).focus());
    for (let slot = 1; slot <= 6; slot++) {
      expect(document.activeElement).toBe(teamSlot(slot));
      expect(teamSlot(slot).tabIndex).toBe(0);
      if (slot <= 2) {
        await user.tab();
        expect(document.activeElement).toBe(
          detailsButton(slot === 1 ? "Bulbizarre" : "Salamèche"),
        );
      }
      if (slot < 6) await user.tab();
    }
    // Le retour arrière retrouve lui aussi la fiche puis la carte, sans les fusionner.
    act(() => teamSlot(2).focus());
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(detailsButton("Bulbizarre"));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(teamSlot(1));
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("déplace dans le PC une carte atteinte par Tab sans ouvrir sa fiche", async () => {
    const user = userEvent.setup();
    await openPc();
    act(() => teamSlot(1).focus());
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(teamSlot(2));
    // Entrée prend Salamèche ; trois flèches rejoignent la première case vide du PC.
    await user.keyboard("{Enter}{ArrowRight}{ArrowRight}{ArrowRight}{Enter}");
    await waitForSave();
    expect(pcSlot(3).getAttribute("aria-label")).toContain("Salamèche");
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api).toHaveBeenCalledTimes(2);
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
    // Une prise marque la carte sans ajouter de bandeau ni décaler les panneaux.
    expect(screen.queryByText(/choisissez une destination/i)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Annuler le déplacement" }),
    ).toBeNull();
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

  it("affiche seulement les places et boucle entre les boîtes avec les flèches", async () => {
    const user = userEvent.setup();
    await openPc();
    const previous = screen.getByRole("button", { name: "Boîte précédente" });
    const next = screen.getByRole("button", { name: "Boîte suivante" });
    expect(previous.hasAttribute("disabled")).toBe(false);
    expect(next.hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("heading", { name: "Boîte 1" })).toBeDefined();
    expect(screen.getByText("2 / 35 places")).toBeDefined();
    expect(screen.queryByText(/1 \/ 20/)).toBeNull();

    await user.click(previous);
    expect(screen.getByRole("grid", { name: "Boîte 20" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Boîte 20" })).toBeDefined();
    expect(screen.getByText("0 / 35 places")).toBeDefined();
    expect(next.hasAttribute("disabled")).toBe(false);
    await user.click(next);
    expect(screen.getByRole("grid", { name: "Boîte 1" })).toBeDefined();
    expect(screen.getByText("2 / 35 places")).toBeDefined();
    // Feuilleter le PC n'enregistre rien et ne modifie aucun Pokémon.
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("conserve la prise et le focus en bouclant au clavier", async () => {
    const user = userEvent.setup();
    await openPc();
    await user.click(pcSlot(1));
    await user.keyboard("{PageUp}");
    expect(document.activeElement).toBe(pcSlot(1, 20));
    await user.keyboard("{PageDown}");
    expect(document.activeElement).toBe(pcSlot(1));
    expect(pcSlot(1).getAttribute("aria-pressed")).toBe("true");
    expect(api).toHaveBeenCalledTimes(1);
    await user.keyboard("{PageUp}{Enter}");
    await waitForSave();
    expect(pcSlot(1, 20).getAttribute("aria-label")).toContain("Carapuce");
    expect(document.activeElement).toBe(pcSlot(1, 20));
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("boucle aussi pendant un glisser-déposer sans perdre le Pokémon", async () => {
    await openPc();
    const source = teamSlot(1);
    const previous = screen.getByRole("button", { name: "Boîte précédente" });
    const next = screen.getByRole("button", { name: "Boîte suivante" });
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "",
      dropEffect: "",
    };
    // On avance uniquement le délai de survol, sans ralentir le test.
    vi.useFakeTimers();
    try {
      fireEvent.dragStart(source, { dataTransfer });
      fireEvent.dragEnter(previous, { dataTransfer });
      act(() => {
        vi.advanceTimersByTime(650);
      });
      expect(screen.getByRole("grid", { name: "Boîte 20" })).toBeDefined();
      fireEvent.dragLeave(previous, { dataTransfer });
      fireEvent.dragEnter(next, { dataTransfer });
      act(() => {
        vi.advanceTimersByTime(650);
      });
      expect(screen.getByRole("grid", { name: "Boîte 1" })).toBeDefined();
      expect(source.getAttribute("aria-pressed")).toBe("true");
      expect(api).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
    fireEvent.drop(pcSlot(3), { dataTransfer });
    await waitForSave();
    expect(pcSlot(3).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(api).toHaveBeenCalledTimes(2);
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
    expect(
      screen
        .getByRole("region", { name: "PC de tiago2" })
        .hasAttribute("data-drop-target"),
    ).toBe(false);
    fireEvent.drop(pcSlot(1), { dataTransfer });
    await waitForSave();
    expect(api).toHaveBeenCalledTimes(2);
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Carapuce");
    expect(pcSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
  });

  it.each(["cadre", "titre", "grille"] as const)(
    "dépose sur le %s dans la première case libre et enregistre une seule fois",
    async (surface) => {
      await openPc();
      const panel = screen.getByRole("region", { name: "PC de tiago2" });
      const destination =
        surface === "titre"
          ? screen.getByRole("heading", { name: "Boîte 1" })
          : surface === "grille"
            ? screen.getByRole("grid", { name: "Boîte 1" })
            : panel;
      const dataTransfer = {
        setData: vi.fn(),
        effectAllowed: "",
        dropEffect: "",
      };
      fireEvent.dragStart(teamSlot(1), { dataTransfer });
      fireEvent.dragOver(destination, { dataTransfer });
      expect(panel.hasAttribute("data-drop-target")).toBe(true);
      fireEvent.drop(destination, { dataTransfer });
      await waitForSave();
      expect(pcSlot(3).getAttribute("aria-label")).toContain("Bulbizarre");
      expect(teamSlot(1).getAttribute("aria-label")).toContain("Salamèche");
      // Le cadre n'échange pas les occupants déjà présents et ne duplique rien.
      expect(pcSlot(1).getAttribute("aria-label")).toContain("Carapuce");
      expect(pcSlot(2).getAttribute("aria-label")).toContain("Lixy");
      expect(panel.hasAttribute("data-drop-target")).toBe(false);
      expect(api).toHaveBeenCalledTimes(2);
    },
  );

  it("dépose aussi sur le cadre d'une boîte entièrement vide", async () => {
    const user = userEvent.setup();
    await openPc();
    await user.click(screen.getByRole("button", { name: "Boîte précédente" }));
    const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(teamSlot(1), { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "PC de tiago2" }), {
      dataTransfer,
    });
    await waitForSave();
    expect(pcSlot(1, 20).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(screen.getByText("1 / 35 places")).toBeDefined();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("annonce une boîte complète sous le PC sans déplacer ni enregistrer", async () => {
    const data = teamSnapshot();
    data.pokemon = data.pokemon.filter((p) => p.teamPosition !== null);
    data.pokemon.push(
      ...Array.from({ length: 35 }, (_, i) =>
        teamPokemon({ id: `stored-${i}`, boxNumber: 1, boxSlot: i + 1 }),
      ),
    );
    data.count = data.pokemon.length;
    api.mockResolvedValueOnce(response(data));
    await openPc();
    const source = teamSlot(1);
    const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "PC de tiago2" }), {
      dataTransfer,
    });
    fireEvent.dragEnd(source);
    // Le message visuel remplace le statut de sauvegarde ; le lecteur d'écran l'annonce aussi.
    const message = screen.getByText("Boîte complète.", { selector: "span" });
    expect(message.parentElement?.hasAttribute("data-error")).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Boîte complète.");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(source.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("35 / 35 places")).toBeDefined();
    expect(api).toHaveBeenCalledTimes(1);
    expect(navigation.refresh).not.toHaveBeenCalled();
    // Changer de boîte, même au clavier, retire le message devenu obsolète.
    fireEvent.keyDown(pcSlot(1), { key: "PageDown" });
    expect(screen.getByRole("grid", { name: "Boîte 2" })).toBeDefined();
    expect(
      screen.queryByText("Boîte complète.", { selector: "span" }),
    ).toBeNull();
  });

  it("ignore un dépôt externe sur le cadre même s'il contient un identifiant connu", async () => {
    await openPc();
    const panel = screen.getByRole("region", { name: "PC de tiago2" });
    const dataTransfer = { getData: vi.fn(() => "alpha"), dropEffect: "" };
    fireEvent.dragOver(panel, { dataTransfer });
    fireEvent.drop(panel, { dataTransfer });
    expect(panel.hasAttribute("data-drop-target")).toBe(false);
    expect(dataTransfer.getData).not.toHaveBeenCalled();
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("garde la règle du dernier partenaire lors d'un dépôt sur le cadre", async () => {
    const data = teamSnapshot();
    data.pokemon = [data.pokemon[0]];
    data.count = 1;
    api.mockResolvedValueOnce(response(data));
    await openPc();
    const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(teamSlot(1), { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "PC de tiago2" }), {
      dataTransfer,
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "Au moins 1 Pokémon est nécessaire dans l’équipe active.",
    );
    expect(
      screen.getByRole("alert").parentElement?.hasAttribute("data-error"),
    ).toBe(true);
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(pcSlot(1).getAttribute("aria-label")).toContain("vide");
    expect(api).toHaveBeenCalledTimes(1);
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
    render(<TeamManager playerName="tiago2" />);
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
          boxNumber: Math.floor(i / 35) + 1,
          boxSlot: (i % 35) + 1,
        }),
      );
    data.count = data.pokemon.length;
    api.mockResolvedValueOnce(response(data));
    await openPc();
    expect(screen.getAllByRole("gridcell")).toHaveLength(35);
    expect(screen.getByText("35 / 35 places")).toBeDefined();
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
      "Au moins 1 Pokémon est nécessaire dans l’équipe active.",
    );
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(pcSlot(1).getAttribute("aria-label")).toContain("vide");
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("refuse de retirer le dernier partenaire apte même si un autre est K.O.", async () => {
    const user = userEvent.setup();
    const data = teamSnapshot();
    data.pokemon[1].currentHp = 0;
    api.mockResolvedValueOnce(response(data));
    await openPc();
    await user.click(teamSlot(1));
    await user.click(pcSlot(3));
    expect(screen.getByRole("alert").textContent).toBe(
      "Au moins 1 Pokémon apte au combat est nécessaire dans l’équipe active.",
    );
    expect(teamSlot(1).getAttribute("aria-label")).toContain("Bulbizarre");
    expect(pcSlot(3).getAttribute("aria-label")).toContain("vide");
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
    const navigationLink = document.createElement("a");
    navigationLink.href = "/dashboard";
    navigationLink.textContent = "Navigation de test";
    document.body.append(navigationLink);
    navigationLink.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Une modification de la collection est en cours"),
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
        <TeamManager playerName="tiago2" />
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
    expect(dialog.querySelector('[data-normalized="true"]')).toBeNull();
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

  it("utilise un tiret simple pour les valeurs absentes de la fiche", async () => {
    const user = userEvent.setup();
    const initial = teamSnapshot();
    initial.pokemon[0].dexNumber = undefined;
    Object.assign(initial.pokemon[0].moves[0], { power: 0, accuracy: 0 });
    api.mockResolvedValueOnce(response(initial));
    await openPc();
    await user.click(detailsButton("Bulbizarre"));
    const dialog = await screen.findByRole("dialog", { name: "Bulbizarre" });
    expect(within(dialog).getByText("Puissance : -")).toBeDefined();
    expect(within(dialog).getByText("Précision : -")).toBeDefined();
    expect(dialog.textContent).toContain("#-");
    expect(dialog.textContent).not.toContain("#00-");
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
