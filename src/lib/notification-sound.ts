export type SoundPreset = "chime" | "ping" | "bell" | "pop" | "marimba" | "glass" | "custom";

export interface ToneNote {
  freq: number;
  targetFreq?: number;
  type?: OscillatorType;
  gain: number;
  delay?: number;
  duration: number;
}

/**
 * Declarative tone definitions for synthesized notification presets.
 */
const PRESETS: Record<Exclude<SoundPreset, "custom">, ToneNote[]> = {
  ping: [
    { freq: 1046.5, gain: 0.15, duration: 0.25 } // C6 crisp ping
  ],
  bell: [
    { freq: 587.33, gain: 0.12, duration: 0.6 }, // D5
    { freq: 880.00, gain: 0.12, duration: 0.6 }  // A5 warm bell harmony
  ],
  pop: [
    { freq: 400, targetFreq: 800, gain: 0.2, duration: 0.1 } // Bubble pop swoop
  ],
  chime: [
    { freq: 659.25, gain: 0.12, duration: 0.35, delay: 0 },   // E5
    { freq: 880.00, gain: 0.15, duration: 0.35, delay: 0.1 }  // A5 two-step chime
  ],
  marimba: [
    { freq: 523.25, type: "triangle", gain: 0.16, duration: 0.3 },                 // C5 wooden strike
    { freq: 783.99, type: "triangle", gain: 0.13, duration: 0.4, delay: 0.12 }     // G5 answer
  ],
  glass: [
    { freq: 1318.51, gain: 0.1, duration: 0.5 },                                   // E6 crystal tap
    { freq: 1975.53, gain: 0.05, duration: 0.4, delay: 0.05 }                      // B6 shimmer
  ]
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioCtx || audioCtx.state === "closed") {
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

/**
 * Plays a notification sound by preset name or custom audio URL.
 *
 * @param preset Selected sound preset ("chime", "ping", "bell", "pop", or "custom")
 * @param customSoundUrl Data URL or path for custom sound file (when preset === "custom")
 * @param volume Master playback volume between 0.0 and 1.0 (default: 1.0)
 */
export function playNotificationSound(
  preset: SoundPreset = "chime",
  customSoundUrl?: string,
  volume: number = 1.0
): void {
  try {
    const normalizedVolume = Math.max(0, Math.min(1, volume));
    if (normalizedVolume === 0) return;

    // Handle custom audio file playback
    if (preset === "custom") {
      if (customSoundUrl && customSoundUrl.trim()) {
        const audio = new Audio(customSoundUrl);
        audio.volume = normalizedVolume;
        audio.play().catch((err) => {
          console.warn("Failed to play custom sound, falling back to chime:", err);
          // Fallback to chime if custom playback fails
          playSynthesizedPreset("chime", normalizedVolume);
        });
        return;
      }
      // If custom is selected but no URL provided, fall back to chime
      preset = "chime";
    }

    playSynthesizedPreset(preset, normalizedVolume);
  } catch (err) {
    console.error("Failed to play notification sound:", err);
  }
}

/**
 * Synthesizes sound tones using Web Audio API nodes.
 */
function playSynthesizedPreset(preset: Exclude<SoundPreset, "custom">, volume: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = PRESETS[preset] || PRESETS.chime;
  const now = ctx.currentTime;

  // Master volume node for synthesized sounds
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(volume, now);
  masterGain.connect(ctx.destination);

  notes.forEach((note) => {
    const startTime = now + (note.delay || 0);
    const stopTime = startTime + note.duration;

    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();

    osc.type = note.type || "sine";
    osc.frequency.setValueAtTime(note.freq, startTime);

    if (note.targetFreq) {
      osc.frequency.exponentialRampToValueAtTime(note.targetFreq, stopTime);
    }

    // Smooth envelope attack and release to prevent audio clicks
    noteGain.gain.setValueAtTime(note.gain, startTime);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    osc.connect(noteGain);
    noteGain.connect(masterGain);

    // Explicit node cleanup after note completion
    osc.onended = () => {
      try {
        osc.disconnect();
        noteGain.disconnect();
      } catch (_) {}
    };

    osc.start(startTime);
    osc.stop(stopTime);
  });
}

