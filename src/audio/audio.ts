import type { Race } from '../game/index.ts';
import { vehicleTuning } from '../game/vehicle-tuning.ts';
import { MusicPlayer, type MusicMode } from './music.ts';
import type {Waveform} from './tracks.ts';
import {AUDIO_PROFILES, engineVoice, engineWave} from './engine-voices.ts';
export {AUDIO_PROFILES, engineVoice, engineWave} from './engine-voices.ts';
export type {EngineProfile} from './engine-voices.ts';

const EFFECTS_VOLUME = 0.2;
const MUSIC_VOLUME = 0.07;
const ENGINE_LEVEL = 0.28;
const BRAKE_LEVEL = 0.42;
const BRAKE_SQUEAL_LEVEL = 0.09;
/** Tyre squeal while cornering at speed; scaled by steering load and each car's squeal mix. */
const TURN_LEVEL = 0.07;

type AudioContextConstructor = typeof AudioContext;
const contextConstructor = (): AudioContextConstructor | undefined =>
  window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;

export class AudioUnavailableError extends Error {}

/** Engine, brake and effect sounds plus the background music, behind one on/off switch. */
export class AudioEngine {
  enabled = false;
  private stateVersion = 0;

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
  private turnFilter: BiquadFilterNode | null = null;
  private turnGain: GainNode | null = null;
  private wantedMusic: MusicMode = 'menu';

  /** Turns audio on or off, creating the audio graph on first use. Returns the new state. */
  async toggle(): Promise<boolean> {
    return this.setEnabled(!this.enabled);
  }

  /** A delayed context resume must not override a more recent user choice. */
  async setEnabled(enabled: boolean): Promise<boolean> {
    const version = ++this.stateVersion;
    const ctx = this.ensureContext();
    await ctx.resume();
    if (version !== this.stateVersion) return this.enabled;
    this.enabled = enabled;
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
  update(race: Pick<Race, 'status' | 'speed' | 'car'> & Partial<Pick<Race, 'steer'>>, braking: boolean, accelerating = false): void {
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
    // Tyres grip and squeal harder the more the car is turned at speed; braking hides it.
    const cornering = running && !braking ? Math.min(1, Math.abs(race.steer ?? 0)) * Math.min(1, Math.max(0, race.speed - 20) / 80) : 0;
    this.turnFilter!.frequency.setTargetAtTime(1200 + race.speed * 4, now, 0.1);
    this.turnGain!.gain.setTargetAtTime(cornering * TURN_LEVEL * (0.5 + tuning.squeal), now, 0.08);
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
    this.turnFilter = ctx.createBiquadFilter();
    this.turnFilter.type = 'bandpass';
    this.turnFilter.Q.value = 1.4;
    this.turnGain = ctx.createGain();
    this.turnGain.gain.value = 0;
    source.connect(this.turnFilter);
    this.turnFilter.connect(this.turnGain);
    this.turnGain.connect(this.effects);
    source.start();
    return ctx;
  }
}
