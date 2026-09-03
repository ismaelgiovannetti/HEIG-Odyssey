"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSavedAudioPreferences,
  type AudioPreferenceScope,
  type AudioPreferences,
} from "@/lib/audio/audio-preferences";
import { AudioControls } from "./audio-controls";

export type SoundtrackPhase = "intro" | "turn" | "victory" | "defeat";

interface SoundtrackPlayerProps {
  trackId: string;
  phase?: SoundtrackPhase;
  autoPlay?: boolean;
  className?: string;
  showControls?: boolean;
  preferenceScope?: AudioPreferenceScope;
}

function playAudio(audio: HTMLAudioElement) {
  try {
    const playback = audio.play();
    void playback?.catch(() => {
      // Ignorer les blocages d'autoplay du navigateur avant interaction.
    });
  } catch {
    // Certains environnements sans moteur audio ne prennent pas en charge play().
  }
}

/**
 * Lecteur de musique de combat avec boucle audio (loop) et transition de victoire (T-US08-03).
 * En cas de défaite, la musique du dresseur continue de jouer fidèlement aux jeux Pokémon originaux.
 */
export function SoundtrackPlayer({
  trackId,
  phase = "turn",
  autoPlay = true,
  className = "",
  showControls = true,
  preferenceScope = "battle",
}: Readonly<SoundtrackPlayerProps>) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferences, setPreferences] = useState<AudioPreferences>({
    isMuted: false,
    volume: 0.7,
  });

  // Détermine la source audio et le bouclage selon la phase
  let currentSrc = `/audio/tracks/${trackId}.mp3`;
  let isLooping = true;

  if (phase === "victory") {
    // Victoire du joueur : fanfare triomphale jouée une seule fois
    currentSrc = "/audio/tracks/victory-theme.mp3";
    isLooping = false;
  } else if (phase === "defeat") {
    // Défaite du joueur : jingle de défaite joué en fin de combat
    currentSrc = "/audio/tracks/defeat-theme.mp3";
    isLooping = false;
  } else {
    // Intro et tours de combat : la musique du dresseur continue en boucle
    currentSrc = `/audio/tracks/${trackId}.mp3`;
    isLooping = true;
  }

  // Initialisation des préférences
  useEffect(() => {
    const prefs = getSavedAudioPreferences(preferenceScope);
    setPreferences(prefs);
    setPreferencesLoaded(true);
  }, [preferenceScope]);

  // Applique le volume indépendamment de la piste pour ne pas la redémarrer
  // lorsque le joueur ajuste simplement ses préférences.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = preferences.isMuted;
    audio.volume = preferences.volume;
  }, [preferences.isMuted, preferences.volume]);

  // Gestion de la lecture et du changement de piste/phase.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !preferencesLoaded) return;

    audio.src = currentSrc;
    audio.loop = isLooping;

    if (autoPlay && !preferences.isMuted) {
      playAudio(audio);
    }

    return () => {
      // Arrête l'ancienne piste lors d'un changement de combat ou en quittant
      // complètement l'arène.
      audio.pause();
    };
  }, [currentSrc, isLooping, autoPlay, preferences.isMuted, preferencesLoaded]);

  const handlePreferencesChange = useCallback((newPrefs: AudioPreferences) => {
    setPreferences(newPrefs);
    if (audioRef.current) {
      audioRef.current.muted = newPrefs.isMuted;
      audioRef.current.volume = newPrefs.volume;
      if (!newPrefs.isMuted && audioRef.current.paused && autoPlay) {
        playAudio(audioRef.current);
      }
    }
  }, [autoPlay]);

  return (
    <div className={`soundtrack-player flex items-center gap-3 ${className}`}>
      <audio ref={audioRef} preload="auto" />
      {showControls && (
        <AudioControls
          preferenceScope={preferenceScope}
          onPreferencesChange={handlePreferencesChange}
        />
      )}
    </div>
  );
}
