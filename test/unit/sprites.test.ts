import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadSpecies, loadTrainers } from "@/lib/content/loader";
import { getPokemonSpriteUrl } from "@/components/SpriteProvider";

describe("Sprite Assets & Manifest Validation (US-16)", () => {
  it("should have a valid sprites manifest.json with all 493 species", () => {
    const manifestPath = path.join(
      process.cwd(),
      "public",
      "sprites",
      "manifest.json"
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
        `${speciesId}.png`
      );
      const backPath = path.join(
        publicDir,
        "sprites",
        "pokemon",
        "back",
        `${speciesId}.png`
      );
      const frontShinyPath = path.join(
        publicDir,
        "sprites",
        "pokemon",
        "front_shiny",
        `${speciesId}.png`
      );
      const backShinyPath = path.join(
        publicDir,
        "sprites",
        "pokemon",
        "back_shiny",
        `${speciesId}.png`
      );

      expect(fs.existsSync(frontPath), `Missing front sprite for ${speciesId}`).toBe(true);
      expect(fs.existsSync(backPath), `Missing back sprite for ${speciesId}`).toBe(true);
      expect(fs.existsSync(frontShinyPath), `Missing front shiny sprite for ${speciesId}`).toBe(true);
      expect(fs.existsSync(backShinyPath), `Missing back shiny sprite for ${speciesId}`).toBe(true);
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
        `Trainer ${trainer.id} sprite missing at ${fullPath}`
      ).toBe(true);
    }
  });

  it("should generate correct local URLs via getPokemonSpriteUrl for all 4 variants", () => {
    expect(getPokemonSpriteUrl("turtwig", "front")).toBe(
      "/sprites/pokemon/front/turtwig.png"
    );
    expect(getPokemonSpriteUrl("turtwig", "back")).toBe(
      "/sprites/pokemon/back/turtwig.png"
    );
    expect(getPokemonSpriteUrl("turtwig", "shiny")).toBe(
      "/sprites/pokemon/front_shiny/turtwig.png"
    );
    expect(getPokemonSpriteUrl("turtwig", "back_shiny")).toBe(
      "/sprites/pokemon/back_shiny/turtwig.png"
    );
    expect(getPokemonSpriteUrl("", "front")).toBe("/pokeball-pixel.svg");
  });
});
