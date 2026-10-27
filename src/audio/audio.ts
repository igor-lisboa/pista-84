import type { Race } from '../game/index.ts';
import { MusicPlayer, type MusicMode } from './music.ts';
import type { Waveform } from './tracks.ts';

interface EngineProfile {
  /** Idle pitch in Hz. */
  readonly base: number;
  /** Hz added per km/h. */
  readonly ratio: number;
  readonly wave: Waveform;
  /** Low-pass cut-off at standstill. */
  readonly filter: number;
  /** Centre frequency of the brake squeal noise. */
  readonly brake: number;
}

/** Every vehicle has its own engine voice. */
export const AUDIO_PROFILES: Readonly<Record<string, EngineProfile>> = {
  fusca: { base: 39, ratio: 0.65, wave: 'sawtooth', filter: 480, brake: 650 },
  brasilia: { base: 46, ratio: 0.62, wave: 'triangle', filter: 650, brake: 850 },
  gol: { base: 54, ratio: 0.8, wave: 'sawtooth', filter: 720, brake: 1100 },
  palio: { base: 50, ratio: 0.76, wave: 'triangle', filter: 800, brake: 1000 },
  moto: { base: 95, ratio: 1.4, wave: 'square', filter: 1100, brake: 1500 },
  gt: { base: 27, ratio: 1.1, wave: 'sawtooth', filter: 1300, brake: 2200 },
  suv: { base: 22, ratio: 0.5, wave: 'sawtooth', filter: 320, brake: 520 },
  superbike: { base: 125, ratio: 1.8, wave: 'square', filter: 1800, brake: 2500 },
  kombi: { base: 33, ratio: 0.55, wave: 'triangle', filter: 420, brake: 600 },
  uno: { base: 58, ratio: 0.85, wave: 'sawtooth', filter: 760, brake: 1050 },
  chevette: { base: 48, ratio: 0.78, wave: 'sawtooth', filter: 700, brake: 950 },
  cg125: { base: 105, ratio: 1.5, wave: 'square', filter: 1000, brake: 1400 },
  opala: { base: 30, ratio: 0.9, wave: 'sawtooth', filter: 560, brake: 800 },
  maverick: { base: 25, ratio: 1, wave: 'sawtooth', filter: 900, brake: 1300 },
};

const EFFECTS_VOLUME = 0.11;
const MUSIC_VOLUME = 0.32;
const ENGINE_LEVEL = 0.2;
const BRAKE_LEVEL = 0.42;
const BRAKE_SQUEAL_LEVEL = 0.18;

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
  update(race: Pick<Race, 'status' | 'speed' | 'car'>, braking: boolean): void {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const running = race.status === 'running';
    const profile = AUDIO_PROFILES[race.car.id] ?? AUDIO_PROFILES.fusca!;

    this.engineGain!.gain.setTargetAtTime(running ? ENGINE_LEVEL : 0, now, 0.08);
    this.engine!.type = profile.wave;
    this.engine!.frequency.setTargetAtTime(profile.base + race.speed * profile.ratio, now, 0.08);
    this.engineFilter!.frequency.value = profile.filter + race.speed * 2;
    this.brakeFilter!.frequency.value = profile.brake + race.speed * 1.5;
    const brakePower = running && braking && race.speed > 2 ? Math.min(1, race.speed / 25) : 0;
    this.brakeGain!.gain.setTargetAtTime(brakePower * BRAKE_LEVEL, now, 0.025);
    this.brakeTone!.frequency.setTargetAtTime(profile.brake * 1.35 + race.speed * 2 + Math.sin(now * 31) * 16, now, 0.025);
    this.brakeToneGain!.gain.setTargetAtTime(brakePower * BRAKE_SQUEAL_LEVEL, now, 0.025);
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

    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    this.brakeFilter = ctx.createBiquadFilter();
    this.brakeFilter.type = 'bandpass';
    this.brakeFilter.Q.value = 2;
    this.brakeGain = ctx.createGain();
    this.brakeGain.gain.value = 0;
    source.connect(this.brakeFilter);
    this.brakeFilter.connect(this.brakeGain);
    this.brakeGain.connect(this.effects);
    // A tonal tyre squeal remains audible above the engine, wind and soundtrack.
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
