export const AUDIO_STORAGE_KEY_MUTED = "heig_odyssey_audio_muted";
export const AUDIO_STORAGE_KEY_VOLUME = "heig_odyssey_audio_volume";

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
export function getSavedAudioPreferences(): AudioPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_AUDIO_PREFERENCES;
  }

  try {
    const rawMuted = localStorage.getItem(AUDIO_STORAGE_KEY_MUTED);
    const rawVolume = localStorage.getItem(AUDIO_STORAGE_KEY_VOLUME);

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
export function saveAudioPreferences(prefs: Partial<AudioPreferences>): AudioPreferences {
  if (typeof window === "undefined") {
    return { ...DEFAULT_AUDIO_PREFERENCES, ...prefs };
  }

  try {
    const current = getSavedAudioPreferences();
    const updated: AudioPreferences = {
      isMuted: prefs.isMuted !== undefined ? Boolean(prefs.isMuted) : current.isMuted,
      volume: prefs.volume !== undefined ? Math.max(0, Math.min(1, prefs.volume)) : current.volume,
    };

    localStorage.setItem(AUDIO_STORAGE_KEY_MUTED, String(updated.isMuted));
    localStorage.setItem(AUDIO_STORAGE_KEY_VOLUME, String(updated.volume));

    return updated;
  } catch {
    return { ...DEFAULT_AUDIO_PREFERENCES, ...prefs };
  }
}
