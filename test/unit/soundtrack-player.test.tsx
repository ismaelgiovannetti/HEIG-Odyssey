// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SoundtrackPlayer } from "@/components/audio/soundtrack-player";
import {
  AUDIO_STORAGE_KEY_VOLUME,
  BATTLE_AUDIO_STORAGE_KEY_VOLUME,
} from "@/lib/audio/audio-preferences";

describe("SoundtrackPlayer Component & Looping (T-US08-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  it("modifie uniquement le volume des combats", () => {
    localStorage.setItem(AUDIO_STORAGE_KEY_VOLUME, "0.4");
    render(<SoundtrackPlayer trackId="hooh-battle-hgss" autoPlay={false} />);

    fireEvent.change(screen.getByLabelText("Volume des combats"), {
      target: { value: "0.2" },
    });

    expect(localStorage.getItem(BATTLE_AUDIO_STORAGE_KEY_VOLUME)).toBe("0.2");
    expect(localStorage.getItem(AUDIO_STORAGE_KEY_VOLUME)).toBe("0.4");
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

  it("joue la fanfare de défaite lors d'une défaite", () => {
    const { container } = render(
      <SoundtrackPlayer trackId="hooh-battle-hgss" phase="defeat" autoPlay={false} />
    );

    const audio = container.querySelector("audio");
    expect(audio?.getAttribute("src") || (audio as any)?.src).toContain("defeat-theme.mp3");
    expect(audio?.loop).toBe(false);
  });

  it("arrête la piste lorsque le joueur quitte le combat", () => {
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, "pause");
    const { unmount } = render(
      <SoundtrackPlayer trackId="hooh-battle-hgss" phase="turn" />
    );

    unmount();

    expect(pause).toHaveBeenCalled();
  });
});
