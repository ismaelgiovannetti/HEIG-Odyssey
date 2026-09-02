import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

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
    const filePath = join(process.cwd(), "content", "audio-tracks.json");
    const { tracks } = JSON.parse(readFileSync(filePath, "utf-8"));

    const expectedTrainers = [
      "Fouad", "Nastaran", "Mosqueron", "Augier", "Torri",
      "Gamba", "Auberson", "Tiago", "Mo", "Ismael", "Evan", "Hêche", "Donini"
    ];

    for (const trainer of expectedTrainers) {
      const match = tracks.find((t: any) => t.trainer === trainer);
      expect(match).toBeDefined();
      expect(match?.gameOrigin).toBeTruthy();
    }
  });
});
