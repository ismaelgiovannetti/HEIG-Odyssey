export const AUDIO_STORAGE_KEY_MUTED = "heig_odyssey_audio_muted";
export const AUDIO_STORAGE_KEY_VOLUME = "heig_odyssey_audio_volume";
export const BATTLE_AUDIO_STORAGE_KEY_MUTED = "heig_odyssey_battle_audio_muted";
export const BATTLE_AUDIO_STORAGE_KEY_VOLUME = "heig_odyssey_battle_audio_volume";

export type AudioPreferenceScope = "app" | "battle";

export interface AudioPreferences {
  isMuted: boolean;
  volume: number; // 0.0 à 1.0
}

const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  isMuted: false,
  volume: 0.7,
};

/**
 * Récupère les préférences audio depuis le localStorage (T-US14-02).
 */
function storageKeys(scope: AudioPreferenceScope) {
  return scope === "battle"
    ? { muted: BATTLE_AUDIO_STORAGE_KEY_MUTED, volume: BATTLE_AUDIO_STORAGE_KEY_VOLUME }
    : { muted: AUDIO_STORAGE_KEY_MUTED, volume: AUDIO_STORAGE_KEY_VOLUME };
}

export function getSavedAudioPreferences(scope: AudioPreferenceScope = "app"): AudioPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_AUDIO_PREFERENCES;
  }

  try {
    const keys = storageKeys(scope);
    const rawMuted = localStorage.getItem(keys.muted);
    const rawVolume = localStorage.getItem(keys.volume);

    const isMuted = rawMuted !== null ? rawMuted === "true" : DEFAULT_AUDIO_PREFERENCES.isMuted;
    const parsedVolume = rawVolume !== null ? parseFloat(rawVolume) : DEFAULT_AUDIO_PREFERENCES.volume;
    const volume = Number.isFinite(parsedVolume) ? Math.max(0, Math.min(1, parsedVolume)) : DEFAULT_AUDIO_PREFERENCES.volume;

    return { isMuted, volume };
  } catch {
    return DEFAULT_AUDIO_PREFERENCES;
  }
}

/**
 * Sauvegarde les préférences audio dans le localStorage (T-US14-02).
 */
export function saveAudioPreferences(
  prefs: Partial<AudioPreferences>,
  scope: AudioPreferenceScope = "app",
): AudioPreferences {
  if (typeof window === "undefined") {
    return { ...DEFAULT_AUDIO_PREFERENCES, ...prefs };
  }

  try {
    const current = getSavedAudioPreferences(scope);
    const keys = storageKeys(scope);
    const updated: AudioPreferences = {
      isMuted: prefs.isMuted !== undefined ? Boolean(prefs.isMuted) : current.isMuted,
      volume: prefs.volume !== undefined ? Math.max(0, Math.min(1, prefs.volume)) : current.volume,
    };

    localStorage.setItem(keys.muted, String(updated.isMuted));
    localStorage.setItem(keys.volume, String(updated.volume));

    return updated;
  } catch {
    return { ...DEFAULT_AUDIO_PREFERENCES, ...prefs };
  }
}
