import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

interface SpeciesItem {
  id: string;
  dexNumber: number;
  name: string;
}

interface SpriteManifestEntry {
  speciesId: string;
  dexNumber: number;
  name: string;
  front: string;
  back: string;
  frontShiny: string;
  backShiny: string;
  frontHash?: string;
  importedAt: string;
  source: string;
}

interface SpriteManifest {
  version: string;
  source: string;
  generatedAt: string;
  sprites: Record<string, SpriteManifestEntry>;
}

async function downloadFile(url: string, destPath: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return false;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destPath, buffer);
    return true;
  } catch {
    return false;
  }
}

function calculateFileHash(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

async function importSprites() {
  console.log("=== HEIG Odyssey - Complete PokeAPI Sprite Importer (US-16) ===");

  const speciesFilePath = path.join(process.cwd(), "content", "species.json");
  if (!fs.existsSync(speciesFilePath)) {
    throw new Error(`Species file not found at ${speciesFilePath}`);
  }

  const raw = JSON.parse(fs.readFileSync(speciesFilePath, "utf-8")) as {
    species: SpeciesItem[];
  };

  const baseDir = path.join(process.cwd(), "public", "sprites", "pokemon");
  const frontDir = path.join(baseDir, "front");
  const backDir = path.join(baseDir, "back");
  const frontShinyDir = path.join(baseDir, "front_shiny");
  const backShinyDir = path.join(baseDir, "back_shiny");

  fs.mkdirSync(frontDir, { recursive: true });
  fs.mkdirSync(backDir, { recursive: true });
  fs.mkdirSync(frontShinyDir, { recursive: true });
  fs.mkdirSync(backShinyDir, { recursive: true });

  const manifest: SpriteManifest = {
    version: "1.0.0",
    source: "PokéAPI (Gen 4 / Pokémon Showdown assets)",
    generatedAt: new Date().toISOString(),
    sprites: {},
  };

  console.log(`Found ${raw.species.length} species to process (front, back, front_shiny, back_shiny).`);

  // Process in concurrent chunks of 25
  const CHUNK_SIZE = 25;
  for (let i = 0; i < raw.species.length; i += CHUNK_SIZE) {
    const chunk = raw.species.slice(i, i + CHUNK_SIZE);
    process.stdout.write(`Processing batch ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(raw.species.length / CHUNK_SIZE)}...\r`);

    await Promise.all(
      chunk.map(async (item) => {
        const frontFile = path.join(frontDir, `${item.id}.png`);
        const backFile = path.join(backDir, `${item.id}.png`);
        const frontShinyFile = path.join(frontShinyDir, `${item.id}.png`);
        const backShinyFile = path.join(backShinyDir, `${item.id}.png`);

        const frontUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${item.dexNumber}.png`;
        const backUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${item.dexNumber}.png`;
        const frontShinyUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${item.dexNumber}.png`;
        const backShinyUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/${item.dexNumber}.png`;

        if (!fs.existsSync(frontFile)) {
          await downloadFile(frontUrl, frontFile);
        }

        if (!fs.existsSync(backFile)) {
          await downloadFile(backUrl, backFile);
        }

        if (!fs.existsSync(frontShinyFile)) {
          await downloadFile(frontShinyUrl, frontShinyFile);
        }

        if (!fs.existsSync(backShinyFile)) {
          await downloadFile(backShinyUrl, backShinyFile);
        }

        const frontRel = `/sprites/pokemon/front/${item.id}.png`;
        const backRel = `/sprites/pokemon/back/${item.id}.png`;
        const frontShinyRel = `/sprites/pokemon/front_shiny/${item.id}.png`;
        const backShinyRel = `/sprites/pokemon/back_shiny/${item.id}.png`;

        manifest.sprites[item.id] = {
          speciesId: item.id,
          dexNumber: item.dexNumber,
          name: item.name,
          front: fs.existsSync(frontFile) ? frontRel : "/pokeball-pixel.svg",
          back: fs.existsSync(backFile) ? backRel : "/pokeball-pixel.svg",
          frontShiny: fs.existsSync(frontShinyFile) ? frontShinyRel : "/pokeball-pixel.svg",
          backShiny: fs.existsSync(backShinyFile) ? backShinyRel : "/pokeball-pixel.svg",
          frontHash: calculateFileHash(frontFile),
          importedAt: new Date().toISOString(),
          source: `PokeAPI #${item.dexNumber}`,
        };
      })
    );
  }

  const manifestPath = path.join(process.cwd(), "public", "sprites", "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`\nSprite manifest generated at ${manifestPath} (${Object.keys(manifest.sprites).length} entries)`);
  console.log("Import completed successfully!");
}

importSprites().catch((err) => {
  console.error("Error during sprite import:", err);
  process.exit(1);
});
