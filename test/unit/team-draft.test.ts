import { describe, expect, it } from "vitest";
import {
  adjacentBox,
  adjacentCell,
  draftFromCollection,
  draftSignature,
  firstFreePcCell,
  movePokemon,
  pokemonAt,
  saveDraft,
} from "@/lib/team/team-draft";
import { teamPokemon, teamSnapshot } from "../helpers/team-interface-fixture";

describe("brouillon de l'équipe et des boîtes PC", () => {
  it("conserve les cases vides et le rangement reçu du serveur", () => {
    const draft = draftFromCollection(teamSnapshot().pokemon);
    expect(draft.team).toEqual(["alpha", "bravo"]);
    expect(pokemonAt(draft, { area: "pc", box: 2, slot: 35 })).toBe("echo");
    expect(pokemonAt(draft, { area: "pc", box: 2, slot: 1 })).toBeUndefined();
  });

  it("échange deux cases occupées du PC sans toucher à l'équipe", () => {
    const data = teamSnapshot();
    const original = draftFromCollection(data.pokemon);
    const { draft } = movePokemon(
      original,
      { area: "pc", box: 1, slot: 1 },
      { area: "pc", box: 1, slot: 2 },
      data.pokemon,
    );
    expect(pokemonAt(draft, { area: "pc", box: 1, slot: 1 })).toBe("delta");
    expect(pokemonAt(draft, { area: "pc", box: 1, slot: 2 })).toBe("charlie");
    expect(draft.team).toEqual(original.team);
    expect(original.pc[0].pokemonId).toBe("charlie");
  });

  it("échange un Pokémon entre deux boîtes différentes", () => {
    const data = teamSnapshot();
    const { draft } = movePokemon(
      draftFromCollection(data.pokemon),
      { area: "pc", box: 1, slot: 1 },
      { area: "pc", box: 2, slot: 35 },
      data.pokemon,
    );
    expect(pokemonAt(draft, { area: "pc", box: 1, slot: 1 })).toBe("echo");
    expect(pokemonAt(draft, { area: "pc", box: 2, slot: 35 })).toBe("charlie");
  });

  it("échange l'occupant du PC avec celui de l'équipe", () => {
    const data = teamSnapshot();
    const { draft } = movePokemon(
      draftFromCollection(data.pokemon),
      { area: "team", slot: 1 },
      { area: "pc", box: 1, slot: 1 },
      data.pokemon,
    );
    expect(draft.team).toEqual(["charlie", "bravo"]);
    expect(pokemonAt(draft, { area: "pc", box: 1, slot: 1 })).toBe("alpha");
  });

  it("réordonne l'équipe et compacte ses places après un retrait", () => {
    const data = teamSnapshot();
    const original = draftFromCollection(data.pokemon);
    expect(
      movePokemon(
        original,
        { area: "team", slot: 1 },
        { area: "team", slot: 2 },
        data.pokemon,
      ).draft.team,
    ).toEqual(["bravo", "alpha"]);
    const { draft } = movePokemon(
      original,
      { area: "team", slot: 1 },
      { area: "pc", box: 20, slot: 35 },
      data.pokemon,
    );
    expect(draft.team).toEqual(["bravo"]);
    expect(pokemonAt(draft, { area: "pc", box: 20, slot: 35 })).toBe("alpha");
  });

  it("complète la première place libre quand on vise une place vide de l'équipe", () => {
    const data = teamSnapshot();
    const { draft } = movePokemon(
      draftFromCollection(data.pokemon),
      { area: "pc", box: 1, slot: 1 },
      { area: "team", slot: 6 },
      data.pokemon,
    );
    expect(draft.team).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("refuse de retirer le dernier partenaire sans modifier le brouillon", () => {
    const pokemon = [
      teamPokemon({ teamPosition: 1, boxNumber: null, boxSlot: null }),
    ];
    const draft = draftFromCollection(pokemon);
    const result = movePokemon(
      draft,
      { area: "team", slot: 1 },
      { area: "pc", box: 1, slot: 1 },
      pokemon,
    );
    expect(result.draft).toBe(draft);
    expect(result.error).toBe(
      "Au moins 1 Pokémon est nécessaire dans l’équipe active.",
    );
  });

  it("refuse de remplacer le dernier partenaire apte au combat par un Pokémon K.O.", () => {
    const pokemon = [
      teamPokemon({ teamPosition: 1, boxNumber: null, boxSlot: null }),
      teamPokemon({ id: "ko", currentHp: 0 }),
    ];
    const draft = draftFromCollection(pokemon);
    const result = movePokemon(
      draft,
      { area: "pc", box: 1, slot: 1 },
      { area: "team", slot: 1 },
      pokemon,
    );
    expect(result.error).toContain("apte au combat");
    expect(result.draft).toBe(draft);
  });

  it("rejette une case hors limites et ignore une source vide", () => {
    const data = teamSnapshot();
    const draft = draftFromCollection(data.pokemon);
    expect(
      movePokemon(
        draft,
        { area: "team", slot: 1 },
        { area: "pc", box: 21, slot: 1 },
        data.pokemon,
      ).error,
    ).toBeDefined();
    expect(
      movePokemon(
        draft,
        { area: "pc", box: 1, slot: 35 },
        { area: "team", slot: 1 },
        data.pokemon,
      ).draft,
    ).toBe(draft);
  });

  it("ne confond pas l'ordre du tableau et la position réelle dans le PC", () => {
    const draft = draftFromCollection(teamSnapshot().pokemon);
    expect(draftSignature({ ...draft, pc: [...draft.pc].reverse() })).toBe(
      draftSignature(draft),
    );
  });

  it("envoie toutes les positions et la révision, mais aucun userId ni statistique", () => {
    const draft = draftFromCollection(teamSnapshot().pokemon);
    const payload = saveDraft(draft, 7);
    expect(Object.keys(payload).sort()).toEqual([
      "expectedRevision",
      "pcPlacements",
      "teamPokemonIds",
    ]);
    expect(payload.expectedRevision).toBe(7);
    expect(payload.pcPlacements).toHaveLength(3);
    expect(payload.pcPlacements![0]).toEqual({
      pokemonId: "charlie",
      boxNumber: 1,
      boxSlot: 1,
    });
  });

  it("conserve chaque Pokémon exactement une fois après de nombreux déplacements", () => {
    const data = teamSnapshot();
    let draft = draftFromCollection(data.pokemon);
    // Parcours déterministe : une panne reste reproductible, sans hasard de test.
    for (let i = 0; i < 150; i++) {
      const source = draft.pc[i % draft.pc.length];
      draft = movePokemon(
        draft,
        { area: "pc", box: source.boxNumber, slot: source.boxSlot },
        { area: "pc", box: (i % 20) + 1, slot: (i % 35) + 1 },
        data.pokemon,
      ).draft;
      const ids = [...draft.team, ...draft.pc.map((p) => p.pokemonId)];
      expect(new Set(ids).size).toBe(data.count);
      expect(ids).toHaveLength(data.count);
      expect(
        new Set(draft.pc.map((p) => `${p.boxNumber}:${p.boxSlot}`)).size,
      ).toBe(draft.pc.length);
    }
  });
});

describe("première case libre lors d'un dépôt sur une boîte", () => {
  it("choisit la première case d'une boîte vide", () => {
    const draft = draftFromCollection(teamSnapshot().pokemon);
    expect(firstFreePcCell(draft, 20)).toEqual({ area: "pc", box: 20, slot: 1 });
  });

  it("remplit le premier trou sans trier les occupants ni confondre les boîtes", () => {
    const draft = {
      team: ["alpha"],
      pc: [
        { pokemonId: "bravo", boxNumber: 1, boxSlot: 4 },
        { pokemonId: "charlie", boxNumber: 1, boxSlot: 1 },
        { pokemonId: "delta", boxNumber: 2, boxSlot: 2 },
        { pokemonId: "echo", boxNumber: 1, boxSlot: 3 },
      ],
    };
    const original = structuredClone(draft);
    expect(firstFreePcCell(draft, 1)).toEqual({ area: "pc", box: 1, slot: 2 });
    expect(draft).toEqual(original);
  });

  it("accepte la dernière place puis signale une boîte complète", () => {
    const draft = {
      team: ["alpha"],
      pc: Array.from({ length: 34 }, (_, i) => ({
        pokemonId: `stored-${i}`,
        boxNumber: 1,
        boxSlot: i + 1,
      })),
    };
    expect(firstFreePcCell(draft, 1)).toEqual({ area: "pc", box: 1, slot: 35 });
    draft.pc.push({ pokemonId: "last", boxNumber: 1, boxSlot: 35 });
    expect(firstFreePcCell(draft, 1)).toBeNull();
    // Une autre boîte reste disponible : ne jamais y déposer sans l'avoir choisie.
    expect(firstFreePcCell(draft, 2)).toEqual({ area: "pc", box: 2, slot: 1 });
  });

  it.each([0, 21, 1.5, Number.NaN])("refuse la boîte invalide %s", (box) => {
    expect(
      firstFreePcCell(draftFromCollection(teamSnapshot().pokemon), box),
    ).toBeNull();
  });
});

describe("navigation clavier du rangement", () => {
  it.each([
    [1, -1, 20],
    [20, 1, 1],
    [1, 1, 2],
    [20, -1, 19],
  ] as const)(
    "depuis la boîte %i, le sens %i rejoint la boîte %i",
    (box, direction, expected) => {
      expect(adjacentBox(box, direction)).toBe(expected);
    },
  );

  // Ordre visuel 1–2 / 3–4 / 5–6 : les flèches ne suivent plus une seule colonne.
  it.each([
    [1, "ArrowRight", 2],
    [2, "ArrowLeft", 1],
    [1, "ArrowDown", 3],
    [2, "ArrowDown", 4],
    [3, "ArrowDown", 5],
    [4, "ArrowDown", 6],
    [5, "ArrowUp", 3],
    [6, "ArrowUp", 4],
    [1, "ArrowLeft", 1],
    [3, "ArrowLeft", 3],
    [1, "ArrowUp", 1],
    [2, "ArrowUp", 2],
    [5, "ArrowDown", 5],
    [6, "ArrowDown", 6],
    [4, "Home", 3],
    [3, "End", 4],
  ] as const)("depuis la place %i, %s rejoint la place %i", (from, key, to) => {
    expect(adjacentCell({ area: "team", slot: from }, key, 2)).toEqual({
      area: "team",
      slot: to,
    });
  });

  it.each([
    [2, 1],
    [4, 15],
    [6, 29],
  ])(
    "relie la place %i à la case PC %i dans les deux sens",
    (teamSlot, pcSlot) => {
      expect(
        adjacentCell({ area: "team", slot: teamSlot }, "ArrowRight", 2),
      ).toEqual({
        area: "pc",
        box: 2,
        slot: pcSlot,
      });
      expect(
        adjacentCell({ area: "pc", box: 2, slot: pcSlot }, "ArrowLeft", 2),
      ).toEqual({ area: "team", slot: teamSlot });
    },
  );

  it("ramène chaque ligne du PC vers une place de droite de l'équipe", () => {
    for (let row = 0; row < 5; row++) {
      const target = adjacentCell(
        { area: "pc", box: 1, slot: row * 7 + 1 },
        "ArrowLeft",
        1,
      );
      expect(target.area).toBe("team");
      expect([2, 4, 6]).toContain(target.slot);
    }
  });
  it("déplace le focus par lignes de sept et respecte les limites", () => {
    expect(
      adjacentCell({ area: "pc", box: 1, slot: 1 }, "ArrowDown", 1).slot,
    ).toBe(8);
    expect(
      adjacentCell({ area: "pc", box: 1, slot: 7 }, "ArrowRight", 1).slot,
    ).toBe(7);
    expect(
      adjacentCell({ area: "pc", box: 1, slot: 35 }, "ArrowDown", 1).slot,
    ).toBe(35);
  });
  it.each([
    [1, "PageDown", 2],
    [2, "PageUp", 1],
    [1, "PageUp", 20],
    [20, "PageDown", 1],
  ] as const)(
    "boucle depuis la boîte %i avec %s sans perdre la case",
    (box, key, expected) => {
      expect(adjacentCell({ area: "pc", box, slot: 12 }, key, box)).toEqual({
        area: "pc",
        box: expected,
        slot: 12,
      });
    },
  );

  it("rejoint la dernière boîte depuis l'équipe avec Page précédente", () => {
    expect(adjacentCell({ area: "team", slot: 2 }, "PageUp", 1)).toEqual({
      area: "pc",
      box: 20,
      slot: 1,
    });
  });
});
