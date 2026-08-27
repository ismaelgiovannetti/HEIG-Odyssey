import {
  SpeciesSchema,
  StartersConfigSchema,
  TrainersConfigSchema,
  CampaignConfigSchema,
  GachaConfigSchema,
  type Species,
  type StarterOption,
  type Trainer,
  type CampaignWorld,
  type GachaBannerConfig,
} from "./schemas";

import fs from "node:fs";
import path from "node:path";

function getContentDir(): string {
  const possiblePaths = [
    path.join(process.cwd(), "content"),
    path.join(process.cwd(), "..", "content"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return path.join(process.cwd(), "content");
}

function loadJsonFile<T>(filename: string): T {
  const filePath = path.join(getContentDir(), filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Content file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as T;
}

// In-memory validated caches
let cachedSpecies: Map<string, Species> | null = null;
let cachedStarters: StarterOption[] | null = null;
let cachedTrainers: Map<string, Trainer> | null = null;
let cachedCampaign: CampaignWorld[] | null = null;
let cachedGacha: GachaBannerConfig[] | null = null;

export function loadSpecies(): Map<string, Species> {
  if (cachedSpecies) return cachedSpecies;
  const raw = loadJsonFile<{ version: string; species: unknown[] }>("species.json");
  const speciesMap = new Map<string, Species>();

  for (const item of raw.species) {
    const validated = SpeciesSchema.parse(item);
    if (speciesMap.has(validated.id)) {
      throw new Error(`Duplicate species ID found: ${validated.id}`);
    }
    speciesMap.set(validated.id, validated);
  }

  cachedSpecies = speciesMap;
  return cachedSpecies;
}

export function loadStarters(): StarterOption[] {
  if (cachedStarters) return cachedStarters;
  const raw = loadJsonFile<unknown>("starters.json");
  const validated = StartersConfigSchema.parse(raw);

  const species = loadSpecies();
  for (const starter of validated.starters) {
    if (!species.has(starter.speciesId)) {
      throw new Error(
        `Starter references unknown speciesId: "${starter.speciesId}"`
      );
    }
    const spec = species.get(starter.speciesId)!;
    if (!spec.isStarterEligible || spec.stage !== 1) {
      throw new Error(
        `Starter "${starter.speciesId}" is not eligible as a stage 1 starter`
      );
    }
  }

  cachedStarters = validated.starters;
  return cachedStarters;
}

export function loadTrainers(): Map<string, Trainer> {
  if (cachedTrainers) return cachedTrainers;
  const raw = loadJsonFile<unknown>("trainers.json");
  const validated = TrainersConfigSchema.parse(raw);

  const species = loadSpecies();
  const trainersMap = new Map<string, Trainer>();

  for (const trainer of validated.trainers) {
    if (trainersMap.has(trainer.id)) {
      throw new Error(`Duplicate trainer ID found: ${trainer.id}`);
    }

    for (const member of trainer.team) {
      if (!species.has(member.speciesId)) {
        throw new Error(
          `Trainer "${trainer.id}" references unknown speciesId: "${member.speciesId}"`
        );
      }
    }

    trainersMap.set(trainer.id, trainer);
  }

  cachedTrainers = trainersMap;
  return cachedTrainers;
}

export function loadCampaign(): CampaignWorld[] {
  if (cachedCampaign) return cachedCampaign;
  const raw = loadJsonFile<unknown>("campaign.json");
  const validated = CampaignConfigSchema.parse(raw);

  const trainers = loadTrainers();
  const stageIds = new Set<string>();

  for (const world of validated.worlds) {
    for (const stage of world.stages) {
      if (stageIds.has(stage.id)) {
        throw new Error(`Duplicate campaign stage ID found: ${stage.id}`);
      }
      stageIds.add(stage.id);

      if (!trainers.has(stage.trainerId)) {
        throw new Error(
          `Campaign stage "${stage.id}" references unknown trainerId: "${stage.trainerId}"`
        );
      }

      if (
        stage.prerequisiteStageId &&
        !stageIds.has(stage.prerequisiteStageId)
      ) {
        throw new Error(
          `Campaign stage "${stage.id}" references prerequisite "${stage.prerequisiteStageId}" which is not defined before it`
        );
      }
    }
  }

  cachedCampaign = validated.worlds;
  return cachedCampaign;
}

export function loadGachaBanners(): GachaBannerConfig[] {
  if (cachedGacha) return cachedGacha;
  const raw = loadJsonFile<unknown>("gacha-banners.json");
  const validated = GachaConfigSchema.parse(raw);

  const species = loadSpecies();
  for (const banner of validated.banners) {
    for (const spId of banner.poolSpecies) {
      if (!species.has(spId)) {
        throw new Error(
          `Gacha banner "${banner.id}" references unknown speciesId: "${spId}"`
        );
      }
    }
  }

  cachedGacha = validated.banners;
  return cachedGacha;
}

export function validateAllContent(): {
  speciesCount: number;
  startersCount: number;
  trainersCount: number;
  worldsCount: number;
  bannersCount: number;
} {
  const species = loadSpecies();
  const starters = loadStarters();
  const trainers = loadTrainers();
  const campaign = loadCampaign();
  const banners = loadGachaBanners();

  return {
    speciesCount: species.size,
    startersCount: starters.length,
    trainersCount: trainers.size,
    worldsCount: campaign.length,
    bannersCount: banners.length,
  };
}

export function getSpecies(id: string): Species | undefined {
  return loadSpecies().get(id);
}

export function getTrainer(id: string): Trainer | undefined {
  return loadTrainers().get(id);
}
