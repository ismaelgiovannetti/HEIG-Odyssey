import { getSavedAudioPreferences } from "./audio-preferences";

// Bruitages d'interface synthétisés (Web Audio API) : aucun asset, zéro
// latence, 100 % fiable, dans l'esprit 8-bit du jeu. Pilotés par la barre de
// son globale de la navbar comme le reste de l'audio.

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export type UiSfxType = "hover" | "select" | "confirm" | "back";

// Les sons d'UI restent nettement plus discrets que ceux des combats.
const MASTER_GAIN_BY_TYPE: Record<UiSfxType, number> = {
  hover: 0.09,
  select: 0.2,
  confirm: 0.24,
  back: 0.18,
};

/** Joue un bip d'interface rétro. Silencieux si le son du jeu est coupé. */
export function playUiSfx(type: UiSfxType): void {
  if (typeof window === "undefined") return;

  const prefs = getSavedAudioPreferences();
  if (prefs.isMuted || prefs.volume <= 0) return;

  const ctx = getContext();
  if (!ctx) return;

  const master = ctx.createGain();
  master.gain.setValueAtTime(
    prefs.volume * MASTER_GAIN_BY_TYPE[type],
    ctx.currentTime,
  );
  master.connect(ctx.destination);

  const t0 = ctx.currentTime;
  const blip = (
    freq: number,
    start: number,
    duration: number,
    wave: OscillatorType = "square",
    peak = 1,
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0 + start);
    gain.gain.setValueAtTime(0.0001, t0 + start);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0 + start);
    osc.stop(t0 + start + duration + 0.02);
  };

  switch (type) {
    case "hover":
      // Effleurement : un souffle court et léger.
      blip(720, 0, 0.045, "triangle", 0.9);
      break;
    case "select":
      // Déplacement de curseur : petit « tic » à deux tons.
      blip(880, 0, 0.04, "square", 1);
      blip(1245, 0.045, 0.06, "square", 0.8);
      break;
    case "confirm":
      // Validation : arpège montant façon touche A.
      blip(660, 0, 0.05, "square", 1);
      blip(990, 0.05, 0.05, "square", 1);
      blip(1320, 0.1, 0.12, "square", 0.9);
      break;
    case "back":
      // Retour / annulation : bip descendant.
      blip(620, 0, 0.05, "square", 1);
      blip(330, 0.055, 0.11, "square", 0.9);
      break;
  }
}
