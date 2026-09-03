// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSavedAudioPreferences,
  saveAudioPreferences,
  subscribeAudioPreferences,
  AUDIO_STORAGE_KEY_MUTED,
  AUDIO_STORAGE_KEY_VOLUME,
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
    expect(getSavedAudioPreferences().volume).toBe(0.45);

    saveAudioPreferences({ volume: 1.5 });
    expect(getSavedAudioPreferences().volume).toBe(1.0);

    saveAudioPreferences({ volume: -0.2 });
    expect(getSavedAudioPreferences().volume).toBe(0.0);
  });

  it("pilote tout le jeu avec un seul réglage global (plus de portée « battle »)", () => {
    saveAudioPreferences({ isMuted: true, volume: 0.25 });

    expect(localStorage.getItem(AUDIO_STORAGE_KEY_MUTED)).toBe("true");
    expect(localStorage.getItem(AUDIO_STORAGE_KEY_VOLUME)).toBe("0.25");
    // Aucune clé de stockage dédiée aux combats ne subsiste.
    expect(
      Object.keys(localStorage).some((key) => key.includes("battle")),
    ).toBe(false);
    expect(getSavedAudioPreferences()).toEqual({ isMuted: true, volume: 0.25 });
  });

  it("notifie les abonnés à chaque changement, puis s'arrête au désabonnement", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAudioPreferences(listener);

    saveAudioPreferences({ volume: 0.5 });
    expect(listener).toHaveBeenCalledWith({ isMuted: false, volume: 0.5 });

    saveAudioPreferences({ isMuted: true });
    expect(listener).toHaveBeenLastCalledWith({ isMuted: true, volume: 0.5 });

    unsubscribe();
    saveAudioPreferences({ volume: 0.1 });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
