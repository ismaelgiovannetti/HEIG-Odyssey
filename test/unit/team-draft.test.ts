import { describe, expect, it } from "vitest";
import {
  adjacentCell,
  draftFromCollection,
  draftSignature,
  movePokemon,
  pokemonAt,
  saveDraft,
} from "@/lib/team/team-draft";
import { teamPokemon, teamSnapshot } from "../helpers/team-interface-fixture";

describe("brouillon de l'équipe et des boîtes PC", () => {
  it("conserve les cases vides et le rangement reçu du serveur", () => {
    const draft = draftFromCollection(teamSnapshot().pokemon);
    expect(draft.team).toEqual(["alpha", "bravo"]);
    expect(pokemonAt(draft, { area: "pc", box: 2, slot: 70 })).toBe("echo");
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
      { area: "pc", box: 2, slot: 70 },
      data.pokemon,
    );
    expect(pokemonAt(draft, { area: "pc", box: 1, slot: 1 })).toBe("echo");
    expect(pokemonAt(draft, { area: "pc", box: 2, slot: 70 })).toBe("charlie");
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
      { area: "pc", box: 15, slot: 70 },
      data.pokemon,
    );
    expect(draft.team).toEqual(["bravo"]);
    expect(pokemonAt(draft, { area: "pc", box: 15, slot: 70 })).toBe("alpha");
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
    expect(result.error).toContain("au moins un Pokémon");
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
        { area: "pc", box: 16, slot: 1 },
        data.pokemon,
      ).error,
    ).toBeDefined();
    expect(
      movePokemon(
        draft,
        { area: "pc", box: 1, slot: 70 },
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
        { area: "pc", box: (i % 15) + 1, slot: (i % 70) + 1 },
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

describe("navigation clavier du rangement", () => {
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
    [4, 36],
    [6, 64],
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
    for (let row = 0; row < 10; row++) {
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
      adjacentCell({ area: "pc", box: 1, slot: 70 }, "ArrowDown", 1).slot,
    ).toBe(70);
  });
  it("change de boîte sans perdre la case et sans dépasser les quinze boîtes", () => {
    expect(
      adjacentCell({ area: "pc", box: 1, slot: 12 }, "PageDown", 1),
    ).toEqual({ area: "pc", box: 2, slot: 12 });
    expect(
      adjacentCell({ area: "pc", box: 15, slot: 12 }, "PageDown", 15),
    ).toEqual({ area: "pc", box: 15, slot: 12 });
  });
});
