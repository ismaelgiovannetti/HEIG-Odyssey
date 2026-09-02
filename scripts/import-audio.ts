import fs from "node:fs";
import path from "node:path";

interface AudioTrackEntry {
  id: string;
  title: string;
  gameOrigin: string;
  trainer?: string;
  src: string;
  loop: boolean;
  defaultVolume: number;
}

// En-tête MP3 minimal silencieux/valide (1 frame MPEG Audio Layer 3)
const SILENT_MP3_BUFFER = Buffer.from([
  0xff, 0xfb, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

async function importAudioTracks() {
  console.log("=== HEIG Odyssey - Audio Tracks Importer (US-08, US-14) ===");

  const tracksConfigFile = path.join(process.cwd(), "content", "audio-tracks.json");
  if (!fs.existsSync(tracksConfigFile)) {
    throw new Error(`Fichier de configuration audio introuvable : ${tracksConfigFile}`);
  }

  const { tracks } = JSON.parse(fs.readFileSync(tracksConfigFile, "utf-8")) as {
    tracks: AudioTrackEntry[];
  };

  const audioDir = path.join(process.cwd(), "public", "audio", "tracks");
  fs.mkdirSync(audioDir, { recursive: true });

  console.log(`Initialisation de ${tracks.length} pistes audio dans ${audioDir}...`);

  for (const track of tracks) {
    const fileName = `${track.id}.mp3`;
    const targetPath = path.join(audioDir, fileName);

    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, SILENT_MP3_BUFFER);
      console.log(`  ✓ Créé : ${fileName} (${track.title} - ${track.gameOrigin})`);
    } else {
      console.log(`  • Déjà présent : ${fileName}`);
    }
  }

  console.log("\nToutes les pistes audio sont initialisées avec succès !");
}

importAudioTracks().catch((err) => {
  console.error("Erreur lors de l'initialisation audio :", err);
  process.exit(1);
});
