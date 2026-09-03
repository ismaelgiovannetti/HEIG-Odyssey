import { getSavedAudioPreferences } from "./audio-preferences";

export const GACHA_SEARCH_DURATION_MS = 3_000;
export const GACHA_HATCH_DURATION_MS = 2_000;

type AudioContextConstructor = new () => AudioContext;
type AudioWindow = Window & { webkitAudioContext?: AudioContextConstructor };

interface PokeApiCryResponse {
  cries?: {
    latest?: unknown;
    legacy?: unknown;
  };
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const audioWindow = window as AudioWindow;
  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

function isAllowedCryUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "raw.githubusercontent.com" &&
      url.pathname.startsWith("/PokeAPI/cries/")
    );
  } catch {
    return false;
  }
}

/**
 * Lecteur éphémère du parcours d'invocation. Les deux ambiances sont
 * synthétisées localement afin de ne distribuer aucune musique protégée.
 */
export class GachaSoundPlayer {
  private context: AudioContext | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  private cryAudio: HTMLAudioElement | null = null;
  private cryRequest: AbortController | null = null;
  private crySpeciesId: string | null = null;
  private cryPreparation: Promise<void> | null = null;
  private shouldPlayCry = false;

  private getReadyContext(): { context: AudioContext; volume: number } | null {
    const preferences = getSavedAudioPreferences();
    if (preferences.isMuted || preferences.volume <= 0) return null;

    if (!this.context) {
      const AudioContextClass = getAudioContextConstructor();
      if (!AudioContextClass) return null;
      this.context = new AudioContextClass();
    }

    if (this.context.state === "suspended") {
      void this.context.resume().catch(() => undefined);
    }

    return { context: this.context, volume: preferences.volume };
  }

  private remember(source: AudioScheduledSourceNode) {
    this.sources.add(source);
    source.addEventListener("ended", () => this.sources.delete(source), {
      once: true,
    });
  }

  private stopScheduledSources() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Une source déjà terminée n'a plus besoin d'être arrêtée.
      }
    }
    this.sources.clear();
  }

  private clearPreparedCry() {
    this.cryRequest?.abort();
    this.cryRequest = null;
    this.cryPreparation = null;
    this.crySpeciesId = null;
    this.shouldPlayCry = false;
    if (this.cryAudio) {
      this.cryAudio.pause();
      this.cryAudio.currentTime = 0;
      this.cryAudio = null;
    }
  }

  private playCryAudio(audio: HTMLAudioElement) {
    if (this.cryAudio !== audio) return;
    try {
      void audio.play().catch(() => undefined);
    } catch {
      // Le son décoratif ne doit jamais bloquer l'affichage du résultat.
    }
  }

  private scheduleTone(
    context: AudioContext,
    destination: AudioNode,
    frequency: number,
    startsAt: number,
    duration: number,
    level: number,
    type: OscillatorType = "sine",
  ) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(
      level,
      startsAt + Math.min(0.08, duration / 4),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + duration);
    this.remember(oscillator);
  }

  private scheduleNoise(
    context: AudioContext,
    destination: AudioNode,
    startsAt: number,
    duration: number,
    level: number,
    filterFrequency: number,
  ) {
    const frameCount = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFrequency, startsAt);
    filter.Q.setValueAtTime(1.4, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(level, startsAt + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
    source.connect(filter).connect(gain).connect(destination);
    source.start(startsAt);
    source.stop(startsAt + duration);
    this.remember(source);
  }

  /** Ambiance grave et ascendante jouée pendant l'ouverture du portail. */
  startPortalSearch() {
    this.stop();
    const ready = this.getReadyContext();
    if (!ready) return;

    const { context, volume } = ready;
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(volume * 0.42, now);
    master.connect(context.destination);

    const drone = context.createOscillator();
    const droneFilter = context.createBiquadFilter();
    const droneGain = context.createGain();
    drone.type = "sawtooth";
    drone.frequency.setValueAtTime(62, now);
    drone.frequency.exponentialRampToValueAtTime(124, now + 2.85);
    droneFilter.type = "lowpass";
    droneFilter.frequency.setValueAtTime(260, now);
    droneFilter.frequency.exponentialRampToValueAtTime(920, now + 2.8);
    droneGain.gain.setValueAtTime(0.0001, now);
    droneGain.gain.exponentialRampToValueAtTime(0.11, now + 0.18);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 3);
    drone.connect(droneFilter).connect(droneGain).connect(master);
    drone.start(now);
    drone.stop(now + 3);
    this.remember(drone);

    this.scheduleNoise(context, master, now, 3, 0.045, 780);
    [220, 293.66, 369.99, 440, 587.33].forEach((frequency, index) => {
      this.scheduleTone(
        context,
        master,
        frequency,
        now + 0.35 + index * 0.48,
        0.72,
        0.07,
        "triangle",
      );
    });
  }

  /** Carillon original et éclat bref synchronisés avec l'éclosion. */
  startEggHatching() {
    this.stop();
    const ready = this.getReadyContext();
    if (!ready) return;

    const { context, volume } = ready;
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(volume * 0.5, now);
    master.connect(context.destination);

    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      this.scheduleTone(
        context,
        master,
        frequency,
        now + index * 0.3,
        0.82,
        0.12,
        "sine",
      );
      this.scheduleTone(
        context,
        master,
        frequency * 2,
        now + 0.04 + index * 0.3,
        0.5,
        0.035,
        "triangle",
      );
    });
    this.scheduleNoise(context, master, now + 0.92, 0.34, 0.08, 2_400);
    this.scheduleTone(context, master, 1318.51, now + 1.18, 0.76, 0.09, "sine");
  }

  /** Précharge le cri pendant l'éclosion sans déclencher sa lecture. */
  async preparePokemonCry(speciesId: string) {
    const preferences = getSavedAudioPreferences();
    if (
      preferences.isMuted ||
      preferences.volume <= 0 ||
      !/^[a-z0-9-]+$/i.test(speciesId)
    )
      return;

    if (
      this.crySpeciesId === speciesId &&
      (this.cryAudio !== null || this.cryPreparation !== null)
    ) {
      await this.cryPreparation;
      return;
    }

    this.clearPreparedCry();
    this.crySpeciesId = speciesId;

    const request = new AbortController();
    this.cryRequest = request;

    const preparation = (async () => {
      try {
        const response = await fetch(
          `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(speciesId)}`,
          { signal: request.signal },
        );
        if (!response.ok) return;

        const payload = (await response.json()) as PokeApiCryResponse;
        const sources = [payload.cries?.latest, payload.cries?.legacy].filter(
          isAllowedCryUrl,
        );
        if (
          request.signal.aborted ||
          sources.length === 0 ||
          typeof Audio === "undefined"
        )
          return;

        let sourceIndex = 0;
        const audio = new Audio(sources[sourceIndex]);
        audio.preload = "auto";
        audio.volume = Math.min(1, preferences.volume * 0.85);
        this.cryAudio = audio;

        audio.addEventListener("error", () => {
          sourceIndex += 1;
          if (sourceIndex >= sources.length) {
            if (this.cryAudio === audio) {
              this.cryAudio = null;
              this.crySpeciesId = null;
            }
            return;
          }
          audio.src = sources[sourceIndex];
          if (typeof audio.load === "function") audio.load();
          if (this.shouldPlayCry) this.playCryAudio(audio);
        });
        audio.addEventListener("ended", () => {
          if (this.cryAudio === audio) {
            this.cryAudio = null;
            this.crySpeciesId = null;
          }
        });
        if (typeof audio.load === "function") audio.load();
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          // PokéAPI est un enrichissement : son indisponibilité reste silencieuse.
        }
      } finally {
        if (this.cryRequest === request) this.cryRequest = null;
      }
    })();

    this.cryPreparation = preparation;
    await preparation;
    if (this.cryPreparation === preparation) this.cryPreparation = null;
    if (!this.cryAudio && this.crySpeciesId === speciesId)
      this.crySpeciesId = null;
  }

  /** Joue une seule fois le cri préchargé au moment de la révélation. */
  async playPokemonCry(speciesId: string) {
    this.stopScheduledSources();
    const preparation = this.preparePokemonCry(speciesId);
    this.shouldPlayCry = true;
    await preparation;

    if (this.crySpeciesId === speciesId && this.cryAudio) {
      this.playCryAudio(this.cryAudio);
    }
  }

  stop() {
    this.stopScheduledSources();
    this.clearPreparedCry();
  }

  destroy() {
    this.stop();
    if (this.context) {
      void this.context.close().catch(() => undefined);
      this.context = null;
    }
  }
}
