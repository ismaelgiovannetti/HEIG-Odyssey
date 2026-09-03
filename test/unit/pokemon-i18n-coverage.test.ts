import { describe, it, expect } from "vitest";
import { Dex } from "@pkmn/sim";
import { getMoveFrenchName } from "@/lib/pokemon/move-names-fr";
import { getSpeciesFrenchName } from "@/lib/pokemon/species-names-fr";

/**
 * Garantit une interface 100 % française (cf. §8 du cahier des charges) :
 * chaque capacité et chaque espèce jouables en Génération 1 à 4 doivent avoir
 * un nom français officiel, sans repli sur l'anglais.
 */
describe("localisation française Gen 1-4", () => {
  const dex = Dex.forGen(4);

  it("toutes les capacités Gen 1-4 ont un nom français", () => {
    const untranslated: string[] = [];
    for (const move of dex.moves.all()) {
      if (!move.exists || move.isNonstandard) continue;
      if (!move.gen || move.gen > 4) continue;
      // Sans traduction, getMoveFrenchName renvoie l'identifiant brut.
      if (getMoveFrenchName(move.id) === move.id) {
        untranslated.push(`${move.id} (${move.name})`);
      }
    }
    expect(untranslated).toEqual([]);
  });

  it("toutes les espèces Gen 1-4 (formes incluses) ont un nom français", () => {
    const untranslated: string[] = [];
    for (const species of dex.species.all()) {
      if (!species.exists || species.isNonstandard) continue;
      if (!species.gen || species.gen > 4) continue;
      if (getSpeciesFrenchName(species.id) === species.id) {
        untranslated.push(`${species.id} (${species.name})`);
      }
    }
    expect(untranslated).toEqual([]);
  });

  it("les formes alternatives reprennent le nom de l'espèce de base", () => {
    expect(getSpeciesFrenchName("rotomheat")).toBe("Motisma");
    expect(getSpeciesFrenchName("rotomwash")).toBe("Motisma");
    expect(getSpeciesFrenchName("arceusfire")).toBe("Arceus");
    expect(getSpeciesFrenchName("deoxysattack")).toBe("Deoxys");
    expect(getSpeciesFrenchName("giratinaorigin")).toBe("Giratina");
    expect(getSpeciesFrenchName("wormadamtrash")).toBe("Cheniselle");
    expect(getSpeciesFrenchName("cherrimsunshine")).toBe("Ceriflor");
    expect(getSpeciesFrenchName("gastrodoneast")).toBe("Tritosor");
  });

  it("corrige des noms français erronés du dictionnaire", () => {
    expect(getMoveFrenchName("jumpkick")).toBe("Pied Sauté");
    expect(getMoveFrenchName("highjumpkick")).toBe("Pied Voltige");
    expect(getMoveFrenchName("hydrocannon")).toBe("Hydro Canon");
    expect(getSpeciesFrenchName("skuntank")).toBe("Moufflair");
    expect(getMoveFrenchName("furyswipes")).toBe("Combo-Griffe");
  });
});
