import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const writeChanges = process.argv.includes("--write");

const sharedAssets = [
  ["public/favicon.svg", "landing-page/assets/favicon.svg"],
  ["public/heig-odyssey-logo.png", "landing-page/assets/heig-odyssey-logo.png"],
  ["public/pokeball-pixel.svg", "landing-page/assets/pokeball-pixel.svg"],
  [
    "public/battle-arena-background-v2.jpg",
    "landing-page/assets/battle-arena-background-v2.jpg",
  ],
  ["public/team/evan.jpg", "landing-page/assets/team/evan.jpg"],
  ["public/team/ismael.jpg", "landing-page/assets/team/ismael.jpg"],
  ["public/team/mo.jpg", "landing-page/assets/team/mo.jpg"],
  ["public/team/tiago.jpg", "landing-page/assets/team/tiago.jpg"],
  [
    "public/sprites/trainer-player-back.png",
    "landing-page/assets/sprites/trainer-player-back.png",
  ],
  [
    "public/sprites/pokemon/back/wailord.png",
    "landing-page/assets/sprites/321.png",
  ],
];

let mismatches = 0;

for (const [sourceRelativePath, targetRelativePath] of sharedAssets) {
  const sourcePath = path.join(repositoryRoot, sourceRelativePath);
  const targetPath = path.join(repositoryRoot, targetRelativePath);
  const source = await readFile(sourcePath);
  const target = await readFile(targetPath).catch(() => null);

  if (target?.equals(source)) {
    continue;
  }

  if (writeChanges) {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
    console.log(`Synchronisé : ${targetRelativePath}`);
    continue;
  }

  mismatches += 1;
  console.error(
    `Asset landing désynchronisé : ${targetRelativePath} (source : ${sourceRelativePath})`,
  );
}

if (mismatches > 0) {
  console.error(
    `Lance « npm run landing:assets:sync » puis versionne les fichiers mis à jour.`,
  );
  process.exitCode = 1;
} else if (!writeChanges) {
  console.log("Les assets partagés de la landing page sont synchronisés.");
}
