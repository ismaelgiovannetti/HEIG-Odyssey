"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSavedAudioPreferences, type AudioPreferences } from "@/lib/audio/audio-preferences";
import { AudioControls } from "./audio-controls";

export type SoundtrackPhase = "intro" | "turn" | "victory" | "defeat";

interface SoundtrackPlayerProps {
  trackId: string;
  phase?: SoundtrackPhase;
  autoPlay?: boolean;
  className?: string;
  showControls?: boolean;
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
}: Readonly<SoundtrackPlayerProps>) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
  } else {
    // Intro, tours de combat et défaite : la musique du dresseur continue en boucle
    currentSrc = `/audio/tracks/${trackId}.mp3`;
    isLooping = true;
  }

  // Initialisation des préférences
  useEffect(() => {
    const prefs = getSavedAudioPreferences();
    setPreferences(prefs);
  }, []);

  // Gestion de la lecture et du changement de piste/phase
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = currentSrc;
    audio.loop = isLooping;
    audio.muted = preferences.isMuted;
    audio.volume = preferences.volume;

    if (autoPlay && !preferences.isMuted) {
      audio.play().catch(() => {
        // Ignorer les blocages d'autoplay du navigateur avant interaction
      });
    }
  }, [currentSrc, isLooping, autoPlay, preferences.isMuted, preferences.volume]);

  const handlePreferencesChange = useCallback((newPrefs: AudioPreferences) => {
    setPreferences(newPrefs);
    if (audioRef.current) {
      audioRef.current.muted = newPrefs.isMuted;
      audioRef.current.volume = newPrefs.volume;
      if (!newPrefs.isMuted && audioRef.current.paused && autoPlay) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [autoPlay]);

  return (
    <div className={`soundtrack-player flex items-center gap-3 ${className}`}>
      <audio ref={audioRef} preload="auto" />
      {showControls && (
        <AudioControls onPreferencesChange={handlePreferencesChange} />
      )}
    </div>
  );
}
