"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_AUDIO_PREFERENCES,
  getSavedAudioPreferences,
  subscribeAudioPreferences,
  type AudioPreferences,
} from "./audio-preferences";

/**
 * Préférences audio globales, réactives : le composant se met à jour dès que le
 * curseur de la barre de son (dans la navbar) change, ici comme dans un autre
 * onglet. Rend d'abord les valeurs par défaut pour rester cohérent avec le SSR.
 */
export function useAudioPreferences(): AudioPreferences {
  const [preferences, setPreferences] = useState<AudioPreferences>(
    DEFAULT_AUDIO_PREFERENCES,
  );

  useEffect(() => {
    setPreferences(getSavedAudioPreferences());
    return subscribeAudioPreferences(setPreferences);
  }, []);

  return preferences;
}
