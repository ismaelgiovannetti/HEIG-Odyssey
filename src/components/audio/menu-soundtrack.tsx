"use client";

import { useEffect, useRef } from "react";
import { useAudioPreferences } from "@/lib/audio/use-audio-preferences";

interface MenuSoundtrackProps {
  /** Nom du fichier dans `public/audio/tracks/`, sans extension. */
  trackId: string;
}

/**
 * Musique d'ambiance bouclée d'un écran de menu (accueil, gacha, équipe,
 * entraînement, campagne). Pilotée par la barre de son globale de la navbar ;
 * silencieuse si le fichier n'existe pas encore.
 */
export function MenuSoundtrack({ trackId }: Readonly<MenuSoundtrackProps>) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMuted, volume } = useAudioPreferences();

  // Volume / mute en direct, sans redémarrer la piste. Reprend la lecture si le
  // joueur réactive le son depuis la navbar.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
    audio.volume = volume;
    if (!isMuted && audio.paused && audio.src) {
      audio.play().catch(() => {});
    }
  }, [isMuted, volume]);

  // Changement d'écran : nouvelle piste, en boucle.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = `/audio/tracks/${trackId}.mp3`;
    audio.loop = true;
    audio.muted = isMuted;
    audio.volume = volume;
    if (!isMuted) {
      // L'autoplay est souvent débloqué par la navigation (clic préalable).
      audio.play().catch(() => {});
    }

    return () => {
      audio.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  return (
    <audio
      ref={audioRef}
      preload="none"
      aria-hidden="true"
      // Fichier manquant : on n'affiche rien et on ne casse rien.
      onError={() => {}}
    />
  );
}
