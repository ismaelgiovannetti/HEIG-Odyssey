"use client";

import { Volume1, Volume2, VolumeX } from "lucide-react";
import { saveAudioPreferences } from "@/lib/audio/audio-preferences";
import { useAudioPreferences } from "@/lib/audio/use-audio-preferences";

interface AudioControlsProps {
  className?: string;
}

/**
 * Barre de son unique du jeu, affichée dans la navbar. Elle pilote l'ensemble
 * de l'audio (musique et bruitages de combat, sons du gacha, cris des Pokémon)
 * via les préférences globales persistées (T-US08-03, T-US14-02).
 */
export function AudioControls({ className = "" }: Readonly<AudioControlsProps>) {
  const preferences = useAudioPreferences();
  const effectiveVolume = preferences.isMuted ? 0 : preferences.volume;

  const toggleMute = () => {
    saveAudioPreferences({ isMuted: !preferences.isMuted });
  };

  const handleVolumeChange = (nextVolume: number) => {
    saveAudioPreferences({ volume: nextVolume, isMuted: nextVolume === 0 });
  };

  const VolumeIcon = preferences.isMuted
    ? VolumeX
    : effectiveVolume <= 0.5
      ? Volume1
      : Volume2;

  return (
    <div className={`audio-controls ${className}`}>
      <button
        type="button"
        onClick={toggleMute}
        aria-label={
          preferences.isMuted
            ? "Activer le son du jeu"
            : "Couper le son du jeu (Muet)"
        }
        aria-pressed={preferences.isMuted}
        className="audio-controls__toggle"
      >
        <VolumeIcon size={18} aria-hidden="true" />
      </button>

      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={effectiveVolume}
        onChange={(event) => handleVolumeChange(parseFloat(event.target.value))}
        aria-label="Volume du jeu"
        className="audio-controls__slider"
      />
    </div>
  );
}
