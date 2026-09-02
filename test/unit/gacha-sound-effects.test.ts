// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audio/audio-preferences", () => ({
  getSavedAudioPreferences: () => ({ isMuted: false, volume: 1 }),
}));

import { GachaSoundPlayer } from "@/lib/audio/gacha-sound-effects";

class FakeAudio {
  static instances: FakeAudio[] = [];

  readonly listeners = new Map<string, Array<() => void>>();
  readonly play = vi.fn(async () => undefined);
  readonly pause = vi.fn();
  preload = "";
  volume = 1;
  currentTime = 0;

  constructor(public src: string) {
    FakeAudio.instances.push(this);
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type: string) {
    this.listeners.get(type)?.forEach((listener) => listener());
  }
}

class FakeAudioContext {
  state = "running";
  readonly resume = vi.fn(async () => undefined);
  readonly close = vi.fn(async () => undefined);
}

describe("sons du tirage gacha", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          cries: {
            latest: "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg",
          },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("joue deux fois le cri du Pokémon recruté", async () => {
    const player = new GachaSoundPlayer();

    await player.playPokemonCry("pikachu");

    const audio = FakeAudio.instances[0];
    expect(audio.play).toHaveBeenCalledTimes(1);
    audio.emit("ended");
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(audio.currentTime).toBe(0);
    audio.emit("ended");
    expect(audio.play).toHaveBeenCalledTimes(2);

    player.destroy();
  });
});
