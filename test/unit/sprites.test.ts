import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadSpecies, loadTrainers } from "@/lib/content/loader";
import {
  getPokemonSpriteUrl,
  getBaseSpeciesId,
} from "@/components/pokemon/sprite-provider";

describe("Sprite Assets & Manifest Validation (US-16)", () => {
  it("should have a valid sprites manifest.json with all 493 species", () => {
    const manifestPath = path.join(
      process.cwd(),
      "public",
      "sprites",
      "manifest.json",
    );
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifest.version).toBeDefined();
    expect(manifest.sprites).toBeDefined();
    expect(Object.keys(manifest.sprites).length).toBe(493);
  });

  it("should have all front, back, shiny and back_shiny local sprite files for all configured species", () => {
    const species = loadSpecies();
    const publicDir = path.join(process.cwd(), "public");

    for (const [speciesId] of species) {
      const frontPath = path.join(
        publicDir,
        "sprites",
        "pokemon",
        "front",
        `${speciesId}.png`,
      );
      const backPath = path.join(
        publicDir,
        "sprites",
        "pokemon",
        "back",
        `${speciesId}.png`,
      );
      const frontShinyPath = path.join(
        publicDir,
        "sprites",
        "pokemon",
        "front_shiny",
        `${speciesId}.png`,
      );
      const backShinyPath = path.join(
        publicDir,
        "sprites",
        "pokemon",
        "back_shiny",
        `${speciesId}.png`,
      );

      expect(
        fs.existsSync(frontPath),
        `Missing front sprite for ${speciesId}`,
      ).toBe(true);
      expect(
        fs.existsSync(backPath),
        `Missing back sprite for ${speciesId}`,
      ).toBe(true);
      expect(
        fs.existsSync(frontShinyPath),
        `Missing front shiny sprite for ${speciesId}`,
      ).toBe(true);
      expect(
        fs.existsSync(backShinyPath),
        `Missing back shiny sprite for ${speciesId}`,
      ).toBe(true);
    }
  });

  it("should have all trainer sprites existing in public directory", () => {
    const trainers = loadTrainers();
    const publicDir = path.join(process.cwd(), "public");

    for (const [, trainer] of trainers) {
      const relativePath = trainer.sprite.startsWith("/")
        ? trainer.sprite.slice(1)
        : trainer.sprite;
      const fullPath = path.join(publicDir, relativePath);

      expect(
        fs.existsSync(fullPath),
        `Trainer ${trainer.id} sprite missing at ${fullPath}`,
      ).toBe(true);
    }
  });

  it("should generate correct local URLs via getPokemonSpriteUrl for all 4 variants", () => {
    expect(getPokemonSpriteUrl("turtwig", "front")).toBe(
      "/sprites/pokemon/front/turtwig.png",
    );
    expect(getPokemonSpriteUrl("turtwig", "back")).toBe(
      "/sprites/pokemon/back/turtwig.png",
    );
    expect(getPokemonSpriteUrl("turtwig", "shiny")).toBe(
      "/sprites/pokemon/front_shiny/turtwig.png",
    );
    expect(getPokemonSpriteUrl("turtwig", "back_shiny")).toBe(
      "/sprites/pokemon/back_shiny/turtwig.png",
    );
    expect(getPokemonSpriteUrl("", "front")).toBe("/pokeball-pixel.svg");
  });

  it("should resolve base species id for all Gen 1-4 alternative forms", () => {
    // Morphéo (Castform)
    expect(getBaseSpeciesId("castformsunny")).toBe("castform");
    expect(getBaseSpeciesId("castform-sunny")).toBe("castform");
    expect(getBaseSpeciesId("castformrainy")).toBe("castform");
    expect(getBaseSpeciesId("castformsnowy")).toBe("castform");

    // Motisma (Rotom)
    expect(getBaseSpeciesId("rotomheat")).toBe("rotom");
    expect(getBaseSpeciesId("rotomwash")).toBe("rotom");
    expect(getBaseSpeciesId("rotom-frost")).toBe("rotom");

    // Autres formes Gen 1-4
    expect(getBaseSpeciesId("cherrimsunshine")).toBe("cherrim");
    expect(getBaseSpeciesId("deoxysattack")).toBe("deoxys");
    expect(getBaseSpeciesId("giratinaorigin")).toBe("giratina");
    expect(getBaseSpeciesId("shayminsky")).toBe("shaymin");
    expect(getBaseSpeciesId("wormadamsandy")).toBe("wormadam");
    expect(getBaseSpeciesId("arceuswater")).toBe("arceus");
    expect(getBaseSpeciesId("burmytrash")).toBe("burmy");
    expect(getBaseSpeciesId("shelloseast")).toBe("shellos");
    expect(getBaseSpeciesId("gastrodoneast")).toBe("gastrodon");
    expect(getBaseSpeciesId("pichuspikyeared")).toBe("pichu");

    // Espèces régulières
    expect(getBaseSpeciesId("bulbasaur")).toBe("bulbasaur");
    expect(getBaseSpeciesId("pikachu")).toBe("pikachu");
  });

  it("should have all Castform form sprites across all 4 visual variants", () => {
    const publicDir = path.join(process.cwd(), "public", "sprites", "pokemon");
    const castformForms = [
      "castformsunny",
      "castformrainy",
      "castformsnowy",
      "castform-sunny",
      "castform-rainy",
      "castform-snowy",
    ];

    for (const folder of ["front", "back", "front_shiny", "back_shiny"]) {
      for (const formId of castformForms) {
        const filePath = path.join(publicDir, folder, `${formId}.png`);
        expect(
          fs.existsSync(filePath),
          `Missing Castform form sprite: ${filePath}`,
        ).toBe(true);
      }
    }
  });

  it("should have special Gen 1-4 form sprites available in front folder", () => {
    const publicDir = path.join(
      process.cwd(),
      "public",
      "sprites",
      "pokemon",
      "front",
    );
    const sampleSpecialForms = [
      "rotomheat",
      "rotomwash",
      "cherrimsunshine",
      "deoxysattack",
      "giratinaorigin",
      "shayminsky",
      "wormadamsandy",
      "arceusfire",
    ];

    for (const formId of sampleSpecialForms) {
      const filePath = path.join(publicDir, `${formId}.png`);
      expect(
        fs.existsSync(filePath),
        `Missing special form sprite: ${filePath}`,
      ).toBe(true);
    }
  });
});
