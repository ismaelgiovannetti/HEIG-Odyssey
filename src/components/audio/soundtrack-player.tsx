"use client";

import { useEffect, useRef } from "react";
import { useAudioPreferences } from "@/lib/audio/use-audio-preferences";

export type SoundtrackPhase = "intro" | "turn" | "victory" | "defeat";

interface SoundtrackPlayerProps {
  trackId: string;
  phase?: SoundtrackPhase;
  autoPlay?: boolean;
  className?: string;
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
 * Lance la piste associée à la phase du combat. Les phases de victoire et de
 * défaite utilisent leur propre thème ; le volume et le mode muet restent
 * pilotés par le contrôle audio global.
 */
export function SoundtrackPlayer({
  trackId,
  phase = "turn",
  autoPlay = true,
  className = "",
}: Readonly<SoundtrackPlayerProps>) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preferences = useAudioPreferences();

  // Source et bouclage selon la phase du combat.
  let currentSrc: string;
  let isLooping: boolean;

  if (phase === "victory") {
    currentSrc = "/audio/tracks/victory-theme.mp3";
    isLooping = false;
  } else if (phase === "defeat") {
    currentSrc = "/audio/tracks/defeat-theme.mp3";
    isLooping = false;
  } else {
    currentSrc = `/audio/tracks/${trackId}.mp3`;
    isLooping = true;
  }

  // Applique le volume / mute sans redémarrer la piste.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = preferences.isMuted;
    audio.volume = preferences.volume;
  }, [preferences.isMuted, preferences.volume]);

  // Changement de piste / phase et (re)lecture.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = currentSrc;
    audio.loop = isLooping;
    audio.muted = preferences.isMuted;
    audio.volume = preferences.volume;

    if (autoPlay && !preferences.isMuted) {
      playAudio(audio);
    }

    return () => {
      // Coupe l'ancienne piste lors d'un changement de combat ou en quittant
      // l'arène.
      audio.pause();
    };
    // La lecture ne doit repartir que sur un vrai changement de piste : les
    // ajustements de volume passent par l'effet ci-dessus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSrc, isLooping, autoPlay]);

  return (
    <div className={`soundtrack-player ${className}`}>
      <audio ref={audioRef} preload="auto" />
    </div>
  );
}
