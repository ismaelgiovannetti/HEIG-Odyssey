import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface AudioTrack {
  id: string;
  title: string;
  gameOrigin: string;
  src: string;
  loop: boolean;
  defaultVolume: number;
  trainer?: string;
}

interface TrainerWithMusic {
  id: string;
  name: string;
  musicTrack: string;
}

function loadAudioTracks(): AudioTrack[] {
  const filePath = join(process.cwd(), "content", "audio-tracks.json");
  return (JSON.parse(readFileSync(filePath, "utf-8")) as { tracks: AudioTrack[] }).tracks;
}

function loadTrainers(): TrainerWithMusic[] {
  const filePath = join(process.cwd(), "content", "trainers.json");
  return (JSON.parse(readFileSync(filePath, "utf-8")) as { trainers: TrainerWithMusic[] }).trainers;
}

describe("Audio Tracks Catalog & Trainer Associations (T-US08-05, T-US08-06)", () => {
  it("valide la structure du catalogue audio-tracks.json", () => {
    const filePath = join(process.cwd(), "content", "audio-tracks.json");
    const content = JSON.parse(readFileSync(filePath, "utf-8"));

    expect(content).toHaveProperty("version");
    expect(Array.isArray(content.tracks)).toBe(true);
    expect(content.tracks.length).toBeGreaterThanOrEqual(13);

    for (const track of content.tracks) {
      expect(track).toHaveProperty("id");
      expect(track).toHaveProperty("title");
      expect(track).toHaveProperty("gameOrigin");
      expect(track).toHaveProperty("src");
      expect(typeof track.loop).toBe("boolean");
      expect(track.defaultVolume).toBeGreaterThan(0);
      expect(track.defaultVolume).toBeLessThanOrEqual(1);
    }
  });

  it("vérifie que tous les dresseurs principaux ont une musique de combat assignée", () => {
    const tracks = loadAudioTracks();

    const expectedTrainers = [
      "Fouad", "Nastaran", "Mosqueron", "Augier", "Torri",
      "Gamba", "Auberson", "Tiago", "Mo", "Ismael", "Evan", "Hêche", "Donini"
    ];

    for (const trainer of expectedTrainers) {
      const match = tracks.find((track) => track.trainer === trainer);
      expect(match).toBeDefined();
      expect(match?.gameOrigin).toBeTruthy();
    }
  });

  it("associe le musicTrack de chaque adversaire à une piste connue", () => {
    const tracks = loadAudioTracks();
    const trainers = loadTrainers();
    const knownTrackIds = new Set(tracks.map((track) => track.id));

    for (const trainer of trainers) {
      expect(
        knownTrackIds.has(trainer.musicTrack),
        `${trainer.id} (${trainer.name}) référence la piste inconnue ${trainer.musicTrack}`,
      ).toBe(true);
    }
  });

  it("vérifie que chaque piste du catalogue possède un fichier audio local", () => {
    const tracks = loadAudioTracks();

    for (const track of tracks) {
      const relativePath = track.src.replace(/^\//, "");
      const localPath = join(process.cwd(), "public", ...relativePath.split("/"));

      expect(
        existsSync(localPath),
        `${track.id} référence un fichier local absent : ${track.src}`,
      ).toBe(true);
    }
  });
});
