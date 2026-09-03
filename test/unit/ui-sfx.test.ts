// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { playUiSfx, type UiSfxType } from "@/lib/audio/ui-sfx";
import {
  AUDIO_STORAGE_KEY_MUTED,
  AUDIO_STORAGE_KEY_VOLUME,
} from "@/lib/audio/audio-preferences";

describe("ui-sfx", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("joue chaque bruitage d'interface sans lever d'erreur", () => {
    const types: UiSfxType[] = ["hover", "select", "confirm", "back"];
    for (const type of types) {
      expect(() => playUiSfx(type)).not.toThrow();
    }
  });

  it("ne fait rien lorsque le son du jeu est coupé", () => {
    localStorage.setItem(AUDIO_STORAGE_KEY_MUTED, "true");
    expect(() => playUiSfx("select")).not.toThrow();

    localStorage.setItem(AUDIO_STORAGE_KEY_MUTED, "false");
    localStorage.setItem(AUDIO_STORAGE_KEY_VOLUME, "0");
    expect(() => playUiSfx("confirm")).not.toThrow();
  });
});
