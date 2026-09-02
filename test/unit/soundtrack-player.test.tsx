// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { SoundtrackPlayer } from "@/components/audio/soundtrack-player";

describe("SoundtrackPlayer Component & Looping (T-US08-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  it("active la lecture en boucle (loop = true) pendant le combat", () => {
    const { container } = render(
      <SoundtrackPlayer trackId="hooh-battle-hgss" phase="turn" autoPlay={false} />
    );

    const audio = container.querySelector("audio");
    expect(audio).toBeDefined();
    expect(audio?.getAttribute("src") || (audio as any)?.src).toContain("hooh-battle-hgss.mp3");
    expect(audio?.loop).toBe(true);
  });

  it("désactive la boucle (loop = false) et joue la fanfare lors d'une victoire", () => {
    const { container } = render(
      <SoundtrackPlayer trackId="hooh-battle-hgss" phase="victory" autoPlay={false} />
    );

    const audio = container.querySelector("audio");
    expect(audio?.getAttribute("src") || (audio as any)?.src).toContain("victory-theme.mp3");
    expect(audio?.loop).toBe(false);
  });

  it("maintient la musique du dresseur en boucle lors d'une défaite comme dans les jeux Pokémon", () => {
    const { container } = render(
      <SoundtrackPlayer trackId="hooh-battle-hgss" phase="defeat" autoPlay={false} />
    );

    const audio = container.querySelector("audio");
    expect(audio?.getAttribute("src") || (audio as any)?.src).toContain("hooh-battle-hgss.mp3");
    expect(audio?.loop).toBe(true);
  });
});
