"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  getSavedAudioPreferences,
  saveAudioPreferences,
  type AudioPreferenceScope,
  type AudioPreferences,
} from "@/lib/audio/audio-preferences";

interface AudioControlsProps {
  className?: string;
  preferenceScope?: AudioPreferenceScope;
  onPreferencesChange?: (prefs: AudioPreferences) => void;
}

/**
 * Bouton accessible pour activer/désactiver le son et persister la préférence (T-US08-03, T-US14-02).
 */
export function AudioControls({
  className = "",
  preferenceScope = "app",
  onPreferencesChange,
}: Readonly<AudioControlsProps>) {
  const [preferences, setPreferences] = useState<AudioPreferences>({
    isMuted: false,
    volume: 0.7,
  });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const saved = getSavedAudioPreferences(preferenceScope);
    setPreferences(saved);
    setIsHydrated(true);
    onPreferencesChange?.(saved);
  }, [onPreferencesChange, preferenceScope]);

  const toggleMute = () => {
    const nextMuted = !preferences.isMuted;
    const updated = saveAudioPreferences({ isMuted: nextMuted }, preferenceScope);
    setPreferences(updated);
    onPreferencesChange?.(updated);
  };

  const handleVolumeChange = (newVolume: number) => {
    const updated = saveAudioPreferences(
      { volume: newVolume, isMuted: newVolume === 0 },
      preferenceScope,
    );
    setPreferences(updated);
    onPreferencesChange?.(updated);
  };

  if (!isHydrated) {
    return (
      <div className={`audio-controls ${className}`} aria-hidden="true">
        <span className="p-2 text-slate-400">
          <Volume2 size={20} />
        </span>
      </div>
    );
  }

  return (
    <div className={`audio-controls flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggleMute}
        aria-label={preferences.isMuted ? "Activer le son du jeu" : "Couper le son du jeu (Muet)"}
        aria-pressed={preferences.isMuted}
        className="p-2 text-slate-300 hover:text-white rounded-md bg-slate-800/80 hover:bg-slate-700 transition focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        {preferences.isMuted ? (
          <VolumeX size={20} className="text-red-400" />
        ) : (
          <Volume2 size={20} className="text-emerald-400" />
        )}
      </button>

      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={preferences.isMuted ? 0 : preferences.volume}
        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
        aria-label={preferenceScope === "battle" ? "Volume des combats" : "Volume audio principal"}
        className="w-20 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
    </div>
  );
}
