/** A music track described as data: a four-bar loop on a 16-step grid. */
export type TrackId = 'menu' | 'neon-highway' | 'turbo-rush' | 'sunset-drive' | 'nitro-circuit' | 'midnight-run' | 'checkered-flag' | 'redline';
export type Waveform = 'sine' | 'triangle' | 'square' | 'sawtooth';
/** Steps of the 16-step bar, or `null` for a rest. */
export type StepPattern<T> = readonly (T | null)[];

export interface Track {
  readonly id: TrackId;
  readonly bpm: number;
  /** MIDI notes of the chord played on each of the four bars. */
  readonly chords: readonly (readonly number[])[];
  /** Sustained chord pad (calm tracks). */
  readonly pad: boolean;
  /** Bass line: semitone offset above two octaves under the chord root. */
  readonly bass: StepPattern<number>;
  readonly bassWave: Waveform;
  /** Arpeggio: index of the chord tone to play (wraps around, played an octave up). */
  readonly arp: StepPattern<number>;
  readonly arpWave: Waveform;
  /** Short chord stabs. */
  readonly stabs: readonly number[];
  readonly kick: readonly number[];
  readonly snare: readonly number[];
  readonly hats: readonly number[];
  /** Per-voice loudness, 0..1. */
  readonly mix: { readonly bass: number; readonly arp: number; readonly pad: number; readonly drums: number };
}

export const STEPS_PER_BAR = 16;

const eighths = [0, 2, 4, 6, 8, 10, 12, 14] as const;
const sixteenths = Array.from({ length: STEPS_PER_BAR }, (_, step) => step);

/** Slow, soft background for menus and pauses. */
const MENU: Track = {
  id: 'menu',
  bpm: 74,
  chords: [
    [57, 60, 64, 67], // Am7
    [53, 57, 60, 64], // Fmaj7
    [48, 55, 60, 64], // Cmaj7
    [55, 59, 62, 64], // G6
  ],
  pad: true,
  bass: [0, null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null],
  bassWave: 'sine',
  arp: [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null],
  arpWave: 'sine',
  stabs: [],
  kick: [],
  snare: [],
  hats: [],
  mix: { bass: 0.5, arp: 0.35, pad: 0.4, drums: 0 },
};

/** Four-on-the-floor synthwave in A minor. */
const NEON_HIGHWAY: Track = {
  id: 'neon-highway',
  bpm: 132,
  chords: [
    [57, 60, 64],
    [53, 57, 60],
    [60, 64, 67],
    [55, 59, 62],
  ],
  pad: false,
  bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 7, 12, 7],
  bassWave: 'sawtooth',
  arp: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1],
  arpWave: 'square',
  stabs: [],
  kick: [0, 4, 8, 12],
  snare: [4, 12],
  hats: [2, 6, 10, 14],
  mix: { bass: 0.55, arp: 0.2, pad: 0, drums: 0.8 },
};

/** Fast, driving E-minor chase with rolling hats. */
const TURBO_RUSH: Track = {
  id: 'turbo-rush',
  bpm: 150,
  chords: [
    [64, 67, 71],
    [60, 64, 67],
    [67, 71, 74],
    [62, 66, 69],
  ],
  pad: false,
  bass: [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 7, 12],
  bassWave: 'sawtooth',
  arp: [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2],
  arpWave: 'sawtooth',
  stabs: [],
  kick: [0, 4, 8, 10, 12],
  snare: [4, 12],
  hats: sixteenths,
  mix: { bass: 0.5, arp: 0.16, pad: 0, drums: 0.7 },
};

/** Laid-back but upbeat groove in D minor with offbeat keys. */
const SUNSET_DRIVE: Track = {
  id: 'sunset-drive',
  bpm: 118,
  chords: [
    [62, 65, 69],
    [58, 62, 65],
    [60, 65, 69],
    [60, 64, 67],
  ],
  pad: false,
  bass: [0, null, null, 0, null, 12, null, null, 0, null, 7, null, null, 10, null, 12],
  bassWave: 'triangle',
  arp: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  arpWave: 'triangle',
  stabs: [3, 7, 11, 14],
  kick: [0, 6, 10],
  snare: [4, 12],
  hats: eighths,
  mix: { bass: 0.7, arp: 0, pad: 0.3, drums: 0.7 },
};

/** Punchy arcade pulse in G minor with a galloping bass, in the spirit of classic racers. */
const NITRO_CIRCUIT: Track = {
  id: 'nitro-circuit',
  bpm: 142,
  chords: [
    [55, 58, 62],
    [51, 55, 58],
    [53, 57, 60],
    [50, 53, 57],
  ],
  pad: false,
  bass: [0, null, 0, 12, 0, null, 0, 12, 0, null, 0, 12, 7, null, 10, 12],
  bassWave: 'sawtooth',
  arp: [0, 2, 1, 2, null, 2, 1, 2, 0, 2, 1, 2, null, 1, 2, 1],
  arpWave: 'square',
  stabs: [],
  kick: [0, 4, 8, 12, 14],
  snare: [4, 12],
  hats: eighths,
  mix: { bass: 0.52, arp: 0.18, pad: 0, drums: 0.8 },
};

/** Dark night-city cruise in C minor: sparse bass, offbeat stabs and a steady kick. */
const MIDNIGHT_RUN: Track = {
  id: 'midnight-run',
  bpm: 124,
  chords: [
    [60, 63, 67],
    [56, 60, 63],
    [58, 62, 65],
    [55, 59, 62],
  ],
  pad: true,
  bass: [0, null, null, 0, null, null, 7, null, 0, null, null, 0, null, 10, null, 12],
  bassWave: 'sawtooth',
  arp: [0, null, 1, null, 2, null, 1, null, 0, null, 1, null, 2, null, 1, null],
  arpWave: 'triangle',
  stabs: [6, 14],
  kick: [0, 4, 8, 12],
  snare: [4, 12],
  hats: [2, 6, 10, 14],
  mix: { bass: 0.55, arp: 0.24, pad: 0.22, drums: 0.75 },
};

/** Bright, major-key victory lap: fast arps over a bouncing bass. */
const CHECKERED_FLAG: Track = {
  id: 'checkered-flag',
  bpm: 138,
  chords: [
    [60, 64, 67],
    [67, 71, 74],
    [57, 60, 64],
    [65, 69, 72],
  ],
  pad: false,
  bass: [0, null, 12, null, 0, null, 12, null, 0, null, 12, null, 7, null, 12, 7],
  bassWave: 'triangle',
  arp: [0, 1, 2, 1, 2, 1, 0, 1, 0, 1, 2, 1, 2, 1, 0, 2],
  arpWave: 'square',
  stabs: [],
  kick: [0, 4, 8, 12],
  snare: [4, 12],
  hats: sixteenths,
  mix: { bass: 0.6, arp: 0.2, pad: 0, drums: 0.7 },
};

/** Relentless high-tempo drive in B minor, the most intense of the set. */
const REDLINE: Track = {
  id: 'redline',
  bpm: 160,
  chords: [
    [59, 62, 66],
    [55, 59, 62],
    [57, 61, 64],
    [66, 69, 73],
  ],
  pad: false,
  bass: [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 0, 12, 7, 12],
  bassWave: 'sawtooth',
  arp: [0, 2, 1, 2, 0, 2, 1, 2, 1, 2, 0, 2, 1, 2, 0, 1],
  arpWave: 'sawtooth',
  stabs: [],
  kick: [0, 3, 4, 8, 11, 12],
  snare: [4, 12],
  hats: sixteenths,
  mix: { bass: 0.48, arp: 0.15, pad: 0, drums: 0.75 },
};

export const MENU_TRACK = MENU;
export const RACE_TRACKS: readonly Track[] = [
  NEON_HIGHWAY,
  TURBO_RUSH,
  SUNSET_DRIVE,
  NITRO_CIRCUIT,
  MIDNIGHT_RUN,
  CHECKERED_FLAG,
  REDLINE,
];

export const midiToHz = (note: number): number => 440 * 2 ** ((note - 69) / 12);
export const stepSeconds = (track: Track): number => 60 / track.bpm / 4;
