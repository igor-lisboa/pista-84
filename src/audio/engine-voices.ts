import type {Waveform} from './tracks.ts';

export interface EngineProfile {
  /** Idle pitch in Hz. */
  readonly base: number;
  /** Hz added per km/h. */
  readonly ratio: number;
  readonly wave: Waveform;
  /** Low-pass cut-off at standstill. */
  readonly filter: number;
  /** Centre frequency of the brake squeal noise. */
  readonly brake: number;
  /** Automatic gear redline speeds, used by modelled piston/exhaust voices. */
  readonly gears?: readonly number[];
  readonly cylinders?: number;
  readonly idleRpm?: number;
  readonly redlineRpm?: number;
  /** Exhaust harmonic amplitudes, starting at the firing frequency. */
  readonly harmonics?: readonly number[];
  readonly turbo?: boolean;
}

/** Every vehicle has its own engine voice. */
export const AUDIO_PROFILES: Readonly<Record<string, EngineProfile>> = {
  fusca: { base: 39, ratio: 0.65, wave: 'sawtooth', filter: 480, brake: 650,
    gears: [24, 45, 82, 155], cylinders: 4, idleRpm: 800, redlineRpm: 4800, harmonics: [1, 0.55, 0.3, 0.22, 0.1] },
  brasilia: { base: 46, ratio: 0.62, wave: 'triangle', filter: 650, brake: 850,
    gears: [27, 50, 90, 165], cylinders: 4, idleRpm: 800, redlineRpm: 4900, harmonics: [1, 0.5, 0.32, 0.18, 0.1] },
  gol: { base: 54, ratio: 0.8, wave: 'sawtooth', filter: 720, brake: 1100,
    gears: [38, 68, 108, 148, 185], cylinders: 4, idleRpm: 850, redlineRpm: 6200, harmonics: [1, 0.55, 0.25, 0.18, 0.09] },
  palio: { base: 50, ratio: 0.76, wave: 'triangle', filter: 800, brake: 1000,
    gears: [36, 64, 100, 140, 180], cylinders: 4, idleRpm: 850, redlineRpm: 6400, harmonics: [1, 0.45, 0.3, 0.14, 0.12] },
  moto: { base: 95, ratio: 1.4, wave: 'square', filter: 1100, brake: 1500,
    gears: [34, 62, 95, 135, 175], cylinders: 1, idleRpm: 1400, redlineRpm: 9500, harmonics: [0.5, 1, 0.7, 0.45, 0.25] },
  fiat147: { base: 61, ratio: 0.7, wave: 'triangle', filter: 620, brake: 800,
    gears: [30, 56, 89, 132], cylinders: 4, idleRpm: 850, redlineRpm: 5700, harmonics: [1, 0.5, 0.28, 0.12, 0.08] },
  marea: { base: 43, ratio: 1.05, wave: 'sawtooth', filter: 1150, brake: 1150,
    gears: [52, 91, 139, 185, 220], cylinders: 5, idleRpm: 800, redlineRpm: 6500, harmonics: [1, 0.3, 0.52, 0.18, 0.25, 0.09], turbo: true },
  passat: { base: 52, ratio: 0.74, wave: 'sawtooth', filter: 740, brake: 980,
    gears: [40, 73, 114, 150, 170], cylinders: 4, idleRpm: 900, redlineRpm: 6100, harmonics: [1, 0.62, 0.23, 0.2, 0.1] },
  puma: { base: 36, ratio: 0.88, wave: 'triangle', filter: 880, brake: 1080,
    gears: [39, 72, 112, 250], cylinders: 4, idleRpm: 850, redlineRpm: 5500, harmonics: [1, 0.24, 0.6, 0.12, 0.28, 0.08] },
  gt: { base: 27, ratio: 1.1, wave: 'sawtooth', filter: 1300, brake: 680,
    gears: [68, 113, 163, 220, 283, 350], cylinders: 8, idleRpm: 950, redlineRpm: 8500, harmonics: [1, 0.38, 0.3, 0.2, 0.13, 0.08] },
  suv: { base: 22, ratio: 0.5, wave: 'sawtooth', filter: 320, brake: 520,
    gears: [38, 70, 115, 195], cylinders: 4, idleRpm: 750, redlineRpm: 4200, harmonics: [1, 0.75, 0.4, 0.2, 0.1] },
  superbike: { base: 125, ratio: 1.8, wave: 'square', filter: 1800, brake: 1000,
    gears: [80, 115, 150, 190, 240, 300], cylinders: 4, idleRpm: 1300, redlineRpm: 13000, harmonics: [1, 0.4, 0.22, 0.12, 0.06] },
  kombi: { base: 33, ratio: 0.55, wave: 'triangle', filter: 420, brake: 600,
    gears: [24, 44, 78, 130], cylinders: 4, idleRpm: 800, redlineRpm: 4600, harmonics: [1, 0.5, 0.28, 0.2, 0.08] },
  uno: { base: 62, ratio: 0.9, wave: 'sawtooth', filter: 760, brake: 1050,
    gears: [60, 120, 200, 300, 400], cylinders: 4, idleRpm: 900, redlineRpm: 6200, harmonics: [1, 0.5, 0.28, 0.16, 0.1] },
  'uno-normal': { base: 58, ratio: 0.85, wave: 'sawtooth', filter: 760, brake: 1050,
    gears: [30, 55, 88, 122, 150], cylinders: 4, idleRpm: 900, redlineRpm: 6200, harmonics: [1, 0.5, 0.28, 0.16, 0.1] },
  chevette: { base: 48, ratio: 0.78, wave: 'sawtooth', filter: 700, brake: 950,
    gears: [33, 60, 100, 160], cylinders: 4, idleRpm: 850, redlineRpm: 5800, harmonics: [1, 0.6, 0.25, 0.2, 0.1] },
  cg125: { base: 105, ratio: 1.5, wave: 'square', filter: 1000, brake: 1400,
    gears: [28, 48, 78, 130], cylinders: 1, idleRpm: 1400, redlineRpm: 8500, harmonics: [0.5, 1, 0.65, 0.4, 0.2] },
  opala: { base: 30, ratio: 0.9, wave: 'sawtooth', filter: 560, brake: 800,
    gears: [52, 90, 140, 215], cylinders: 6, idleRpm: 700, redlineRpm: 4800, harmonics: [1, 0.35, 0.45, 0.15, 0.2, 0.08] },
  maverick: { base: 25, ratio: 1, wave: 'sawtooth', filter: 900, brake: 1300,
    gears: [60, 105, 160, 240], cylinders: 8, idleRpm: 700, redlineRpm: 5200, harmonics: [1, 0.5, 0.34, 0.22, 0.12, 0.07] },
  biz125: { base: 85, ratio: 1.15, wave: 'triangle', filter: 900, brake: 1250,
    gears: [24, 44, 72, 110], cylinders: 1, idleRpm: 1400, redlineRpm: 7500, harmonics: [1, 0.8, 0.45, 0.24, 0.12] },
  hayabusa: { base: 100, ratio: 1.65, wave: 'sawtooth', filter: 1650, brake: 950,
    gears: [80, 120, 165, 210, 260, 370], cylinders: 4, idleRpm: 1050, redlineRpm: 11000, harmonics: [1, 0.5, 0.3, 0.16, 0.08, 0.04] },
  harley: { base: 28, ratio: 0.68, wave: 'sawtooth', filter: 420, brake: 620,
    gears: [35, 65, 110, 165], cylinders: 2, idleRpm: 950, redlineRpm: 5500, harmonics: [1, 0.85, 0.35, 0.65, 0.2, 0.3, 0.12] },
};

/** Synthesised firing frequency follows engine RPM through automatic gear changes. */
export function engineVoice(profile: EngineProfile, speed: number, accelerating: boolean) {
  if (!profile.gears) return { frequency: profile.base + Math.max(0, speed) * profile.ratio, gear: 1, load: 0, turbo: 0 };
  const roadSpeed = Math.max(0, speed);
  const nextGear = profile.gears.findIndex((limit) => roadSpeed < limit);
  const gearIndex = nextGear < 0 ? profile.gears.length - 1 : nextGear;
  const revs = Math.min(1, roadSpeed / profile.gears[gearIndex]!);
  const idle = profile.idleRpm!;
  const rpm = Math.max(idle, profile.redlineRpm! * revs);
  const load = accelerating ? Math.max(0, Math.min(1, (revs - 0.3) / 0.5)) : 0;
  return { frequency: rpm / 60 * profile.cylinders! / 2, gear: gearIndex + 1, load, turbo: profile.turbo ? load * 0.035 : 0 };
}

/** Model-specific exhaust spectra, rather than a single sharp oscillator waveform. */
export function engineWave(ctx: BaseAudioContext, profile: EngineProfile): PeriodicWave {
  const harmonics = profile.harmonics ?? [1, 0.3, 0.15];
  return ctx.createPeriodicWave(new Float32Array(harmonics.length + 1), new Float32Array([0, ...harmonics]));
}

