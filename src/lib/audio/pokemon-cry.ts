"use client";

import { getSavedAudioPreferences } from "./audio-preferences";

let currentCryAudio: HTMLAudioElement | null = null;

function normalizeCrySpeciesId(speciesId: string): string {
  return speciesId.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface PlayPokemonCryOptions {
  dexNumber?: number;
  interrupt?: boolean;
}

/**
 * Joue le cri sonore officiel d'un Pokémon lors de son entrée au combat ou de sa sélection.
 * Prend en compte le volume et l'état muet définis dans les préférences audio.
 */
export function playPokemonCry(
  speciesId: string,
  dexNumberOrOptions?: number | PlayPokemonCryOptions,
): void {
  if (typeof window === "undefined" || !speciesId) return;

  const prefs = getSavedAudioPreferences();
  if (prefs.isMuted || prefs.volume <= 0) return;

  const options: PlayPokemonCryOptions =
    typeof dexNumberOrOptions === "number"
      ? { dexNumber: dexNumberOrOptions }
      : (dexNumberOrOptions ?? {});

  const interrupt = options.interrupt ?? true;

  try {
    // Arrêter le cri précédent s'il est en cours pour éviter la superposition (si interruption demandée)
    if (interrupt && currentCryAudio) {
      currentCryAudio.pause();
      currentCryAudio.currentTime = 0;
    }

    const normalized = normalizeCrySpeciesId(speciesId);
    const primaryUrl = `https://play.pokemonshowdown.com/audio/cries/${normalized}.mp3`;
    const fallbackUrl = options.dexNumber
      ? `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${options.dexNumber}.ogg`
      : null;

    const audio = new Audio(primaryUrl);
    audio.volume = Math.max(0.1, Math.min(1, prefs.volume));
    if (interrupt) {
      currentCryAudio = audio;
    }

    if (fallbackUrl) {
      audio.onerror = () => {
        if (!interrupt || currentCryAudio === audio) {
          const fallbackAudio = new Audio(fallbackUrl);
          fallbackAudio.volume = audio.volume;
          if (interrupt) {
            currentCryAudio = fallbackAudio;
          }
          fallbackAudio.play().catch(() => {
            // Ignorer silencieusement si la ressource n'est pas disponible
          });
        }
      };
    }

    audio.play().catch(() => {
      // Ignorer les éventuels blocages de politique d'autoplay navigateur
    });
  } catch {
    // Éviter tout crash de l'interface en cas d'indisponibilité audio
  }
}
