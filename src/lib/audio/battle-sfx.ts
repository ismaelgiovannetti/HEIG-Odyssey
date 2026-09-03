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
  | "status_frz"
  | "faint"
  | "switch"
  | "miss";

/**
 * Joue un effet sonore rétro synthétisé via la Web Audio API,
 * calqué sur les signatures sonores emblématiques des jeux Pokémon (Gen 1-4).
 */
export function playBattleSfx(type: BattleSfxType) {
  if (typeof window === "undefined") return;

  const prefs = getSavedAudioPreferences("battle");
  if (prefs.isMuted || prefs.volume <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(prefs.volume * 0.45, ctx.currentTime);
  masterGain.connect(ctx.destination);

  const t = ctx.currentTime;

  switch (type) {
    case "hit": {
      // Impact Normal (Hit standard Pokémon) : Claque vive + coup d'impact net
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.14);

      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.14);
      break;
    }

    case "super_effective": {
      // Super Efficace (Super Effective Pokémon) : Double explosion percutante + résonance dramatique
      // 1er coup percutant aigu
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(520, t);
      osc1.frequency.exponentialRampToValueAtTime(90, t + 0.16);
      gain1.gain.setValueAtTime(1, t);
      gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(t);
      osc1.stop(t + 0.16);

      // 2ème onde lourde et puissante en décalé
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "square";
      osc2.frequency.setValueAtTime(360, t + 0.07);
      osc2.frequency.exponentialRampToValueAtTime(45, t + 0.28);
      gain2.gain.setValueAtTime(1, t + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(t + 0.07);
      osc2.stop(t + 0.28);
      break;
    }

    case "resisted": {
      // Peu Efficace (Not very effective Pokémon) : Coup étouffé, faible, son mat et court ("plonk")
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.12);
      break;
    }

    case "critical": {
      // Coup Critique (Critical Hit Pokémon) : Tranchant aigu perçant ("SHING")
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "square";
      osc1.frequency.setValueAtTime(480, t);
      osc1.frequency.linearRampToValueAtTime(960, t + 0.09);

      gain1.gain.setValueAtTime(0.85, t);
      gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(t);
      osc1.stop(t + 0.22);
      break;
    }

    case "status_par": {
      // Paralysie : Électricité hachée rapide
      [0, 0.05, 0.1, 0.15].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(650 + Math.random() * 250, t + delay);

        gain.gain.setValueAtTime(0.5, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.04);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + delay);
        osc.stop(t + delay + 0.04);
      });
      break;
    }

    case "status_slp": {
      // Sommeil : Arpège berceuse doux
      [523.25, 440, 349.23].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t + idx * 0.12);

        gain.gain.setValueAtTime(0.6, t + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.12 + 0.2);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + idx * 0.12);
        osc.stop(t + idx * 0.12 + 0.2);
      });
      break;
    }

    case "status_psn": {
      // Poison : Bulles toxiques gargouillantes
      [190, 240, 170, 210].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t + idx * 0.07);

        gain.gain.setValueAtTime(0.7, t + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.07 + 0.09);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + idx * 0.07);
        osc.stop(t + idx * 0.07 + 0.09);
      });
      break;
    }

    case "status_brn": {
      // Brûlure : Flammes
      [0, 0.06, 0.12, 0.18].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(260 + Math.random() * 160, t + delay);

        gain.gain.setValueAtTime(0.6, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.07);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + delay);
        osc.stop(t + delay + 0.07);
      });
      break;
    }

    case "status_frz": {
      // Gel : cristallisation glaciale scintillante et montante
      [0, 0.08, 0.16].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880 + idx * 320, t + delay);
        osc.frequency.exponentialRampToValueAtTime(1720 + idx * 320, t + delay + 0.18);

        gain.gain.setValueAtTime(0.35, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.2);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + delay);
        osc.stop(t + delay + 0.2);
      });
      break;
    }

    case "faint": {
      // K.O. : Glissando descendant rétro
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.5);

      gain.gain.setValueAtTime(0.85, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.5);
      break;
    }

    case "switch": {
      // Changement de Pokémon / Pokéball
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(680, t + 0.18);

      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.18);
      break;
    }

    case "miss": {
      // Attaque manquée
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(210, t + 0.18);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.18);
      break;
    }
  }
}
