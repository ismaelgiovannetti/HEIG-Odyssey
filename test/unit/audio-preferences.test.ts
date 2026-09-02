// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getSavedAudioPreferences,
  saveAudioPreferences,
  AUDIO_STORAGE_KEY_MUTED,
  AUDIO_STORAGE_KEY_VOLUME,
  BATTLE_AUDIO_STORAGE_KEY_MUTED,
  BATTLE_AUDIO_STORAGE_KEY_VOLUME,
} from "@/lib/audio/audio-preferences";

describe("Audio Preferences & Persistence (T-US14-02, T-US08-03)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retourne les préférences par défaut si aucune valeur n'est stockée", () => {
    const prefs = getSavedAudioPreferences();
    expect(prefs.isMuted).toBe(false);
    expect(prefs.volume).toBe(0.7);
  });

  it("sauvegarde et recharge la préférence muette dans le localStorage", () => {
    saveAudioPreferences({ isMuted: true });
    expect(localStorage.getItem(AUDIO_STORAGE_KEY_MUTED)).toBe("true");

    const reloaded = getSavedAudioPreferences();
    expect(reloaded.isMuted).toBe(true);
    expect(reloaded.volume).toBe(0.7);
  });

  it("sauvegarde et borne le volume entre 0.0 et 1.0", () => {
    saveAudioPreferences({ volume: 0.45 });
    expect(localStorage.getItem(AUDIO_STORAGE_KEY_VOLUME)).toBe("0.45");

    let reloaded = getSavedAudioPreferences();
    expect(reloaded.volume).toBe(0.45);

    saveAudioPreferences({ volume: 1.5 }); // Doit être borné à 1.0
    reloaded = getSavedAudioPreferences();
    expect(reloaded.volume).toBe(1.0);

    saveAudioPreferences({ volume: -0.2 }); // Doit être borné à 0.0
    reloaded = getSavedAudioPreferences();
    expect(reloaded.volume).toBe(0.0);
  });

  it("isole les préférences des combats de celles du reste de l'application", () => {
    saveAudioPreferences({ isMuted: true, volume: 0.25 }, "battle");

    expect(localStorage.getItem(BATTLE_AUDIO_STORAGE_KEY_MUTED)).toBe("true");
    expect(localStorage.getItem(BATTLE_AUDIO_STORAGE_KEY_VOLUME)).toBe("0.25");
    expect(localStorage.getItem(AUDIO_STORAGE_KEY_MUTED)).toBeNull();
    expect(localStorage.getItem(AUDIO_STORAGE_KEY_VOLUME)).toBeNull();
    expect(getSavedAudioPreferences()).toEqual({ isMuted: false, volume: 0.7 });
    expect(getSavedAudioPreferences("battle")).toEqual({ isMuted: true, volume: 0.25 });

    saveAudioPreferences({ volume: 0.9 });

    expect(getSavedAudioPreferences()).toEqual({ isMuted: false, volume: 0.9 });
    expect(getSavedAudioPreferences("battle")).toEqual({ isMuted: true, volume: 0.25 });
  });
});
