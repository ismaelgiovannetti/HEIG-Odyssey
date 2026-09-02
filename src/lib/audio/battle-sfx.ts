import { getSavedAudioPreferences } from "./audio-preferences";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export type BattleSfxType =
  | "hit"
  | "super_effective"
  | "resisted"
  | "critical"
  | "status_par"
  | "status_slp"
  | "status_psn"
  | "status_brn"
  | "faint"
  | "switch"
  | "miss";

/**
 * Joue un effet sonore rétro 8-bit synthétisé via la Web Audio API.
 * Zéro fichier audio externe à télécharger, latence nulle, respect du volume et mute de combat.
 */
export function playBattleSfx(type: BattleSfxType) {
  if (typeof window === "undefined") return;

  const prefs = getSavedAudioPreferences("battle");
  if (prefs.isMuted || prefs.volume <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(prefs.volume * 0.4, ctx.currentTime);
  masterGain.connect(ctx.destination);

  const t = ctx.currentTime;

  switch (type) {
    case "hit": {
      // Bruit d'impact normal : bruit blanc rapide + chute de fréquence carrée
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);

      gain.gain.setValueAtTime(1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.12);
      break;
    }

    case "super_effective": {
      // Coup super efficace : double impact puissant et aigu
      [0, 0.08].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(idx === 0 ? 320 : 440, t + delay);
        osc.frequency.exponentialRampToValueAtTime(70, t + delay + 0.15);

        gain.gain.setValueAtTime(1, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.15);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + delay);
        osc.stop(t + delay + 0.15);
      });
      break;
    }

    case "critical": {
      // Coup critique : son tranchant ascendant + impact lourd
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "square";
      osc1.frequency.setValueAtTime(400, t);
      osc1.frequency.linearRampToValueAtTime(800, t + 0.08);

      gain1.gain.setValueAtTime(0.8, t);
      gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(t);
      osc1.stop(t + 0.18);
      break;
    }

    case "resisted": {
      // Coup peu efficace : son étouffé sourd
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.14);

      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.14);
      break;
    }

    case "status_par": {
      // Électricité / Paralysie : crépitement rapide en onde carrée
      [0, 0.04, 0.08, 0.12].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(600 + Math.random() * 300, t + delay);

        gain.gain.setValueAtTime(0.5, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.035);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + delay);
        osc.stop(t + delay + 0.035);
      });
      break;
    }

    case "status_slp": {
      // Sommeil : arpège berceuse doux descendant
      [523.25, 440, 349.23].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t + idx * 0.1);

        gain.gain.setValueAtTime(0.6, t + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.1 + 0.18);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + idx * 0.1);
        osc.stop(t + idx * 0.1 + 0.18);
      });
      break;
    }

    case "status_psn": {
      // Poison : gargouillement de fréquences
      [180, 220, 160, 190].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t + idx * 0.06);

        gain.gain.setValueAtTime(0.7, t + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.06 + 0.08);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + idx * 0.06);
        osc.stop(t + idx * 0.06 + 0.08);
      });
      break;
    }

    case "status_brn": {
      // Brûlure : crépitement de flammes
      [0, 0.05, 0.1, 0.15].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(250 + Math.random() * 150, t + delay);

        gain.gain.setValueAtTime(0.6, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.06);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + delay);
        osc.stop(t + delay + 0.06);
      });
      break;
    }

    case "faint": {
      // K.O. : glissando descendant caractéristique
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(360, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.45);

      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.45);
      break;
    }

    case "switch": {
      // Changement de Pokémon / Pokéball : bip ascendant rapide
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(250, t);
      osc.frequency.exponentialRampToValueAtTime(650, t + 0.16);

      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.16);
      break;
    }

    case "miss": {
      // Attaque manquée : sifflement rapide
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(500, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
      break;
    }
  }
}
