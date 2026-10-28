import type { Race } from '../game/index.ts';
import { vehicleTuning } from '../game/vehicle-tuning.ts';
import { MusicPlayer, type MusicMode } from './music.ts';
import type { Waveform } from './tracks.ts';

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
    gears: [39, 72, 112, 160], cylinders: 4, idleRpm: 850, redlineRpm: 5500, harmonics: [1, 0.24, 0.6, 0.12, 0.28, 0.08] },
  gt: { base: 27, ratio: 1.1, wave: 'sawtooth', filter: 1300, brake: 680,
    gears: [68, 113, 163, 220, 283, 350], cylinders: 8, idleRpm: 950, redlineRpm: 8500, harmonics: [1, 0.38, 0.3, 0.2, 0.13, 0.08] },
  suv: { base: 22, ratio: 0.5, wave: 'sawtooth', filter: 320, brake: 520,
    gears: [38, 70, 115, 195], cylinders: 4, idleRpm: 750, redlineRpm: 4200, harmonics: [1, 0.75, 0.4, 0.2, 0.1] },
  superbike: { base: 125, ratio: 1.8, wave: 'square', filter: 1800, brake: 1000,
    gears: [80, 115, 150, 190, 240, 300], cylinders: 4, idleRpm: 1300, redlineRpm: 13000, harmonics: [1, 0.4, 0.22, 0.12, 0.06] },
  kombi: { base: 33, ratio: 0.55, wave: 'triangle', filter: 420, brake: 600,
    gears: [24, 44, 78, 130], cylinders: 4, idleRpm: 800, redlineRpm: 4600, harmonics: [1, 0.5, 0.28, 0.2, 0.08] },
  uno: { base: 58, ratio: 0.85, wave: 'sawtooth', filter: 760, brake: 1050,
    gears: [30, 55, 88, 122, 150], cylinders: 4, idleRpm: 900, redlineRpm: 6200, harmonics: [1, 0.5, 0.28, 0.16, 0.1] },
  chevette: { base: 48, ratio: 0.78, wave: 'sawtooth', filter: 700, brake: 950,
    gears: [33, 60, 100, 160], cylinders: 4, idleRpm: 850, redlineRpm: 5800, harmonics: [1, 0.6, 0.25, 0.2, 0.1] },
  cg125: { base: 105, ratio: 1.5, wave: 'square', filter: 1000, brake: 1400,
    gears: [28, 48, 78, 130], cylinders: 1, idleRpm: 1400, redlineRpm: 8500, harmonics: [0.5, 1, 0.65, 0.4, 0.2] },
  opala: { base: 30, ratio: 0.9, wave: 'sawtooth', filter: 560, brake: 800,
    gears: [52, 90, 140, 215], cylinders: 6, idleRpm: 700, redlineRpm: 4800, harmonics: [1, 0.35, 0.45, 0.15, 0.2, 0.08] },
  maverick: { base: 25, ratio: 1, wave: 'sawtooth', filter: 900, brake: 1300,
    gears: [60, 105, 160, 240], cylinders: 8, idleRpm: 700, redlineRpm: 5200, harmonics: [1, 0.5, 0.34, 0.22, 0.12, 0.07] },
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

const EFFECTS_VOLUME = 0.2;
const MUSIC_VOLUME = 0.07;
const ENGINE_LEVEL = 0.28;
const BRAKE_LEVEL = 0.32;
const BRAKE_SQUEAL_LEVEL = 0.06;

type AudioContextConstructor = typeof AudioContext;
const contextConstructor = (): AudioContextConstructor | undefined =>
  window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;

export class AudioUnavailableError extends Error {}

/** Engine, brake and effect sounds plus the background music, behind one on/off switch. */
export class AudioEngine {
  enabled = false;

  private ctx: AudioContext | null = null;
  private effects: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private music: MusicPlayer | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private exhaust: OscillatorNode | null = null;
  private exhaustGain: GainNode | null = null;
  private turboFilter: BiquadFilterNode | null = null;
  private turboGain: GainNode | null = null;
  private engineCar = '';
  private readonly waves = new Map<string, PeriodicWave>();
  private brakeFilter: BiquadFilterNode | null = null;
  private brakeGain: GainNode | null = null;
  private brakeTone: OscillatorNode | null = null;
  private brakeToneGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private wantedMusic: MusicMode = 'menu';

  /** Turns audio on or off, creating the audio graph on first use. Returns the new state. */
  async toggle(): Promise<boolean> {
    const ctx = this.ensureContext();
    await ctx.resume();
    this.enabled = !this.enabled;
    this.effects!.gain.value = this.enabled ? EFFECTS_VOLUME : 0;
    this.musicBus!.gain.value = this.enabled ? MUSIC_VOLUME : 0;
    if (this.enabled) this.music!.play(this.wantedMusic);
    else this.music!.stop();
    return this.enabled;
  }

  /** Chooses which music should play; takes effect immediately when audio is on. */
  setMusic(mode: MusicMode): void {
    this.wantedMusic = mode;
    if (this.enabled) this.music?.play(mode);
  }

  tone(frequency: number, duration = 0.13, type: Waveform = 'square', volume = 0.12): void {
    if (!this.enabled || !this.ctx || !this.effects) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.effects);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /** Per-frame engine pitch and brake squeal. */
  update(race: Pick<Race, 'status' | 'speed' | 'car'>, braking: boolean, accelerating = false): void {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const running = race.status === 'running';
    const profile = AUDIO_PROFILES[race.car.id] ?? AUDIO_PROFILES.fusca!;
    const voice = engineVoice(profile, race.speed, accelerating && !braking);

    this.engineGain!.gain.setTargetAtTime(running ? ENGINE_LEVEL * (accelerating ? 1.5 : 0.8) : 0, now, 0.08);
    this.musicBus!.gain.setTargetAtTime(this.wantedMusic === 'race' ? MUSIC_VOLUME * 0.65 : MUSIC_VOLUME, now, 0.12);
    if (this.engineCar !== race.car.id) {
      if (profile.harmonics) {
        let wave = this.waves.get(race.car.id);
        if (!wave) { wave = engineWave(this.ctx, profile); this.waves.set(race.car.id, wave); }
        this.engine!.setPeriodicWave(wave);
      } else this.engine!.type = profile.wave;
      this.engineCar = race.car.id;
    }
    this.engine!.frequency.setTargetAtTime(voice.frequency, now, 0.065);
    this.engineFilter!.frequency.setTargetAtTime(profile.filter + race.speed * 2 + (accelerating ? 350 : 0), now, 0.08);
    this.exhaust!.frequency.setTargetAtTime(voice.frequency / 2, now, 0.08);
    this.exhaustGain!.gain.setTargetAtTime(running && profile.harmonics ? 0.055 * (accelerating ? 1 : 0.6) : 0, now, 0.08);
    this.turboFilter!.frequency.setTargetAtTime(900 + voice.load * 1600, now, 0.12);
    this.turboGain!.gain.setTargetAtTime(running ? voice.turbo : 0, now, 0.15);
    this.brakeFilter!.frequency.value = profile.brake + race.speed * 1.5;
    const brakePower = running && braking && race.speed > 2 ? Math.min(1, race.speed / 25) : 0;
    const tuning = vehicleTuning(race.car);
    this.brakeGain!.gain.setTargetAtTime(brakePower * BRAKE_LEVEL * (0.75 + tuning.braking / 140), now, 0.06);
    this.brakeTone!.frequency.setTargetAtTime(profile.brake + race.speed * 0.65 + Math.sin(now * 17) * 5, now, 0.06);
    this.brakeToneGain!.gain.setTargetAtTime(brakePower * BRAKE_SQUEAL_LEVEL * tuning.squeal, now, 0.06);
    const air = Math.max(0, Math.min(1, (race.speed - 40) / 310));
    this.windFilter!.frequency.setTargetAtTime(450 + air * 2600, now, 0.12);
    this.windGain!.gain.setTargetAtTime(running ? 0.035 * air + 0.12 * air * air : 0, now, 0.12);
  }

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const Constructor = contextConstructor();
    if (!Constructor) throw new AudioUnavailableError('Web Audio is not available');

    const ctx = new Constructor();
    this.ctx = ctx;
    this.effects = ctx.createGain();
    this.effects.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(ctx.destination);
    this.music = new MusicPlayer(ctx, this.musicBus);

    this.engine = ctx.createOscillator();
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engine.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.effects);
    this.engine.start();
    this.exhaust = ctx.createOscillator();
    this.exhaust.type = 'triangle';
    this.exhaustGain = ctx.createGain();
    this.exhaustGain.gain.value = 0;
    this.exhaust.connect(this.exhaustGain);
    this.exhaustGain.connect(this.effects);
    this.exhaust.start();

    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    this.turboFilter = ctx.createBiquadFilter();
    this.turboFilter.type = 'bandpass';
    this.turboFilter.Q.value = 2;
    this.turboGain = ctx.createGain();
    this.turboGain.gain.value = 0;
    source.connect(this.turboFilter);
    this.turboFilter.connect(this.turboGain);
    this.turboGain.connect(this.effects);
    this.brakeFilter = ctx.createBiquadFilter();
    this.brakeFilter.type = 'bandpass';
    this.brakeFilter.Q.value = 0.8;
    this.brakeGain = ctx.createGain();
    this.brakeGain.gain.value = 0;
    source.connect(this.brakeFilter);
    this.brakeFilter.connect(this.brakeGain);
    this.brakeGain.connect(this.effects);
    // Quiet per-model squeal layered over friction; the GT uses friction alone.
    this.brakeTone = ctx.createOscillator();
    this.brakeTone.type = 'triangle';
    this.brakeToneGain = ctx.createGain();
    this.brakeToneGain.gain.value = 0;
    this.brakeTone.connect(this.brakeToneGain);
    this.brakeToneGain.connect(this.effects);
    this.brakeTone.start();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    source.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.effects);
    source.start();
    return ctx;
  }
}
