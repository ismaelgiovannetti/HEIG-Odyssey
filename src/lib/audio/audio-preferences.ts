export const AUDIO_STORAGE_KEY_MUTED = "heig_odyssey_audio_muted";
export const AUDIO_STORAGE_KEY_VOLUME = "heig_odyssey_audio_volume";

export interface AudioPreferences {
  isMuted: boolean;
  volume: number; // 0.0 à 1.0
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  isMuted: false,
  volume: 0.7,
};

// Un seul réglage audio pour tout le jeu : musique de combat, bruitages de
// combat, sons du gacha et cris des Pokémon obéissent tous à ces préférences.
const AUDIO_PREFERENCES_EVENT = "heig-odyssey:audio-preferences";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Préférences audio globales, lues depuis le localStorage. */
export function getSavedAudioPreferences(): AudioPreferences {
  if (typeof window === "undefined") {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }

  try {
    const rawMuted = localStorage.getItem(AUDIO_STORAGE_KEY_MUTED);
    const rawVolume = localStorage.getItem(AUDIO_STORAGE_KEY_VOLUME);

    const isMuted =
      rawMuted !== null
        ? rawMuted === "true"
        : DEFAULT_AUDIO_PREFERENCES.isMuted;
    const parsedVolume =
      rawVolume !== null
        ? parseFloat(rawVolume)
        : DEFAULT_AUDIO_PREFERENCES.volume;
    const volume = Number.isFinite(parsedVolume)
      ? clamp01(parsedVolume)
      : DEFAULT_AUDIO_PREFERENCES.volume;

    return { isMuted, volume };
  } catch {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }
}

/** Persiste les préférences audio globales et prévient les abonnés. */
export function saveAudioPreferences(
  prefs: Partial<AudioPreferences>,
): AudioPreferences {
  if (typeof window === "undefined") {
    return { ...DEFAULT_AUDIO_PREFERENCES, ...prefs };
  }

  const current = getSavedAudioPreferences();
  const updated: AudioPreferences = {
    isMuted:
      prefs.isMuted !== undefined ? Boolean(prefs.isMuted) : current.isMuted,
    volume: prefs.volume !== undefined ? clamp01(prefs.volume) : current.volume,
  };

  try {
    localStorage.setItem(AUDIO_STORAGE_KEY_MUTED, String(updated.isMuted));
    localStorage.setItem(AUDIO_STORAGE_KEY_VOLUME, String(updated.volume));
    window.dispatchEvent(
      new CustomEvent<AudioPreferences>(AUDIO_PREFERENCES_EVENT, {
        detail: updated,
      }),
    );
  } catch {
    // Stockage indisponible : on renvoie tout de même la valeur calculée.
  }

  return updated;
}

/**
 * S'abonne aux changements de préférences audio, dans le même onglet
 * (`saveAudioPreferences`) comme dans les autres (`storage`). Renvoie une
 * fonction de désabonnement.
 */
export function subscribeAudioPreferences(
  listener: (prefs: AudioPreferences) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<AudioPreferences>).detail;
    listener(detail ?? getSavedAudioPreferences());
  };
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === AUDIO_STORAGE_KEY_MUTED ||
      event.key === AUDIO_STORAGE_KEY_VOLUME
    ) {
      listener(getSavedAudioPreferences());
    }
  };

  window.addEventListener(AUDIO_PREFERENCES_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(AUDIO_PREFERENCES_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}
