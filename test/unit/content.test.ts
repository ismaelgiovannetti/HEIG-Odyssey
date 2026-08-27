import { describe, it, expect } from "vitest";
import {
  loadSpecies,
  loadStarters,
  loadTrainers,
  loadCampaign,
  loadGachaBanners,
  validateAllContent,
  getSpecies,
  getTrainer,
} from "@/lib/content/loader";

describe("Content Validation and Loader (US-15)", () => {
  it("should load and validate all species correctly", () => {
    const species = loadSpecies();
    expect(species.size).toBeGreaterThan(0);

    const turtwig = getSpecies("turtwig");
    expect(turtwig).toBeDefined();
    expect(turtwig?.dexNumber).toBe(387);
    expect(turtwig?.types).toContain("Grass");
    expect(turtwig?.stage).toBe(1);
    expect(turtwig?.isStarterEligible).toBe(true);
  });

  it("should load and validate all starters with level 5 and valid moves", () => {
    const starters = loadStarters();
    expect(starters.length).toBeGreaterThanOrEqual(3);

    for (const starter of starters) {
      expect(starter.level).toBe(5);
      expect(starter.moves.length).toBeGreaterThanOrEqual(1);
      expect(starter.moves.length).toBeLessThanOrEqual(4);

      const spec = getSpecies(starter.speciesId);
      expect(spec).toBeDefined();
      expect(spec?.stage).toBe(1);
      expect(spec?.isStarterEligible).toBe(true);
    }
  });

  it("should load and validate all trainers and their teams", () => {
    const trainers = loadTrainers();
    expect(trainers.size).toBeGreaterThan(0);

    const trainerB1 = getTrainer("trainer-b1-stage-1");
    expect(trainerB1).toBeDefined();
    expect(trainerB1?.aiProfile).toBe("random");
    expect(trainerB1?.team.length).toBeGreaterThanOrEqual(1);

    const bossDonini = getTrainer("boss-doc-donini");
    expect(bossDonini).toBeDefined();
    expect(bossDonini?.team.length).toBe(6);

    for (const [, trainer] of trainers) {
      expect(trainer.introCatchline.length).toBeGreaterThan(0);
      expect(trainer.victoryCatchline.length).toBeGreaterThan(0);
      expect(trainer.defeatCatchline.length).toBeGreaterThan(0);
      expect(trainer.team.length).toBeLessThanOrEqual(6);
    }
  });

  it("should load and validate campaign worlds and stages referential integrity", () => {
    const worlds = loadCampaign();
    expect(worlds.length).toBeGreaterThan(0);

    const trainers = loadTrainers();
    for (const world of worlds) {
      expect(world.stages.length).toBeGreaterThan(0);
      for (const stage of world.stages) {
        expect(trainers.has(stage.trainerId)).toBe(true);
      }
    }
  });

  it("should load and validate gacha banners and species pools", () => {
    const banners = loadGachaBanners();
    expect(banners.length).toBeGreaterThan(0);

    const species = loadSpecies();
    for (const banner of banners) {
      expect(banner.costPokedollars).toBeGreaterThan(0);
      for (const spId of banner.poolSpecies) {
        expect(species.has(spId)).toBe(true);
      }
    }
  });

  it("should validate all content in one unified check", () => {
    const summary = validateAllContent();
    expect(summary.speciesCount).toBeGreaterThan(0);
    expect(summary.startersCount).toBeGreaterThan(0);
    expect(summary.trainersCount).toBeGreaterThan(0);
    expect(summary.worldsCount).toBeGreaterThan(0);
    expect(summary.bannersCount).toBeGreaterThan(0);
  });
});
