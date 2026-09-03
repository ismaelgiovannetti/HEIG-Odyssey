// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";
import { SoundtrackPlayer } from "@/components/audio/soundtrack-player";
import {
  AUDIO_STORAGE_KEY_MUTED,
  AUDIO_STORAGE_KEY_VOLUME,
  saveAudioPreferences,
} from "@/lib/audio/audio-preferences";

describe("SoundtrackPlayer Component & Looping (T-US08-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.resolve(),
    );
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(
      () => {},
    );
  });

  it("applique le volume audio global et réagit à ses changements", () => {
    localStorage.setItem(AUDIO_STORAGE_KEY_VOLUME, "0.4");
    const { container } = render(
      <SoundtrackPlayer trackId="hooh-battle-hgss" autoPlay={false} />,
    );

    const audio = container.querySelector("audio") as HTMLAudioElement;
    expect(audio.volume).toBeCloseTo(0.4);
    expect(audio.muted).toBe(false);

    // La navbar change le réglage global -> la piste de combat suit.
    act(() => {
      saveAudioPreferences({ volume: 0.2 });
    });
    expect(audio.volume).toBeCloseTo(0.2);

    act(() => {
      saveAudioPreferences({ isMuted: true });
    });
    expect(audio.muted).toBe(true);
    // Le volume global reste la seule clé de stockage.
    expect(localStorage.getItem(AUDIO_STORAGE_KEY_MUTED)).toBe("true");
  });

  it("active la lecture en boucle (loop = true) pendant le combat", () => {
    const { container } = render(
      <SoundtrackPlayer
        trackId="hooh-battle-hgss"
        phase="turn"
        autoPlay={false}
      />,
    );

    const audio = container.querySelector("audio");
    expect(
      audio?.getAttribute("src") || (audio as HTMLAudioElement)?.src,
    ).toContain("hooh-battle-hgss.mp3");
    expect(audio?.loop).toBe(true);
  });

  it("désactive la boucle (loop = false) et joue la fanfare lors d'une victoire", () => {
    const { container } = render(
      <SoundtrackPlayer
        trackId="hooh-battle-hgss"
        phase="victory"
        autoPlay={false}
      />,
    );

    const audio = container.querySelector("audio");
    expect(
      audio?.getAttribute("src") || (audio as HTMLAudioElement)?.src,
    ).toContain("victory-theme.mp3");
    expect(audio?.loop).toBe(false);
  });

  it("joue la fanfare de défaite lors d'une défaite", () => {
    const { container } = render(
      <SoundtrackPlayer
        trackId="hooh-battle-hgss"
        phase="defeat"
        autoPlay={false}
      />,
    );

    const audio = container.querySelector("audio");
    expect(
      audio?.getAttribute("src") || (audio as HTMLAudioElement)?.src,
    ).toContain("defeat-theme.mp3");
    expect(audio?.loop).toBe(false);
  });

  it("arrête la piste lorsque le joueur quitte le combat", () => {
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, "pause");
    const { unmount } = render(
      <SoundtrackPlayer trackId="hooh-battle-hgss" phase="turn" />,
    );

    unmount();

    expect(pause).toHaveBeenCalled();
  });
});
